"""silhouette_rewrite 单元测试：uploads URL → worker 可加载 URL 改写 + 清理。"""

import shutil
from pathlib import Path

import pytest

from app.core.config import settings
from app.service.file_service import FileService
from app.service.silhouette_rewrite import (
    cleanup_render_tmp,
    rewrite_uploaded_silhouettes,
)

# 匹配 api-client.ts 的 downloadUpload 格式。
UPLOADS_URL = "http://localhost:8000/api/v1/files/uploads/hero.png"
# 默认静态服务器 URL（测试用）
STATIC_SERVER_URL = "http://localhost:3100"


@pytest.fixture
def file_service(tmp_path: Path) -> FileService:
    """用临时目录构造 FileService，并放入一个上传文件。"""
    fs = FileService(tmp_path, max_user_bytes=10_000_000)
    fs.save_upload(user_id=1, filename="hero.png", data=b"\x89PNG")
    return fs


@pytest.fixture
def public_dir(tmp_path: Path) -> Path:
    d = tmp_path / "public"
    d.mkdir()
    return d


class TestRewriteSingle:
    def test_rewrites_uploads_url(self, file_service: FileService, public_dir: Path) -> None:
        props = {"silhouetteSrc": UPLOADS_URL, "characterName": "test"}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["silhouetteSrc"].startswith("_render_tmp/")
        assert rewritten["silhouetteSrc"].endswith("/hero.png")
        assert rewritten["characterName"] == "test"
        assert len(tmp_files) == 1
        assert tmp_files[0].is_file()

    def test_does_not_modify_original(self, file_service: FileService, public_dir: Path) -> None:
        props = {"silhouetteSrc": UPLOADS_URL}
        rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert props["silhouetteSrc"] == UPLOADS_URL  # 原始未被改

    def test_leaves_non_uploads_url_untouched(self, file_service: FileService, public_dir: Path) -> None:
        props = {"silhouetteSrc": "silhouettes/builtin.png"}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["silhouetteSrc"] == "silhouettes/builtin.png"
        assert tmp_files == []

    def test_leaves_empty_string_untouched(self, file_service: FileService, public_dir: Path) -> None:
        props = {"silhouetteSrc": ""}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["silhouetteSrc"] == ""
        assert tmp_files == []


class TestRewriteMulti:
    def test_rewrites_nested_in_pages(self, file_service: FileService, public_dir: Path) -> None:
        props = {
            "config": {
                "pages": [
                    {"silhouetteSrc": UPLOADS_URL, "characterName": "p1"},
                    {"silhouetteSrc": "silhouettes/builtin.png", "characterName": "p2"},
                ],
            }
        }
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        page1 = rewritten["config"]["pages"][0]
        page2 = rewritten["config"]["pages"][1]
        assert page1["silhouetteSrc"].startswith("_render_tmp/")
        assert page2["silhouetteSrc"] == "silhouettes/builtin.png"
        assert len(tmp_files) == 1

    def test_rewrites_global_override(self, file_service: FileService, public_dir: Path) -> None:
        props = {
            "config": {
                "globalOverride": {
                    "values": {"silhouetteSrc": UPLOADS_URL},
                },
            }
        }
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        val = rewritten["config"]["globalOverride"]["values"]["silhouetteSrc"]
        assert val.startswith("_render_tmp/")
        assert len(tmp_files) == 1


class TestCleanup:
    def test_cleanup_removes_tmp_dir(self, file_service: FileService, public_dir: Path) -> None:
        props = {"silhouetteSrc": UPLOADS_URL}
        rewritten, _ = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        rel = rewritten["silhouetteSrc"]
        tmp_dir = public_dir / rel.split("/")[0] / rel.split("/")[1]
        assert tmp_dir.is_dir()

        cleanup_render_tmp(rewritten, public_dir)
        assert not tmp_dir.exists()

    def test_cleanup_noop_when_no_uploads(self, public_dir: Path) -> None:
        props = {"silhouetteSrc": "silhouettes/builtin.png"}
        # 不应抛异常
        cleanup_render_tmp(props, public_dir)


