# PresentationsTool — Complete Built-in Tool Integration

## Issues to Address

The `PresentationsTool` is partially implemented but non-functional. It's registered in `built_in_tools.py` and has a DB migration, but:

1. **Missing constructor branch** — `tool_constructor.py` has no elif for PresentationsTool, so it never gets instantiated for any persona
2. **Broken `run()` method** — calls `generate_presentation_html()` expecting a filename, but the function returns HTML string. Must call `save_presentation()` separately
3. **Schema mismatch** — `tool_definition()` has generic Reveal.js themes (black, white, league...) but the generator uses custom themes (dark, light, corporate). Slide objects only have `title`+`content` but generator supports 7 types with different required fields
4. **No PPTX output** — design requires HTML + PPTX
5. **No streaming packets** — `emit_start()` is empty; no heartbeat during generation
6. **No structured rich_response** — returns a plain dict, not a typed model registered in `ToolResponse` union
7. **No frontend artifact panel** — no component to render presentation inline or in a lateral panel

## Important Notes

- PresentationsTool is already in `BUILT_IN_TOOL_MAP`, `STOPPING_TOOLS_NAMES`, and `BUILT_IN_TOOL_TYPES` in `built_in_tools.py` — no changes needed there
- DB migration exists in `a001_sprint_4_5_features.py` — no new migration needed
- Auth route for `/files/presentations/{filename}` already registered in `auth_check.py` (line 67)
- The generator (`generator.py`) is fully functional with 7 slide types and 3 themes (dark, light, corporate)
- `APP_API_PREFIX` defaults to empty string (`os.environ.get("API_PREFIX", "")`). The `/api/` prefix comes from Next.js proxy rewrites, not the backend. Backend URLs are `/files/presentations/{filename}`, frontend proxies as `/api/files/presentations/{filename}`
- `ToolResponse.rich_response` is a discriminated union in `backend/onyx/tools/models.py` (line 84-107) — adding a new variant requires updating this union
- `PacketObj` is defined in `backend/onyx/server/query_and_chat/streaming_models.py` (line 374) as a `Union[...]` with `Field(discriminator="type")` — new packet types must be added here
- `StreamingType` enum is at line 14 of `streaming_models.py` — add new entries for presentation packets
- Per CLAUDE.md: use `ToolCallException` (invalid LLM args) and `ToolExecutionException` (runtime failures), not `HTTPException`
- PPTX sandbox infrastructure in `build/sandbox/kubernetes/docker/skills/pptx/` is Docker-based and NOT directly usable from the backend Python process. Use `python-pptx` library instead.

## Implementation Strategy

### Backend (Priority 1 — makes the tool functional)

#### 1.1 Fix `tool_definition()` in `presentations_tool.py`

Update themes and slide schema to match generator reality:

```python
"parameters": {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "The title of the presentation",
        },
        "slides": {
            "type": "array",
            "description": "List of slide objects. Each slide has a 'type' that determines which fields are used.",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["title", "content", "stats", "quote", "section", "two_column", "closing"],
                        "description": "Slide layout type",
                    },
                    "title": {"type": "string", "description": "Slide title (used by: title, content, stats, section, two_column, closing)"},
                    "subtitle": {"type": "string", "description": "Subtitle text (used by: title, section, closing)"},
                    "bullets": {"type": "array", "items": {"type": "string"}, "description": "Bullet points (used by: content)"},
                    "stats": {"type": "array", "items": {"type": "object", "properties": {"value": {"type": "string"}, "label": {"type": "string"}}}, "description": "Stat cards (used by: stats, max 4)"},
                    "quote": {"type": "string", "description": "Quote text (used by: quote)"},
                    "author": {"type": "string", "description": "Quote author (used by: quote)"},
                    "role": {"type": "string", "description": "Author role/title (used by: quote)"},
                    "left_items": {"type": "array", "items": {"type": "string"}, "description": "Left column items (used by: two_column)"},
                    "right_items": {"type": "array", "items": {"type": "string"}, "description": "Right column items (used by: two_column)"},
                    "left_title": {"type": "string", "description": "Left column heading (used by: two_column)"},
                    "right_title": {"type": "string", "description": "Right column heading (used by: two_column)"},
                    "contact": {"type": "string", "description": "Contact info (used by: closing)"},
                },
                "required": ["type"],
            },
        },
        "theme": {
            "type": "string",
            "description": "Visual theme for the presentation",
            "enum": ["dark", "light", "corporate"],
            "default": "dark",
        },
    },
    "required": ["title", "slides"],
}
```

**Key**: Only `type` is required per slide. Different slide types use different optional fields. The generator handles missing fields gracefully with defaults.

#### 1.2 Fix `run()` in `presentations_tool.py`

