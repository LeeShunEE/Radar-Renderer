from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import BusinessError
from app.core.lifespan import lifespan

app = FastAPI(
    title="Radar Chart Rendering API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessError)
async def business_error_handler(_request: Request, exc: BusinessError) -> JSONResponse:
    """将业务异常统一映射为带 code 的 HTTP 响应。"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "code": exc.code},
    )


app.include_router(api_router, prefix=settings.api_prefix)
