from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_database
from .routers import history, messages, mysql, references


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title="HL7 AI Workbench API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(messages.router)
app.include_router(references.router)
app.include_router(mysql.router)
app.include_router(history.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "HL7 AI Workbench API"}
