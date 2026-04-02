---
name: Built-in Tools Integration Pattern
description: Step-by-step process for adding new built-in tools to Onyx chat system
type: project
---

# Built-in Tools Integration Pattern

This document captures the exact steps and patterns for integrating a new built-in tool into Onyx, derived from the PresentationsTool implementation.

## Integration Checklist

### 1. Create Tool Implementation

**File**: `backend/onyx/tools/tool_implementations/{tool_name}/{tool_name}_tool.py`

```python
from onyx.tools.interface import Tool
from onyx.tools.models import ToolResponse, ToolCallException, ToolExecutionException

class MyTool(Tool[ConfigType]):  # ConfigType is None if stateless
    NAME = "my_tool_name"
    DESCRIPTION = "Human-readable description for LLM"
    DISPLAY_NAME = "Display Name for UI"
    
    def __init__(self, tool_id: int, emitter: Emitter, **optional_config):
        super().__init__(emitter=emitter)
        self._id = tool_id
        
    @property
    def id(self) -> int:
        return self._id
    
    @property
    def name(self) -> str:
        return self.NAME
    
    def tool_definition(self) -> dict:
        # Return JSON schema for LLM
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {...},
                    "required": [...]
                }
            }
        }
    
    def emit_start(self, placement: Placement) -> None:
        # Called by framework BEFORE run()
        self.emitter.emit(Packet(placement=placement, obj=MyToolStart()))
    
    def run(self, placement: Placement, override_kwargs: None, **llm_kwargs: Any) -> ToolResponse:
        # Validate inputs
        param1 = llm_kwargs.get("param1")
        if not param1:
            raise ToolCallException(
                message="Missing param1",
                llm_facing_message="My tool requires param1"
            )
        
        try:
            # Execute
            result = self._execute(param1)
        except Exception as e:
            raise ToolExecutionException(
                f"Execution failed: {e}",
                emit_error_packet=True
            )
        
        # Emit final packet
        self.emitter.emit(Packet(placement=placement, obj=MyToolFinal(...)))
        
        # Return response
        return ToolResponse(
            rich_response=FinalMyResponse(...),
            llm_facing_response=json.dumps({...})
        )
```

**Key points**:
- `__init__` receives `tool_id` + `emitter` (minimum for stateless tools)
- `tool_definition()` is the LLM contract — be detailed about field usage
- `emit_start()` is called by framework before `run()`; emit start packet here
- `run()` validates first (ToolCallException), executes (catch as ToolExecutionException)
- Emit final packet in `run()` after successful execution
- Return ToolResponse with typed rich_response + JSON llm_facing_response

### 2. Create Response Model

**File**: `backend/onyx/tools/tool_implementations/{tool_name}/models.py`

```python
from pydantic import BaseModel

class FinalMyResponse(BaseModel):
    field1: str
    field2: int
    field3: list[dict[str, Any]]
```

**Key points**:
- Simple Pydantic model, no inheritance needed
- Include all fields needed for UI rendering
- Include full state for multi-turn workflows

### 3. Add to Response Union

**File**: `backend/onyx/tools/models.py`

```python
# At top of file, add import:
from onyx.tools.tool_implementations.{tool_name}.models import FinalMyResponse

# In ToolResponse class, find rich_response union (around line 87-108):
class ToolResponse(BaseModel):
    rich_response: (
        FinalImageGenerationResponse
        | ...existing types...
        | FinalMyResponse  # Add here
        | str
        | None
    )
```

### 4. Add Streaming Packet Types

**File**: `backend/onyx/server/query_and_chat/streaming_models.py`

**Step 4a**: Add enum values (around line 14-59):
```python
class StreamingType(Enum):
    # ... existing ...
    IMAGE_GENERATION_FINAL = "image_generation_final"
    MY_TOOL_START = "my_tool_start"           # Add here
    MY_TOOL_FINAL = "my_tool_final"           # Add here
    PYTHON_TOOL_START = "python_tool_start"
```

**Step 4b**: Create packet classes (find where ImageGenerationToolStart is, around line 205):
```python
class MyToolStart(BaseObj):
    type: Literal["my_tool_start"] = StreamingType.MY_TOOL_START.value

class MyToolFinal(BaseObj):
    type: Literal["my_tool_final"] = StreamingType.MY_TOOL_FINAL.value
    field1: str
    field2: int
    # ... include minimal metadata needed by frontend
```

**Step 4c**: Add to PacketObj union (around line 391-437):
```python
PacketObj = Union[
    # ... existing packets ...
    ImageGenerationToolStart,
    ImageGenerationToolHeartbeat,
    ImageGenerationFinal,
    MyToolStart,             # Add here
    MyToolFinal,             # Add here
    OpenUrlStart,
    # ... rest ...
]
```

### 5. Add Constructor Branch

**File**: `backend/onyx/tools/tool_constructor.py`

**Step 5a**: Import at top (around line 35-50):
```python
from onyx.tools.tool_implementations.{tool_name}.{tool_name}_tool import MyTool
```

**Step 5b**: Add elif branch in `construct_tools()` function (around line 200-295):
```python
# Handle My Tool
elif tool_cls.__name__ == MyTool.__name__:
    tool_dict[db_tool_model.id] = [
        MyTool(
            tool_id=db_tool_model.id,
            emitter=emitter,
            # Add optional config parameters here if needed
        )
    ]
```

