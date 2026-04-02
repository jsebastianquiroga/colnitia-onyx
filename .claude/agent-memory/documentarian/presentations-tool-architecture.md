---
name: Presentations Tool Architecture
description: Design patterns and implementation details for the PresentationsTool built-in tool in Onyx
type: project
---

# Presentations Tool Architecture

## Overview

PresentationsTool is a built-in tool in Onyx that generates interactive HTML presentations using Reveal.js. It demonstrates best practices for tool integration: stateless execution, graceful fallbacks, iterative editing support, and streaming packet architecture.

## Key Design Decisions

### HTML-Only Output (PPTX Deferred)

**Decision**: Return `download_url=None` instead of blocking on PPTX generation.

**Why**: PPTX requires `python-pptx` library + infrastructure not in scope. HTML is fully functional for immediate needs.

**How to apply**: When adding optional features to tools, silently fail the optional part while succeeding with core functionality. This prevents cascading failures and enables gradual enhancement.

### Iterative Editing via Slides Data

**Decision**: Include full `slides_data` in `llm_facing_response` (JSON) so LLM can reference it in follow-up turns.

**Why**: Standard LLM tool-calling pattern; no special infrastructure needed. LLM sees previous result in context, modifies it, re-calls tool.

**How to apply**: Tools that support multi-turn refinement should return full state (not delta) in LLM-facing response. Enables "change slide 2" workflows naturally.

### Streaming Packet Pattern

**Decision**: Emit `presentation_start` before execution, `presentation_final` after completion. Frontend listens for discriminated union packet type.

**Why**: Immediate feedback without blocking; frontend can show loading state and update panel when ready.

**How to apply**: All generation tools should follow this pattern: start packet (prepare UI) → execution → final packet (deliver result). Use `emit_start()` hook for start packets, emit final packets in `run()`.

### Error Handling Strategy

**Decision**: Use `ToolCallException` for invalid LLM args (missing title), `ToolExecutionException` for runtime failures.

**Why**: Different error types signal different failure modes to framework. ToolCallException is LLM-facing (user message sent); ToolExecutionException breaks the chat.

**How to apply**: Validate inputs first (ToolCallException), then execute (ToolExecutionException). Never let unexpected exceptions escape the tool.

### URL Format via Proxy

**Decision**: Backend serves at `/files/presentations/{filename}`; Next.js proxy adds `/api/` prefix for frontend.

**Why**: Keeps backend routes clean and consistent. Frontend always sees `/api/*` paths.

**How to apply**: When building URLs in tools, use the internal path (without `/api/`). WEB_DOMAIN config provides the base. Frontend proxy handles the rest.

## Component Integration Points

### Tool Lifecycle

1. **Constructor** (`tool_constructor.py`): PresentationsTool instantiated with `tool_id` + `emitter`
2. **Schema** (`tool_definition()`): Sent to LLM; defines parameters and field usage
3. **Start** (`emit_start()`): Framework calls before `run()`; emits `PresentationToolStart` packet
4. **Execution** (`run()`): Validates, generates HTML, emits `PresentationToolFinal`, returns `ToolResponse`
5. **Frontend**: Listens for `presentation_final` packets, renders artifact panel

### Response Model Union

Tools return `ToolResponse` with a discriminated `rich_response` union. `FinalPresentationResponse` is one variant alongside `FinalImageGenerationResponse`, `MemoryToolResponse`, etc.

Adding a new tool response type requires:
1. Create Pydantic model in `tool_implementations/{tool}/models.py`
2. Add import to `backend/onyx/tools/models.py`
3. Add `| NewToolResponse` to `ToolResponse.rich_response` union

### Streaming Packet Union

All streaming packets are discriminated by a `type` field. New packets require:
1. Add enum value to `StreamingType` enum
2. Create packet class with `type: Literal["..."]` matching enum
3. Add class to `PacketObj` union

Example:
```python
class StreamingType(Enum):
    PRESENTATION_FINAL = "presentation_final"  # Add here

class PresentationToolFinal(BaseObj):
    type: Literal["presentation_final"] = StreamingType.PRESENTATION_FINAL.value  # Match
    # ... fields

PacketObj = Union[..., PresentationToolFinal, ...]  # Add to union
```

## Implementation Checklist

When adding a new tool, follow this order:

1. **Create tool class** — Implement Tool interface with `tool_definition()`, `emit_start()`, `run()`
2. **Create response model** — Pydantic model for rich response
3. **Add streaming packets** — Start and final packet types
4. **Register in unions** — Add response to ToolResponse, add packets to PacketObj
5. **Add constructor branch** — Instantiate tool with required config
6. **Write tests** — External dependency unit tests for all paths
7. **Frontend integration** — Listen for packets, render component

## File Locations

- Tool implementation: `backend/onyx/tools/tool_implementations/{tool_name}/`
- Response models: `backend/onyx/tools/tool_implementations/{tool_name}/models.py`
- Tests: `backend/tests/external_dependency_unit/tools/test_{tool_name}_tool.py`
- Streaming: `backend/onyx/server/query_and_chat/streaming_models.py`
- Union types: `backend/onyx/tools/models.py`
- Constructor: `backend/onyx/tools/tool_constructor.py`

## Testing Patterns

- Use `MagicMock` for `Emitter` (test that packets are emitted)
- Use `tmp_path` pytest fixture for file I/O (override `DATA_DIR`)
- Test error paths with `pytest.raises(ToolCallException)` and `pytest.raises(ToolExecutionException)`
- Test schema properties directly via `tool_definition()`
- Test streaming by checking `mock_emitter.emit.call_args_list`

See `backend/tests/external_dependency_unit/tools/test_presentations_tool.py` for full example (27 tests).

## Future Enhancements

- **PPTX generation**: Add `python-pptx` library, map 7 slide types to PPTX layouts, return download_url
- **File cleanup**: Celery task to delete presentations older than 30 days
- **Access control**: Signed URLs or bearer tokens for presentation files (currently public)
- **Versioning**: Track presentation history for "undo" / "view previous version"