```python
def run(self, placement: Placement, override_kwargs: None, **llm_kwargs: Any) -> ToolResponse:
    title = llm_kwargs.get("title")
    if not title:
        raise ToolCallException(
            message="Missing required 'title' parameter",
            llm_facing_message="The generate_presentation tool requires a 'title' parameter.",
        )

    slides = llm_kwargs.get("slides", [])
    if not slides:
        raise ToolCallException(
            message="Missing or empty 'slides' parameter",
            llm_facing_message="The generate_presentation tool requires at least one slide.",
        )

    theme = llm_kwargs.get("theme", "dark")

    try:
        html = generate_presentation_html(title, slides, theme)
        filename = save_presentation(title, html)
    except Exception as e:
        raise ToolExecutionException(
            f"Failed to generate presentation: {e}",
            emit_error_packet=True,
        )

    # Build URL — backend serves at /files/presentations/{filename}
    # Next.js proxy adds /api/ prefix for frontend access
    base_url = WEB_DOMAIN.rstrip("/") if WEB_DOMAIN else ""
    view_url = f"{base_url}/api/files/presentations/{filename}"

    # Attempt PPTX generation (optional)
    download_url: str | None = None
    try:
        pptx_filename = generate_pptx(title, slides, theme)
        download_url = f"{base_url}/api/files/presentations/{pptx_filename}"
    except Exception:
        pass  # PPTX is optional — HTML is always available

    final_response = FinalPresentationResponse(
        view_url=view_url,
        download_url=download_url,
        filename=filename,
        slides_count=len(slides),
        slides_data=slides,
    )

    # Emit final packet for frontend artifact rendering
    self.emitter.emit(Packet(placement=placement, obj=PresentationToolFinal(
        view_url=view_url,
        download_url=download_url,
        filename=filename,
        slides_count=len(slides),
    )))

    # LLM-facing response includes slides_data so LLM can reference/modify in follow-up turns
    llm_response = json.dumps({
        "view_url": view_url,
        "download_url": download_url,
        "slides_count": len(slides),
        "slides_data": slides,
    })

    return ToolResponse(
        rich_response=final_response,
        llm_facing_response=llm_response,
    )
```

**Error handling**:
- `ToolCallException` when `title` is missing or `slides` is empty (invalid LLM args)
- `ToolExecutionException` when HTML generation fails (runtime error)
- PPTX failure is silently caught — tool succeeds with HTML-only

**Iterative editing**: `llm_facing_response` includes `slides_data` as JSON. When the user asks to modify slides, the LLM sees the previous slides JSON in its context (from the tool result message), modifies it, and calls the tool again. No special infrastructure needed — this is standard tool-calling behavior.

#### 1.3 Add `emit_start()` in `presentations_tool.py`

**Note**: `emit_start()` is called by the tool_runner framework BEFORE `run()` executes. It is not called within `run()`.

```python
def emit_start(self, placement: Placement) -> None:
    self.emitter.emit(Packet(placement=placement, obj=PresentationToolStart()))
```

#### 1.4 Add streaming packet types in `streaming_models.py`

Add to `StreamingType` enum (after `IMAGE_GENERATION_FINAL`):
```python
PRESENTATION_START = "presentation_start"
PRESENTATION_FINAL = "presentation_final"
```

Add new packet classes:
```python
class PresentationToolStart(BaseObj):
    type: Literal["presentation_start"] = StreamingType.PRESENTATION_START.value

class PresentationToolFinal(BaseObj):
    type: Literal["presentation_final"] = StreamingType.PRESENTATION_FINAL.value
    view_url: str
    download_url: str | None
    filename: str
    slides_count: int
```

Add both to `PacketObj` union (line 374 in `streaming_models.py`). Insert after `ImageGenerationFinal` and before `OpenUrlStart` to group with other generation tools.

#### 1.5 Create response model in `tool_implementations/presentations/models.py`

Following `tool_implementations/images/models.py` pattern:

```python
from pydantic import BaseModel

class FinalPresentationResponse(BaseModel):
    view_url: str
    download_url: str | None
    filename: str
    slides_count: int
    slides_data: list[dict]
```

Then update `backend/onyx/tools/models.py`:
1. Add import at top: `from onyx.tools.tool_implementations.presentations.models import FinalPresentationResponse`
2. Add `| FinalPresentationResponse` to the `rich_response` union (insert after `CustomToolCallSummary` line, before `PythonToolRichResponse`)

**Directory setup**: Ensure `tool_implementations/presentations/__init__.py` exists (it should already exist since `presentations_tool.py` is there and imported by `built_in_tools.py`).

#### 1.6 Add constructor branch in `tool_constructor.py`

Add after the last elif in `construct_tools()`:

```python
elif tool_cls.__name__ == PresentationsTool.__name__:
    tool_dict[db_tool_model.id] = [
        PresentationsTool(
            tool_id=db_tool_model.id,
            emitter=emitter,
        )
    ]
```

