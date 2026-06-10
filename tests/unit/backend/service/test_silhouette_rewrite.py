"""silhouette_rewrite 单元测试：uploads URL → staticFile 相对路径改写 + 清理。"""

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
