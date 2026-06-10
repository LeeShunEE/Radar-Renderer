"""将 input_props 中用户上传的剪影 URL 改写为 worker 可加载的本地相对路径。

背景：用户上传的自定义剪影图 URL（/api/v1/files/uploads/<name>）需鉴权，
但 Remotion worker 的 headless Chromium 无法带 Bearer token 发请求。
解决：提交渲染时把该文件复制到 worker publicDir 的临时子目录，
改写 silhouetteSrc 为 staticFile 可解析的相对路径（Silhouette.tsx 已支持），
渲染完成后清理临时目录。
"""

import copy
import re
import shutil
import uuid
from pathlib import Path
from urllib.parse import unquote

from app.service.file_service import FileService

# 匹配 /api/v1/files/uploads/<name> 的路径尾部（URL 可能带 host:port）。
_UPLOADS_URL_RE = re.compile(r"/api/v1/files/uploads/([^/?#]+)$")

# 临时子目录前缀（相对于 worker publicDir）。
_TMP_PREFIX = "_render_tmp"


def rewrite_uploaded_silhouettes(
    input_props: dict,
    *,
    user_id: int,
    file_service: FileService,
    public_dir: Path,
) -> tuple[dict, list[Path]]:
    """递归遍历 input_props，将 uploads URL 改写为 staticFile 相对路径。

    返回 (改写后的深拷贝, 需清理的临时路径列表)。
    不修改原始 input_props。
    """
    rewritten = copy.deepcopy(input_props)
    token = uuid.uuid4().hex
    tmp_files: list[Path] = []
    _walk_and_rewrite(rewritten, user_id=user_id, file_service=file_service,
                      public_dir=public_dir, token=token, tmp_files=tmp_files)
    return rewritten, tmp_files


def cleanup_render_tmp(input_props: dict, public_dir: Path) -> None:
    """渲染完成后清理 _walk_and_rewrite 创建的临时目录。

    扫描 input_props 中以 ``_render_tmp/`` 开头的 silhouetteSrc，
    对其 token 级目录做 rmtree（同 token 下的多个文件共享一个目录）。
    """
    cleaned_tokens: set[str] = set()
    _collect_tmp_tokens(input_props, cleaned_tokens)
    for token in cleaned_tokens:
        tmp_dir = public_dir / _TMP_PREFIX / token
        if tmp_dir.is_dir():
            shutil.rmtree(tmp_dir, ignore_errors=True)


def _walk_and_rewrite(
    obj: object,
    *,
    user_id: int,
    file_service: FileService,
    public_dir: Path,
    token: str,
    tmp_files: list[Path],
) -> None:
    """递归遍历 dict/list，就地改写 silhouetteSrc 字段。"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key == "silhouetteSrc" and isinstance(value, str):
                new_val = _try_rewrite(
                    value, user_id=user_id, file_service=file_service,
                    public_dir=public_dir, token=token, tmp_files=tmp_files,
                )
                if new_val is not None:
                    obj[key] = new_val
            else:
                _walk_and_rewrite(
                    value, user_id=user_id, file_service=file_service,
                    public_dir=public_dir, token=token, tmp_files=tmp_files,
                )
    elif isinstance(obj, list):
        for item in obj:
            _walk_and_rewrite(
                item, user_id=user_id, file_service=file_service,
                public_dir=public_dir, token=token, tmp_files=tmp_files,
            )


def _try_rewrite(
    url: str,
    *,
    user_id: int,
    file_service: FileService,
    public_dir: Path,
    token: str,
    tmp_files: list[Path],
) -> str | None:
    """若 url 匹配 uploads URL 则改写，否则返回 None。"""
    m = _UPLOADS_URL_RE.search(url)
    if not m:
        return None
    name = unquote(m.group(1))
    # get_upload_path 内部会做 _validate_filename 校验，防止路径穿越。
    src_path = file_service.get_upload_path(user_id, name)
    rel = f"{_TMP_PREFIX}/{token}/{name}"
    dest = public_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_path, dest)
    tmp_files.append(dest)
    return rel


def _collect_tmp_tokens(obj: object, out: set[str]) -> None:
    """递归收集 input_props 中 _render_tmp/<token> 开头的 silhouetteSrc token。"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key == "silhouetteSrc" and isinstance(value, str) and value.startswith(f"{_TMP_PREFIX}/"):
                # value = "_render_tmp/<token>/<name>"
                parts = value.split("/", 2)
                if len(parts) >= 2:
                    out.add(parts[1])
            else:
                _collect_tmp_tokens(value, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_tmp_tokens(item, out)
