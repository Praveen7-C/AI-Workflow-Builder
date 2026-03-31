from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import workflow, run, user, kb
from db.database import init_db
import os

app = FastAPI(
    title="GenAI Stack Backend",
    description="Backend with Supabase for AI workflows, knowledge bases, and chat.",
    version="2.0.0",
)

# Initialize DB on startup
@app.on_event("startup")
def on_startup():
    init_db()

# CORS - allow frontend
origins = [
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
   
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(workflow.router, prefix="/api/workflow", tags=["Workflow"])
app.include_router(run.router, prefix="/api", tags=["Run"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(kb.router, prefix="/api/kb", tags=["KnowledgeBase"])


@app.get("/")
async def root():
    return {"message": "GenAI Stack Backend (Supabase) is running."}

@app.get("/health")
async def health():
    return {"status": "ok"}