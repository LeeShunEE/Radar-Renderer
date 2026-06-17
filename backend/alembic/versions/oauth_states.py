"""OAuth state（CSRF nonce）表

Revision ID: oauth_states
Revises: oauth_and_verification
Create Date: 2026-06-18

新增 oauth_states 表：发起授权时落库随机 state，回调时校验命中且未过期后即焚，
为 OAuth 登录/绑定提供 CSRF 防护。用 DB 而非进程内内存以兼容多 worker 部署。
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "oauth_states"
down_revision: str | None = "oauth_and_verification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "oauth_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_oauth_states_state"), "oauth_states", ["state"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_oauth_states_state"), table_name="oauth_states")
    op.drop_table("oauth_states")
