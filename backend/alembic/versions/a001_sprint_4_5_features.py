"""Sprint 4 Budget and Sprint 5 Tool Seeding

Revision ID: a001_sprint_4_5_features
Revises: ffc707a226b4
Create Date: 2026-04-02 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a001_sprint_4_5_features"
down_revision = "ffc707a226b4"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create Budget table
    op.create_table(
        "budget",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("balance", sa.Float(), default=0.0, nullable=False),
        sa.Column("total_spent", sa.Float(), default=0.0, nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. Seed Presentations Tool
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO tool (name, display_name, description, in_code_tool_id, enabled) "
            "VALUES (:name, :display_name, :description, :in_code_tool_id, :enabled)"
        ),
        {
            "name": "generate_presentation",
            "display_name": "Presentations Generator",
            "description": "Generates a professional HTML presentation (slides) using Reveal.js.",
            "in_code_tool_id": "PresentationsTool",
            "enabled": True,
        }
    )

def downgrade() -> None:
    # 1. Remove Presentations Tool
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM tool WHERE in_code_tool_id = 'PresentationsTool'")
    )

    # 2. Drop Budget table
    op.drop_table("budget")
