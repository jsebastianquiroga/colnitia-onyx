# Specification: Sprints 4, 5 & Presentations Tool

## Overview
This task encompasses three major improvements for Colnitia Onyx:
1.  **Budget System (Sprint 4)**: A credit-based usage control.
2.  **Advanced Connectors (Sprint 5)**: Cloud-native connector enablement.
3.  **HTML Presentations Tool**: Native Onyx Tool integration for Reveal.js slides.

---

## 1. Budget System (Sprint 4)

### Objective
Provide admins with the ability to limit LLM usage per user via a credit balance.

### Technical Design
- **Database Table (`budget`)**:
    - `id`: Integer (PK)
    - `user_id`: UUID (FK to `user.id`, Unique)
    - `balance`: Float (Remaining credits)
    - `total_spent`: Float (Total historical usage)
    - `is_active`: Boolean
    - `updated_at`: Timestamp
- **Logic**:
    - Token counting already exists in Onyx.
    - We will add a hook in the chat stream/query execution that:
        1.  Checks if the user has an active budget.
        2.  If `balance <= 0`, raises `OnyxError(OnyxErrorCode.PAYMENT_REQUIRED, "Insufficient balance")`.
        3.  Updates the balance after successful LLM response (based on tokens used).
- **API Endpoints**:
    - `GET /api/v1/admin/budgets`: List all users and balances.
    - `PUT /api/v1/admin/budgets/{user_id}`: Update balance.
    - `GET /api/v1/budgets/me`: View current balance and usage.

---

## 2. Advanced Connectors (Sprint 5)

### Objective
Enable enterprise-grade connectors for Google Drive and Slack.

### Technical Design
- **Google Drive**:
    - Requires setting up a Google Cloud Project with OAuth 2.0.
    - Environment variables needed: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`.
    - Redirect URL configuration: `https://{WEB_DOMAIN}/api/v1/connector/google-drive/callback`.
- **Slack**:
    - Requires a Slack App with Bot Token and Scopes.
    - Environment variables: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` (for socket mode if used, or standard events).
- **Task**:
    - Update `docker-compose.railway.yml` to include placeholders for these secrets.
    - Add a "Setup Guide" to the local documentation.

---

## 3. HTML Presentations Tool

### Objective
Integrate the ported Reveal.js generator into the Onyx "Tools" ecosystem so Assistants can generate slides autonomously.

### Technical Design
- **Tool Implementation**:
    - Create `backend/onyx/tools/tool_implementations/presentations_tool.py`.
    - Inherit from `BaseTool`.
    - Definition:
        - `name`: `generate_presentation`
        - `description`: "Generates a professional HTML presentation (slides) based on a topic and content blocks."
        - `parameters`: JSON Schema for `title`, `slides` (list), and `theme`.
- **Logic**:
    - Calls the internal `onyx.server.features.presentations.generator.generate_presentation_html`.
    - Returns the `view_url` to the LLM.
- **Frontend**:
    - Ensure the URL is displayed as a clickable link or embedded iframe in the chat.

---

## Verification Plan

### Automated
- Unit test for budget deduction logic.
- Integration test for `POST /api/v1/presentations/generate`.

### Manual
- Admin panel check: Create a budget of 0.50 USD and verify chat blocks when exhausted.
- Connector check: OAuth flow test with Google Drive.
- Tool check: Ask the assistant "Crea una presentación de 3 diapositivas sobre IA en Colombia".
