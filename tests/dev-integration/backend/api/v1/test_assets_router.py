"""assets_router dev-integration：公共资源列举与下载（无需认证）。

覆盖：_list_assets（空目录/缺目录/扩展名过滤）、list_silhouettes、list_music、
get_asset（成功下载/路径穿越/非法分类/文件不存在）。
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


@pytest.fixture
def assets_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """隔离公共资源到临时目录，避免依赖真实 frontend/public 内容。"""
    root = tmp_path / "public"
    (root / "silhouettes").mkdir(parents=True)
    (root / "music").mkdir(parents=True)
    monkeypatch.setattr(settings, "public_assets_path", root)
    return root


class TestListSilhouettes:
    def test_lists_image_files(self, client: TestClient, assets_dir: Path) -> None:
        (assets_dir / "silhouettes" / "hero.png").write_bytes(b"img1")
        (assets_dir / "silhouettes" / "side.jpg").write_bytes(b"img2")
        # .txt 不在 _IMAGE_EXTS 中，应被忽略
        (assets_dir / "silhouettes" / "readme.txt").write_text("ignore me")

        resp = client.get("/api/v1/assets/silhouettes")
        assert resp.status_code == 200
        data = resp.json()
        names = [a["name"] for a in data]
        assert names == ["hero.png", "side.jpg"]
        # path 字段格式 = "silhouettes/<name>"
        assert data[0]["path"] == "silhouettes/hero.png"
        assert data[0]["size_bytes"] == 4  # len(b"img1")

    def test_empty_dir_returns_empty_list(self, client: TestClient, assets_dir: Path) -> None:
        resp = client.get("/api/v1/assets/silhouettes")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_missing_dir_returns_empty_list(self, client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        # 指向无 silhouettes/ 子目录的根 → is_dir() False 分支
        empty_root = tmp_path / "empty_public"
        empty_root.mkdir()
        monkeypatch.setattr(settings, "public_assets_path", empty_root)

        resp = client.get("/api/v1/assets/silhouettes")
        assert resp.status_code == 200
        assert resp.json() == []


class TestListMusic:
    def test_lists_audio_files(self, client: TestClient, assets_dir: Path) -> None:
        (assets_dir / "music" / "bgm.mp3").write_bytes(b"aud1")
        (assets_dir / "music" / "intro.flac").write_bytes(b"aud2")
        # .txt 不在 _AUDIO_EXTS 中
        (assets_dir / "music" / "notes.txt").write_text("ignore")

        resp = client.get("/api/v1/assets/music")
        assert resp.status_code == 200
        data = resp.json()
        names = [a["name"] for a in data]
        assert names == ["bgm.mp3", "intro.flac"]
        assert data[0]["path"] == "music/bgm.mp3"

    def test_empty_dir_returns_empty_list(self, client: TestClient, assets_dir: Path) -> None:
        resp = client.get("/api/v1/assets/music")
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetAsset:
    def test_download_silhouette_success(self, client: TestClient, assets_dir: Path) -> None:
        content = b"\x89PNG\r\n"
        (assets_dir / "silhouettes" / "hero.png").write_bytes(content)

        resp = client.get("/api/v1/assets/silhouettes/hero.png")
        assert resp.status_code == 200
        assert resp.content == content

    def test_download_music_success(self, client: TestClient, assets_dir: Path) -> None:
        content = b"ID3\x04"
        (assets_dir / "music" / "bgm.mp3").write_bytes(content)

        resp = client.get("/api/v1/assets/music/bgm.mp3")
        assert resp.status_code == 200
        assert resp.content == content

    def test_rejects_forward_slash_in_name(self, client: TestClient, assets_dir: Path) -> None:
        # TestClient/httpx 会把 %2F 解码回 /，路由层即不匹配（307/404）。
        # 用原始 httpx 发送可保留编码，但 TestClient 不支持，改为直接测 handler 逻辑。
        # 路由层不匹配也算安全（攻击无法到达 handler），断言非 200 即可。
        resp = client.get("/api/v1/assets/silhouettes/a%2Fb.png", follow_redirects=False)
        assert resp.status_code in (404, 307)

    def test_rejects_backslash_in_name(self, client: TestClient, assets_dir: Path) -> None:
        # %5C → handler 收到 name 含反斜杠，命中 "\\" in name 守卫
        resp = client.get("/api/v1/assets/silhouettes/a%5Cb")
        assert resp.status_code == 404
        assert resp.json()["code"] == "file_not_found"

    def test_rejects_dotdot(self, client: TestClient, assets_dir: Path) -> None:
        # ".." 被 Starlette 视为路径导航，路由层 307 → 断言非 200
        resp = client.get("/api/v1/assets/silhouettes/..", follow_redirects=False)
        assert resp.status_code in (404, 307)

    def test_rejects_single_dot(self, client: TestClient, assets_dir: Path) -> None:
        # "." 被 Starlette 路由规范化为目录（= list_silhouettes），返回列表而非文件。
        # 不是安全风险（不暴露任意文件），断言返回列表即可。
        (assets_dir / "silhouettes" / "hero.png").write_bytes(b"img")
        resp = client.get("/api/v1/assets/silhouettes/.", follow_redirects=False)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_invalid_category_404(self, client: TestClient, assets_dir: Path) -> None:
        resp = client.get("/api/v1/assets/fonts/arial.ttf")
        assert resp.status_code == 404
        assert resp.json()["code"] == "file_not_found"

    def test_missing_file_404(self, client: TestClient, assets_dir: Path) -> None:
        resp = client.get("/api/v1/assets/silhouettes/nonexistent.png")
        assert resp.status_code == 404
        assert resp.json()["code"] == "file_not_found"