**Key points**:
- Pattern: Check `tool_cls.__name__` against class name
- Instantiate with at minimum `tool_id` and `emitter`
- If tool needs DB lookups or config, do it before instantiation (see ImageGenerationTool)

### 6. Ensure DB Registration

The tool must be seeded in the `tool` table. This is typically done via migration when the tool is first added.

Check if already registered:
```bash
docker exec -it onyx-relational_db-1 psql -U postgres -c "SELECT * FROM tool WHERE in_code_tool_id = 'MyTool';"
```

If not present, add via migration:
```python
# In alembic version file
op.execute("""
INSERT INTO tool (in_code_tool_id, name, enabled, chat_selectable, is_built_in) 
VALUES ('MyTool', 'my_tool_name', true, true, true)
""")
```

### 7. Write Tests

**File**: `backend/tests/external_dependency_unit/tools/test_my_tool.py`

Pattern from PresentationsTool:

```python
import pytest
from unittest.mock import MagicMock
from onyx.server.query_and_chat.placement import Placement
from onyx.server.query_and_chat.streaming_models import MyToolFinal, MyToolStart
from onyx.tools.models import ToolCallException, ToolExecutionException
from onyx.tools.tool_implementations.{tool_name}.models import FinalMyResponse
from onyx.tools.tool_implementations.{tool_name}.{tool_name}_tool import MyTool

@pytest.fixture
def mock_emitter() -> MagicMock:
    return MagicMock()

@pytest.fixture
def my_tool(mock_emitter: MagicMock) -> MyTool:
    return MyTool(tool_id=42, emitter=mock_emitter)

@pytest.fixture
def placement() -> Placement:
    return Placement(order=0)

class TestInstantiation:
    def test_name(self, my_tool: MyTool) -> None:
        assert my_tool.name == "my_tool_name"

class TestSchema:
    def test_required_fields(self, my_tool: MyTool) -> None:
        defn = my_tool.tool_definition()
        assert defn["function"]["parameters"]["required"] == ["field1"]

class TestRun:
    def test_missing_required_param(self, my_tool: MyTool, placement: Placement) -> None:
        with pytest.raises(ToolCallException):
            my_tool.run(placement=placement, override_kwargs=None)
    
    def test_valid_input(self, my_tool: MyTool, placement: Placement) -> None:
        response = my_tool.run(
            placement=placement, override_kwargs=None, 
            field1="test"
        )
        assert isinstance(response.rich_response, FinalMyResponse)

class TestEmitStart:
    def test_emits_start_packet(self, my_tool: MyTool, placement: Placement, mock_emitter: MagicMock) -> None:
        my_tool.emit_start(placement)
        mock_emitter.emit.assert_called_once()
        packet = mock_emitter.emit.call_args.args[0]
        assert isinstance(packet.obj, MyToolStart)
```

**Coverage goals**:
- Properties (name, display_name, id)
- Schema validation (enum values, required fields, descriptions)
- Error cases (ToolCallException for invalid args)
- Happy path (valid input returns typed response)
- All variants/modes if applicable
- Streaming packet emission

### 8. Frontend Integration (Separate)

Frontend team:
1. Add streaming type constants
2. Create artifact component for the new tool
3. Wire packet listener to detect new packet type
4. Wire chat message rendering to display component

See `planning/reports/2026-04-02-handoff-to-frontend.md` for frontend checklist.

## Common Patterns

### Stateless Tools (No Config Needed)
- PresentationsTool, PythonTool, WebSearchTool
- Constructor needs only `tool_id` + `emitter`
- `Tool[None]` as base class

### Tools with LLM Config
- ImageGenerationTool
- Constructor needs to look up config in DB, build LLMConfig, pass to tool
- Pattern: `_get_image_generation_config(llm, db_session)` before instantiation

### Tools with Search/Documents
- SearchTool
- Constructor needs document index, user context, filters
- Pattern: Build PersonaSearchInfo, pass to tool

### Tools with External APIs
- WebSearchTool, OpenURLTool
- Constructor handles API key validation
- May raise ValueError if API not configured

## Error Handling Reference

```python
# Invalid LLM args (user should fix)
raise ToolCallException(
    message="Internal: what went wrong",
    llm_facing_message="Message for LLM to include in tool result"
)

# Runtime failure (execution problem)
raise ToolExecutionException(
    f"Failed to execute: {error}",
    emit_error_packet=True  # If True, error packet sent to frontend
)
```

## URL Building Reference

```python
from onyx.configs.app_configs import WEB_DOMAIN

# In tool run():
base_url = WEB_DOMAIN.rstrip("/") if WEB_DOMAIN else ""
view_url = f"{base_url}/api/files/presentations/{filename}"
```

## Imports Reference

```python
# Core tool interface
from onyx.tools.interface import Tool
from onyx.tools.models import ToolResponse, ToolCallException, ToolExecutionException

# Streaming
from onyx.server.query_and_chat.streaming_models import Packet, StreamingType
from onyx.chat.emitter import Emitter
from onyx.server.query_and_chat.placement import Placement

# Config
from onyx.configs.app_configs import WEB_DOMAIN
```
