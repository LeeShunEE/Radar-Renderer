"""任务查询与删除路由。"""

from fastapi import APIRouter, status

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.task import TaskListResponse, TaskResponse
from app.service.queue_service import render_queue
from app.service.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    current_user: CurrentUserDep, session: SessionDep
) -> TaskListResponse:
    service = TaskService(session, render_queue)
    queue_size, views = await service.list_for_user(current_user.id)
    return TaskListResponse(
        queue_size=queue_size,
        tasks=[TaskResponse.from_domain(v) for v in views],
        avg_fps=render_queue.average_fps(),
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TaskResponse:
    service = TaskService(session, render_queue)
    view = await service.get_for_user(task_id, current_user.id)
    return TaskResponse.from_domain(view)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> None:
    service = TaskService(session, render_queue)
    await service.delete_for_user(task_id, current_user.id)
