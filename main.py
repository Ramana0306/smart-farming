
from fastapi import FastAPI

from app.auth_routes import router as auth_router
from app.database import Base, engine
from app import models
from app import community_models
from app import knowledge_models
from app.community_routes import router as community_router
from app.assistant_routes import router as assistant_router
from fastapi.middleware.cors import CORSMiddleware


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Farming AI Assistant",
    description="Farming knowledge and community Q&A",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(community_router)
app.include_router(assistant_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to Smart Farming AI Assistant",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
