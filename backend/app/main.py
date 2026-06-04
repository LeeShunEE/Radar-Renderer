from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.lifespan import lifespan

app = FastAPI(
    title="Radar Chart Rendering API",
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api/v1")