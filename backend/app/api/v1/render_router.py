"""渲染提交路由。"""

from fastapi import APIRouter, status

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.render import RenderSubmitRequest, RenderTaskResponse
from app.service.queue_service import render_queue
from app.service.render_service import RenderService

router = APIRouter(prefix="/render", tags=["render"])


@router.post(
    "", response_model=RenderTaskResponse, status_code=status.HTTP_201_CREATED
)
async def submit_render(
    current_user: CurrentUserDep,
    payload: RenderSubmitRequest,
    session: SessionDep,
) -> RenderTaskResponse:
    service = RenderService(session, render_queue)
    task = await service.submit(
        user_id=current_user.id,
        mode=payload.mode,
        codec=payload.codec,
        input_props=payload.input_props,
    )
    return RenderTaskResponse.from_domain(task)
