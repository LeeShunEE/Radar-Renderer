"""将 input_props 中用户上传的媒体 URL 改写为 worker 可加载的本地相对路径。

背景：用户上传的文件 URL（/api/v1/files/uploads/<name>）需鉴权，
但 Remotion worker 的 headless Chromium 无法带 Bearer token 发请求。
解决：提交渲染时把该文件复制到 worker publicDir 的临时子目录，
改写 URL 为 staticFile 可解析的相对路径，
渲染完成后清理临时目录。

适用范围：input_props 中 **任意层级、任意键名** 下的 string 值，
只要其值匹配 /api/v1/files/uploads/<name> 模式（含 silhouetteSrc、
background.media.src 等背景媒体字段）都会被改写。
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

# worker publicDir 下的挂载子目录名（Task 6.2 compose mount 的挂载点）。
# Docker 下 backend_storage 以只读方式挂载到 worker 的 publicDir/_user_media，
# 存储布局与 FileService 一致：_user_media/users/<uid>/uploads/<name>。
# 注意：该挂载在 **worker** 容器，backend 容器无此目录；backend 是否走零拷贝由
# 配置 worker_user_media_mount 决定，不靠探测本地文件系统（见 _try_rewrite）。
_MOUNT_SUBDIR = "_user_media"


def rewrite_uploaded_silhouettes(
    input_props: dict,
    *,
    user_id: int,
    file_service: FileService,
    public_dir: Path,
    use_mount: bool = False,
    static_server_url: str = "http://localhost:3100",
) -> tuple[dict, list[Path]]:
    """递归遍历 input_props，将 uploads URL 改写为 worker 可加载的 URL。

    返回 (改写后的深拷贝, 需清理的临时路径列表)。
    不修改原始 input_props。

    use_mount: worker 是否已只读挂载 backend_storage 到 publicDir/_user_media
        （部署事实，由调用方经配置传入；见 Settings.worker_user_media_mount）。
        为 true 时零拷贝，改写为 worker 静态服务器完整 HTTP URL；
        为 false 回退复制进 _render_tmp 并生成相对路径（供 staticFile 解析）。
    static_server_url: worker 静态服务器 URL（用于 serve _user_media 与 _render_tmp）。
        默认 http://localhost:3100（本地开发），Docker 部署应传入 worker 内网地址。
    """
    rewritten = copy.deepcopy(input_props)
    token = uuid.uuid4().hex
    tmp_files: list[Path] = []
    _walk_and_rewrite(rewritten, user_id=user_id, file_service=file_service,
                      public_dir=public_dir, token=token, tmp_files=tmp_files,
                      use_mount=use_mount, static_server_url=static_server_url)
    return rewritten, tmp_files


def cleanup_render_tmp(input_props: dict, public_dir: Path) -> None:
    """渲染完成后清理 _walk_and_rewrite 创建的临时目录。

    扫描 input_props 中所有以 ``_render_tmp/`` 开头的字段值，
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
    use_mount: bool,
    static_server_url: str,
) -> None:
    """递归遍历 dict/list，就地改写所有值为 uploads URL 的字段。

    按值而非键名匹配：任意键名下的 string 值，只要匹配 uploads URL 模式
    （_UPLOADS_URL_RE），就复制文件并改写为可加载的 URL。
    非 uploads URL 的 string（内置路径、颜色值等）由 _try_rewrite 返回 None，
    保持原值不变。
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str):
                new_val = _try_rewrite(
                    value, user_id=user_id, file_service=file_service,
                    public_dir=public_dir, token=token, tmp_files=tmp_files,
                    use_mount=use_mount, static_server_url=static_server_url,
                )
                if new_val is not None:
                    obj[key] = new_val
            else:
                _walk_and_rewrite(
                    value, user_id=user_id, file_service=file_service,
                    public_dir=public_dir, token=token, tmp_files=tmp_files,
                    use_mount=use_mount, static_server_url=static_server_url,
                )
    elif isinstance(obj, list):
        for item in obj:
            _walk_and_rewrite(
                item, user_id=user_id, file_service=file_service,
                public_dir=public_dir, token=token, tmp_files=tmp_files,
                use_mount=use_mount, static_server_url=static_server_url,
            )


def _try_rewrite(
    url: str,
    *,
    user_id: int,
    file_service: FileService,
    public_dir: Path,
    token: str,
    tmp_files: list[Path],
    use_mount: bool,
    static_server_url: str,
) -> str | None:
    """若 url 匹配 uploads URL 则改写，否则返回 None。

    方案 B 零拷贝：当 ``use_mount`` 为 true（worker 已将 backend_storage 只读挂载到
    其 publicDir/_user_media，部署事实由配置传入）时，生成 worker 静态服务器完整 HTTP URL，
    不复制文件、不写入 tmp_files。否则（本地裸进程开发，无挂载）回退复制进 ``_render_tmp``
    并生成相对路径（供 staticFile 解析）。
    无论哪条路径，都通过 ``get_upload_path`` 做文件名校验 + 存在性检查。
    """
    m = _UPLOADS_URL_RE.search(url)
    if not m:
        return None
    name = unquote(m.group(1))
    # get_upload_path 内部做 _validate_filename 校验（防路径穿越）
    # 并在文件不存在时抛 StoredFileNotFoundError。两条路径都走此校验，
    # 保证零拷贝路径不低于 copy 路径的安全性。
    src_path = file_service.get_upload_path(user_id, name)

    if use_mount:
        # worker 已挂载 backend_storage → 零拷贝。
        # 存储布局与 FileService 一致：users/<uid>/uploads/<name>。
        # 生成 worker 静态服务器完整 HTTP URL，供 Remotion 组件直接使用，
        # 绕过 staticFile 的 bundle 时复制限制。
        rel_path = f"{_MOUNT_SUBDIR}/users/{user_id}/uploads/{name}"
        return f"{static_server_url}/{rel_path}"

    # 回退：本地开发无挂载，复制进 _render_tmp 临时目录。
    rel = f"{_TMP_PREFIX}/{token}/{name}"
    dest = public_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_path, dest)
    tmp_files.append(dest)
    return rel


def _collect_tmp_tokens(obj: object, out: set[str]) -> None:
    """递归收集 input_props 中所有 _render_tmp/<token> 开头的字段 token。

    按值而非键名匹配：任意键名下的 string 值，只要以 _render_tmp/ 开头
    即提取 token（第二段路径分量）。
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str) and value.startswith(f"{_TMP_PREFIX}/"):
                # value = "_render_tmp/<token>/<name>"
                parts = value.split("/", 2)
                if len(parts) >= 2:
                    out.add(parts[1])
            else:
                _collect_tmp_tokens(value, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_tmp_tokens(item, out)
