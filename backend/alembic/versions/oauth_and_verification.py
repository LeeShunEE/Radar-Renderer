"""OAuth 和邮箱验证码扩展

Revision ID: oauth_and_verification
Revises: 9c1ffdfee6d6
Create Date: 2026-06-10

修改 users 表以支持 OAuth 登录和邮箱验证码注册：
- username/password_hash 改为 nullable（OAuth 用户可能无用户名/密码）
- 新增 is_verified（邮箱验证状态）
- 新增 display_name（OAuth 用户显示名称）

新增 oauth_accounts 表：支持多账户绑定
新增 verification_codes 表：邮箱验证码存储
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "oauth_and_verification"
down_revision: str | None = "9c1ffdfee6d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # === 修改 users 表（SQLite 需要使用 batch operations）===
    with op.batch_alter_table("users", schema=None) as batch_op:
        # username 改为 nullable
        batch_op.alter_column("username", existing_type=sa.String(64), nullable=True)
        # password_hash 改为 nullable
        batch_op.alter_column("password_hash", existing_type=sa.String(255), nullable=True)
        # 新增 is_verified 字段
        batch_op.add_column(sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
        # 新增 display_name 字段
        batch_op.add_column(sa.Column("display_name", sa.String(255), nullable=True))

    # === 创建 oauth_accounts 表 ===
    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("provider_user_id", sa.String(255), nullable=False),
        sa.Column("provider_email", sa.String(255), nullable=True),
        sa.Column("provider_display_name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
    )
    op.create_index(op.f("ix_oauth_accounts_user_id"), "oauth_accounts", ["user_id"], unique=False)

    # === 创建 verification_codes 表 ===
    op.create_table(
        "verification_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_verification_codes_email"), "verification_codes", ["email"], unique=False)


def downgrade() -> None:
    # === 删除 verification_codes 表 ===
    op.drop_index(op.f("ix_verification_codes_email"), table_name="verification_codes")
    op.drop_table("verification_codes")

    # === 删除 oauth_accounts 表 ===
    op.drop_index(op.f("ix_oauth_accounts_user_id"), table_name="oauth_accounts")
    op.drop_table("oauth_accounts")

    # === 恢复 users 表（SQLite 需要使用 batch operations）===
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("display_name")
        batch_op.drop_column("is_verified")
        batch_op.alter_column("password_hash", existing_type=sa.String(255), nullable=False)
        batch_op.alter_column("username", existing_type=sa.String(64), nullable=False)