class TestRewriteBackgroundMedia:
    def test_rewrites_background_media_src(self, file_service: FileService, public_dir: Path) -> None:
        props = {"background": {"type": "video", "media": {"src": UPLOADS_URL}}}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["background"]["media"]["src"].startswith("_render_tmp/")
        assert rewritten["background"]["media"]["src"].endswith("/hero.png")
        assert len(tmp_files) == 1

    def test_cleanup_removes_background_media_tmp(self, file_service: FileService, public_dir: Path) -> None:
        props = {"background": {"media": {"src": UPLOADS_URL}}}
        rewritten, _ = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        rel = rewritten["background"]["media"]["src"]
        tmp_dir = public_dir / rel.split("/")[0] / rel.split("/")[1]
        assert tmp_dir.is_dir()
        cleanup_render_tmp(rewritten, public_dir)
        assert not tmp_dir.exists()

    def test_rewrites_both_silhouette_and_background(self, file_service: FileService, public_dir: Path) -> None:
        # 同一 props 中剪影 + 背景媒体都应被改写
        props = {"silhouetteSrc": UPLOADS_URL, "background": {"media": {"src": UPLOADS_URL}}}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["silhouetteSrc"].startswith("_render_tmp/")
        assert rewritten["background"]["media"]["src"].startswith("_render_tmp/")
        assert len(tmp_files) == 2


class TestMountZeroCopy:
    """零拷贝由 use_mount 标志（部署配置）控制，而非探测本地文件系统。

    backend 与 worker 是不同容器，_user_media 挂载只存在于 worker；backend 靠
    配置 worker_user_media_mount 得知该挂载是否存在（见 silhouette_rewrite._try_rewrite）。
    use_mount=True 时生成 worker 静态服务器完整 HTTP URL（绕过 staticFile 的 bundle 时复制限制）。
    """

    def test_uses_mount_http_url_when_use_mount_true(self, file_service: FileService, public_dir: Path) -> None:
        props = {"silhouetteSrc": UPLOADS_URL}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
            use_mount=True, static_server_url=STATIC_SERVER_URL,
        )
        assert rewritten["silhouetteSrc"] == "http://localhost:3100/_user_media/users/1/uploads/hero.png"
        assert tmp_files == []  # 零拷贝，无临时文件

    def test_background_media_uses_mount_http_url(self, file_service: FileService, public_dir: Path) -> None:
        props = {"background": {"media": {"src": UPLOADS_URL}}}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
            use_mount=True, static_server_url=STATIC_SERVER_URL,
        )
        assert rewritten["background"]["media"]["src"] == "http://localhost:3100/_user_media/users/1/uploads/hero.png"
        assert tmp_files == []

    def test_falls_back_to_copy_when_use_mount_false(self, file_service: FileService, public_dir: Path) -> None:
        # 无挂载（本地裸进程开发，use_mount 默认 False）→ 回退 copy，生成相对路径
        props = {"silhouetteSrc": UPLOADS_URL}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
        )
        assert rewritten["silhouetteSrc"].startswith("_render_tmp/")
        assert len(tmp_files) == 1
        assert tmp_files[0].is_file()

    def test_mount_path_still_validates_file_exists(self, file_service: FileService, public_dir: Path) -> None:
        # 即使走挂载零拷贝路径，get_upload_path 也会对不存在的文件抛 StoredFileNotFoundError。
        # 这保证零拷贝路径不低于 copy 路径的安全性。
        bad = "http://localhost:8000/api/v1/files/uploads/nonexistent.png"
        props = {"silhouetteSrc": bad}
        with pytest.raises(Exception):
            rewrite_uploaded_silhouettes(
                props, user_id=1, file_service=file_service, public_dir=public_dir,
                use_mount=True, static_server_url=STATIC_SERVER_URL,
            )

    def test_cleanup_noop_for_mount_paths(self, file_service: FileService, public_dir: Path) -> None:
        # 挂载路径（http://localhost:3100/_user_media/...）不在 _collect_tmp_tokens 扫描范围内，cleanup 是 no-op。
        props = {"silhouetteSrc": UPLOADS_URL}
        rewritten, tmp_files = rewrite_uploaded_silhouettes(
            props, user_id=1, file_service=file_service, public_dir=public_dir,
            use_mount=True, static_server_url=STATIC_SERVER_URL,
        )
        assert tmp_files == []
        # cleanup 不应抛异常（挂载 HTTP URL 不被当作 tmp 清理）
        cleanup_render_tmp(rewritten, public_dir)
