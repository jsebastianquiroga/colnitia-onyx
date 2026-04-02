# Handoff: PresentationsTool Frontend Implementation

**Date**: 2026-04-02  
**From**: Backend Team  
**To**: Frontend Team  
**Status**: Backend complete, frontend ready to start  

---

## What Was Done

The PresentationsTool backend is **fully functional and ready for frontend integration**. The tool:

- Registers with the Onyx chat tool system (appears in "Search Actions" dropdown)
- Accepts LLM calls with `title`, `slides` (array of objects with type + fields), and `theme` parameter
- Generates interactive HTML presentations using Reveal.js
- Serves presentations via `/api/files/presentations/{filename}` URL (Next.js proxied)
- Emits streaming packets for UI feedback (`presentation_start`, `presentation_final`)
- Returns typed JSON response with slide metadata and full slides_data for iterative editing
- Handles errors gracefully (invalid args → user message, failures → error packet)

**Frontend will receive two signals**:
1. **Streaming packet** (`presentation_final`) in real-time when generation completes
2. **Chat message** with the tool result (rich response for display)

---

## What You Need to Know

### How the Tool Works

User says → "Create a presentation about AI trends with 5 slides"

LLM calls the tool with:
```json
{
  "title": "AI Trends 2024",
  "slides": [
    {"type": "title", "title": "AI Trends", "subtitle": "2024 Outlook"},
    {"type": "content", "title": "Large Language Models", "bullets": ["GPT-4", "Claude", "Llama"]},
    ...
  ],
  "theme": "dark"
}
```

Backend:
- Generates HTML using slide definitions
- Saves to `/data/presentations/AI_Trends_2024_<uuid>.html`
- Emits `PresentationToolFinal` packet with `view_url`, `download_url` (null for now), `filename`, `slides_count`
- Returns LLM-facing JSON with full `slides_data` for context

### Streaming Packet Format

When presentation is ready, backend emits:

```python
# In backend/onyx/server/query_and_chat/streaming_models.py
class PresentationToolFinal(BaseObj):
    type: Literal["presentation_final"] = StreamingType.PRESENTATION_FINAL.value
    view_url: str                        # "/api/files/presentations/{filename}"
    download_url: str | None             # None (PPTX deferred)
    filename: str                        # "AI_Trends_2024_<uuid>.html"
    slides_count: int                    # 5
```

Frontend should:
1. Listen for packets with `type === "presentation_final"`
2. Extract `view_url` to render the presentation
3. Hide/disable download button (since `download_url` is null)

### Tool Response in Chat

The tool returns:

```python
class FinalPresentationResponse(BaseModel):
    view_url: str                  # Frontend loads this in iframe
    download_url: str | None       # None for now
    filename: str                  # Used for caching, display
    slides_count: int              # For badge/summary
    slides_data: list[dict]        # Full slide objects for LLM to modify
```

This is passed as `rich_response` in the chat message. Use it to:
- Display an inline card (title, slide count badge, theme indicator)
- Populate the lateral panel iframe src with `view_url`
- Keep `slides_data` in state for multi-turn editing

### Iterative Editing

User says → "Change slide 2 to say 'Transformers' instead of 'Attention Mechanisms'"

LLM:
1. Sees the tool result message in context (includes full `slides_data`)
2. Modifies slide 2 in the array
3. Re-calls the tool with updated slides

Frontend:
- Shows loading state for the second generation
- Updates panel with new presentation from the new `view_url`
- User experience is seamless

---

## Files to Review

**Backend files** (for reference, read-only):

- `backend/onyx/tools/tool_implementations/presentations/presentations_tool.py` — Tool implementation, error handling, streaming
- `backend/onyx/tools/tool_implementations/presentations/models.py` — Response model with type hints
- `backend/onyx/server/query_and_chat/streaming_models.py` (lines 233-247) — Streaming packet definitions
- `backend/onyx/tools/models.py` (lines 87-108) — ToolResponse union with FinalPresentationResponse
- `backend/onyx/tools/tool_constructor.py` (lines 286-293) — How PresentationsTool is instantiated
- `backend/onyx/server/auth_check.py` (line 67) — File serving route already registered
- `backend/tests/external_dependency_unit/tools/test_presentations_tool.py` — Test patterns

**Frontend files** (to create/modify):

- Create: `web/src/app/app/components/tools/PresentationArtifact.tsx` — Main artifact component
- Modify: `web/src/app/app/components/tools/constants.ts` — Add PRESENTATIONS_TOOL_ID
- Modify: Chat message rendering to dispatch on `presentation_final` packet type
- Modify: Chat message rendering to display `FinalPresentationResponse` as artifact

---

## Decisions Already Made

