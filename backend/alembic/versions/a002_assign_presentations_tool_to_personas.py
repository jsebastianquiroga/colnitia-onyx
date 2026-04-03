"""Assign PresentationsTool to all existing personas

Revision ID: a002_assign_presentations_tool
Revises: a001_sprint_4_5_features
Create Date: 2026-04-03 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "a002_assign_presentations_tool"
down_revision = "a001_sprint_4_5_features"
branch_labels = None
depends_on = None

TOOL_IN_CODE_ID = "PresentationsTool"


def upgrade() -> None:
    conn = op.get_bind()

    # Look up the PresentationsTool id
    result = conn.execute(
        sa.text("SELECT id FROM tool WHERE in_code_tool_id = :in_code_tool_id"),
        {"in_code_tool_id": TOOL_IN_CODE_ID},
    ).fetchone()

    if not result:
        return

    tool_id = result[0]

    # Assign to ALL existing personas that don't already have it
    conn.execute(
        sa.text(
            """
            INSERT INTO persona__tool (persona_id, tool_id)
            SELECT p.id, :tool_id
            FROM persona p
            WHERE NOT EXISTS (
                SELECT 1 FROM persona__tool pt
                WHERE pt.persona_id = p.id AND pt.tool_id = :tool_id
            )
            """
        ),
        {"tool_id": tool_id},
    )


def downgrade() -> None:
    conn = op.get_bind()

    result = conn.execute(
        sa.text("SELECT id FROM tool WHERE in_code_tool_id = :in_code_tool_id"),
        {"in_code_tool_id": TOOL_IN_CODE_ID},
    ).fetchone()

    if not result:
        return

    conn.execute(
        sa.text("DELETE FROM persona__tool WHERE tool_id = :tool_id"),
        {"tool_id": result[0]},
    )