Import at top of file:
```python
from onyx.tools.tool_implementations.presentations.presentations_tool import PresentationsTool
```

No config or credentials needed — PresentationsTool only requires `tool_id` and `emitter`.

#### 1.7 PPTX Generation

**Decision**: PPTX is **optional** (graceful fallback). The tool always succeeds with HTML. PPTX is a bonus.

**Implementation**:
- Add `python-pptx` to `requirements/default.txt`
- Create `generate_pptx()` function in `generator.py`:
  - Maps slide types to PPTX layouts (title → title slide, content → bullet slide, etc.)
  - Uses `python-pptx` library directly (NOT the Docker sandbox infrastructure)
  - Saves `.pptx` file alongside HTML in `_get_presentations_dir()`
  - Returns filename on success
- If `python-pptx` is not importable, `generate_pptx()` raises `ImportError` which is caught silently in `run()`
- File cleanup: no automated cleanup for now. Files persist in `_get_presentations_dir()`. Future enhancement: add a periodic Celery task to delete files older than 30 days. This is out of scope for this spec.

**DB seeding**: The tool is already seeded in the database by migration `a001_sprint_4_5_features.py` which inserts a row with `in_code_tool_id = 'PresentationsTool'`, `name = 'generate_presentation'`, `enabled = True`. No additional migration needed.

### Frontend (Priority 1B — artifact panel, required for acceptance criteria #4-6)

#### 2.1 Add streaming type constants

In the frontend TypeScript enum for streaming types (find the equivalent of `StreamingType`):
- Add `PRESENTATION_START = "presentation_start"`
- Add `PRESENTATION_FINAL = "presentation_final"`

In `web/src/app/app/components/tools/constants.ts`:
- Add `export const PRESENTATIONS_TOOL_ID = "PresentationsTool"`

#### 2.2 Create `PresentationArtifact` component

**File**: `web/src/app/app/components/tools/PresentationArtifact.tsx`

Triggered when chat message contains a `presentation_final` streaming packet.

**Inline card** (rendered in chat message flow):
- Card with presentation title, slide count badge, theme indicator
- Click opens lateral panel

**Lateral panel** (slides out from right side):
- Full-width iframe loading `view_url` (the Reveal.js HTML presentation)
- Toolbar: "Download PPTX" (disabled/hidden if `download_url` is null), "Download HTML", "Fullscreen", "Close"
- Panel pattern: if no existing artifact panel pattern exists in the codebase, create a reusable `ArtifactPanel` wrapper component

#### 2.3 Wire into chat message rendering

Find the component that handles tool response rendering in chat messages (likely in `web/src/app/app/` components). Add a case for `presentation_final` type that renders `PresentationArtifact`.

#### 2.4 Add to ActionsPopover

In `web/src/refresh-components/popovers/ActionsPopover/index.tsx`:
- PresentationsTool will appear automatically via `useAvailableTools()` since it's a built-in tool with `chat_selectable=True` (default)
- Add entry to `ADMIN_CONFIG_LINKS` if there's a settings page for presentations (currently none — skip)

## Acceptance Criteria

The implementation is complete when:
1. PresentationsTool appears in the chat "Search Actions" dropdown
2. User can say "make a presentation about X" and the LLM calls the tool
3. Tool generates HTML file and returns a viewable URL
4. Chat shows an inline card with presentation info
5. Clicking the card opens a lateral panel with the Reveal.js presentation
6. User can say "change slide 2" and the LLM re-generates with modifications
7. PPTX download works if `python-pptx` is installed (optional)

## Tests

### External Dependency Unit Test (Primary)

- `backend/tests/external_dependency_unit/tools/test_presentations_tool.py`
- **Test instantiation**: Create PresentationsTool with mock emitter, verify properties (name, display_name, id)
- **Test tool_definition**: Verify schema has correct theme enum, slide type enum, required fields
- **Test run() with valid input**: Provide title + slides, verify returns ToolResponse with FinalPresentationResponse, verify HTML file created on disk
- **Test run() with missing title**: Verify raises ToolCallException
- **Test run() with empty slides**: Verify raises ToolCallException
- **Test all 7 slide types**: One test per type verifying HTML output contains expected elements
- **Test theme variants**: Verify dark/light/corporate themes produce different CSS vars
- **Test PPTX generation**: If python-pptx available, verify .pptx file created; if not, verify download_url is None
- **Test emit_start**: Verify emitter receives PresentationToolStart packet

### Fixtures/Setup

- Use `unittest.mock.MagicMock` for `Emitter`
- Use `tmp_path` pytest fixture for presentations directory (override `DATA_DIR` env var)
- Slide test data as dict literals in test file (no external fixtures needed)