| Decision | Rationale |
| -------- | --------- |
| **HTML-only for now** (no PPTX) | PPTX requires `python-pptx` library + infrastructure; HTML is fully functional; PPTX is future enhancement |
| **URL pattern: /api/files/presentations/{filename}** | Backend serves at `/files/presentations/...`; Next.js proxy adds `/api/` prefix |
| **Iterative editing via slides_data in JSON** | LLM sees full slides in context; re-calls tool with modifications; no special infrastructure |
| **Streaming packets separate from chat message** | Immediate feedback (presentation_final packet) + result in message for persistence |
| **No PPTX download button** | Set `download_url=None` — frontend hides button; enables adding PPTX later without breaking UI |

---

## Acceptance Criteria

✓ = Backend complete  
→ = Frontend work  

- [x] PresentationsTool appears in chat "Search Actions" dropdown (already works)
- [x] User can say "make a presentation about X" and tool executes (already works)
- [x] Tool generates HTML and returns URL (already works)
- [ ] **→ Chat shows inline card with presentation info and click-to-open-panel**
- [ ] **→ Clicking card opens lateral panel with Reveal.js presentation**
- [x] User can say "change slide 2" and tool re-generates (LLM auto-iterates via slides_data)
- [ ] **→ PPTX download works if available** (hidden for now, enable later)

---

## Testing the Tool Now

**E2E test** (with all services running):

```bash
# Start Onyx
docker-compose up

# Open http://localhost:3000
# Log in with a@example.com / a

# In chat:
# "Create a 3-slide presentation about climate change"

# Check browser console for streaming packets:
# window.addEventListener('message', (e) => console.log(e.data))

# Should see packet: {type: "presentation_final", view_url: "...", ...}

# Later:
# "Change slide 2 to focus on renewable energy"

# Tool should re-generate and LLM should modify slides
```

**Backend test** (isolated):

```bash
source .venv/bin/activate
pytest backend/tests/external_dependency_unit/tools/test_presentations_tool.py -xv
```

All 27 tests pass.

---

## Component Requirements

### PresentationArtifact Component

**Props**:
```typescript
interface PresentationArtifactProps {
  response: FinalPresentationResponse  // From tool result
  packet?: PresentationToolFinal        // Optional, from streaming
}
```

**Behavior**:
1. **Inline card** (shown in chat message flow):
   - Title from `response.filename` or "Presentation"
   - Badge: "{slides_count} slides" 
   - Theme indicator (if available from filename or response)
   - Click handler: open lateral panel

2. **Lateral panel** (slides out from right):
   - Close button (top-right)
   - Toolbar:
     - "Download PPTX" button (disabled/hidden if `download_url` is null)
     - "Download HTML" button → downloads `view_url` content
     - "Fullscreen" button → native browser fullscreen on iframe
   - Main content: `<iframe src={response.view_url} />` (or redirect user to view_url in new tab)
   - Footer: slide count, theme name

**Panel pattern**:
- If no existing artifact panel pattern, create a reusable `ArtifactPanel` wrapper
- Use similar styling/transitions as Claude's artifact panel (smooth slide-in from right)
- Close panel with Esc key or close button

### Streaming Integration

**Where to listen**:
- Chat stream event handler (already exists for other tool packets)
- Look for `packet.obj.type === "presentation_final"`
- Extract `view_url`, `download_url`, `filename`, `slides_count`
- Pre-load the URL or trigger UI update when packet arrives

**What to do**:
- Show loading spinner until packet arrives
- Update panel with new `view_url` when re-generation completes

---

## Known Limitations

- PPTX download is not available (set to null) — future work
- File cleanup: presentations persist forever in `/data/presentations/` directory
  - Future enhancement: Celery task to delete files older than 30 days
- HTML is served directly; no versioning or access control (file is public once generated)
  - This is intentional: presentations are ephemeral, not sensitive

---

## Frontend Checklist

- [ ] Add `PRESENTATION_START = "presentation_start"` and `PRESENTATION_FINAL = "presentation_final"` to frontend StreamingType enum
- [ ] Add `export const PRESENTATIONS_TOOL_ID = "PresentationsTool"` to tool constants
- [ ] Create `PresentationArtifact.tsx` component
- [ ] Create or reuse `ArtifactPanel` wrapper component
- [ ] Wire packet listener to detect `presentation_final` packets
- [ ] Wire chat message rendering to show `FinalPresentationResponse` in artifact
- [ ] Test: User can open presentation in lateral panel
- [ ] Test: User can click "Download HTML" (saves HTML file)
- [ ] Test: User can click "Fullscreen" (native browser fullscreen)
- [ ] Test: Iterative editing (user asks to modify, tool re-generates, new presentation loads)
- [ ] Test: Visual consistency with existing artifact panels (images, etc.)

---

## Questions?

**Backend contact**: Backend team  
**Report**: `planning/reports/2026-04-02-presentations-tool-backend.md`  
**Tests**: `backend/tests/external_dependency_unit/tools/test_presentations_tool.py`  

The backend is locked in and ready. Frontend work is independent and can start immediately.
