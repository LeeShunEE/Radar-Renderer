"""service/seed_service.py 单元测试（DAO 全 mock）。"""

from unittest.mock import AsyncMock, patch

from app.service import seed_service
from app.service.seed_service import seed_dev_account


class TestSeedDevAccount:
    async def test_skips_when_not_testing(self, monkeypatch):
        """生产环境（testing=False）不构造 DAO、不创建账户。"""
        monkeypatch.setattr(seed_service.settings, "testing", False)
        with patch.object(seed_service, "UserDAO") as dao_cls:
            await seed_dev_account(AsyncMock())
        dao_cls.assert_not_called()

    async def test_creates_when_absent(self, monkeypatch):
        """testing=True 且账户不存在时，按配置创建已验证账户。"""
        monkeypatch.setattr(seed_service.settings, "testing", True)
        monkeypatch.setattr(seed_service.settings, "dev_seed_username", "dev")
        monkeypatch.setattr(seed_service.settings, "dev_seed_email", "dev@test.com")
        dao = AsyncMock()
        dao.exists_by_username.return_value = False
        dao.exists_by_email.return_value = False
        with patch.object(seed_service, "UserDAO", return_value=dao):
            await seed_dev_account(AsyncMock())

        dao.create.assert_awaited_once()
        kwargs = dao.create.await_args.kwargs
        assert kwargs["username"] == "dev"
        assert kwargs["email"] == "dev@test.com"
        assert kwargs["is_verified"] is True
        # 密码以哈希形式落库，不存明文
        assert kwargs["password_hash"]
        assert kwargs["password_hash"] != "dev12345"

    async def test_skips_when_username_exists(self, monkeypatch):
        """用户名已存在时跳过（幂等），不重复创建。"""
        monkeypatch.setattr(seed_service.settings, "testing", True)
        dao = AsyncMock()
        dao.exists_by_username.return_value = True
        dao.exists_by_email.return_value = False
        with patch.object(seed_service, "UserDAO", return_value=dao):
            await seed_dev_account(AsyncMock())
        dao.create.assert_not_called()

    async def test_skips_when_email_exists(self, monkeypatch):
        """邮箱已被占用时跳过，避免唯一约束冲突。"""
        monkeypatch.setattr(seed_service.settings, "testing", True)
        dao = AsyncMock()
        dao.exists_by_username.return_value = False
        dao.exists_by_email.return_value = True
        with patch.object(seed_service, "UserDAO", return_value=dao):
            await seed_dev_account(AsyncMock())
        dao.create.assert_not_called()
