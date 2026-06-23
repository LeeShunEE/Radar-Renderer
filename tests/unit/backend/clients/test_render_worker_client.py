"""clients/render_worker_client.py 单元测试（httpx 走 MockTransport，无真实出栈）。"""

import httpx
import pytest

from app.clients import render_worker_client as rwc
from app.clients.render_worker_client import RenderWorkerClient, WorkerRenderRequest
from app.core.exceptions import RenderFailedError


def _patch_transport(mocker, handler) -> None:
    transport = httpx.MockTransport(handler)
    real_cls = httpx.AsyncClient
    mocker.patch.object(
        rwc.httpx,
        "AsyncClient",
        side_effect=lambda **kwargs: real_cls(transport=transport, **kwargs),
    )


def _request() -> WorkerRenderRequest:
    return WorkerRenderRequest(
        task_id=7,
        mode="single",
        codec="h264",
        output_path="/out/x.mp4",
        input_props={"characterName": "Hero"},
    )


class TestRender:
    async def test_success(self, mocker):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/render"
            assert request.method == "POST"
            return httpx.Response(
                200, json={"outputPath": "/out/x.mp4", "durationMs": 1234}
            )

        _patch_transport(mocker, handler)
        client = RenderWorkerClient("http://worker:3100/", 10)
        result = await client.render(_request())
        assert result.output_path == "/out/x.mp4"
        assert result.duration_ms == 1234

    async def test_payload_includes_task_id(self, mocker):
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            import json

            captured.update(json.loads(request.content))
            return httpx.Response(
                200, json={"outputPath": "/out/x.mp4", "durationMs": 1}
            )

        _patch_transport(mocker, handler)
        client = RenderWorkerClient("http://worker:3100", 10)
        await client.render(_request())
        assert captured["taskId"] == 7

    async def test_non_2xx_raises(self, mocker):
        _patch_transport(mocker, lambda r: httpx.Response(500, text="boom"))
        client = RenderWorkerClient("http://worker:3100", 10)
        with pytest.raises(RenderFailedError):
            await client.render(_request())

    async def test_network_error_raises(self, mocker):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        _patch_transport(mocker, handler)
        client = RenderWorkerClient("http://worker:3100", 10)
        with pytest.raises(RenderFailedError):
            await client.render(_request())
