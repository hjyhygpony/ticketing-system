import asyncio
from contextlib import suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from . import config
from .auth_api import router as auth_router
from .show_api import router as show_router
from .user_api import router as user_router
from .forum_api import router as forum_router, ensure_forum_schema, seed_forum_demo_data
from .transaction_api import (
    router as transaction_router,
    ensure_transaction_schema,
    run_transaction_maintenance,
)


app = FastAPI(title=config.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=config.API_PREFIX)
app.include_router(user_router, prefix=config.API_PREFIX)
app.include_router(show_router, prefix=config.API_PREFIX)
app.include_router(forum_router, prefix=config.API_PREFIX)
app.include_router(transaction_router, prefix=config.API_PREFIX)


TRANSACTION_MAINTENANCE_INTERVAL_SECONDS = 30


async def transaction_maintenance_loop():
    while True:
        try:
            await asyncio.to_thread(run_transaction_maintenance)
        except Exception as exc:
            print("transaction maintenance failed:", repr(exc))
        await asyncio.sleep(TRANSACTION_MAINTENANCE_INTERVAL_SECONDS)


@app.on_event("startup")
def startup_forum_schema():
    ensure_forum_schema()
    ensure_transaction_schema()
    seed_forum_demo_data()


@app.on_event("startup")
async def startup_transaction_maintenance():
    app.state.transaction_maintenance_task = asyncio.create_task(transaction_maintenance_loop())


@app.on_event("shutdown")
async def shutdown_transaction_maintenance():
    task = getattr(app.state, "transaction_maintenance_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@app.get("/")
def root():
    return {"message": "Ticketing A Service is running"}


@app.get(config.API_PREFIX + "/health")
def health():
    return {"code": 0, "message": "ok", "data": {"service": config.APP_NAME}}


if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
