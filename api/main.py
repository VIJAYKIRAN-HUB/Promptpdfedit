import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.database import init_db
from api.routers import documents, edit_plans, cron, conversions

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is initialized on startup
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database auto-init error: {e}")
    yield


app = FastAPI(
    title="PromptPDF API",
    description="High-precision AI-powered PDF editing engine with PyMuPDF and side-by-side verification.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# CORS configuration to allow local Vite frontend and Vercel domains
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://*.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for flexible serverless testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(documents.router)
app.include_router(edit_plans.router)
app.include_router(cron.router)
app.include_router(conversions.router)


@app.get("/api/health")
@app.get("/api")
def health_check():
    """Health check endpoint to verify backend status and configuration."""
    has_db = bool(os.getenv("DATABASE_URL"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    has_gemini = bool(os.getenv("GEMINI_API_KEY"))

    return {
        "status": "healthy",
        "service": "PromptPDF Engine",
        "version": "1.0.0",
        "features": {
            "database_configured": has_db,
            "openai_configured": has_openai,
            "gemini_configured": has_gemini,
            "storage_directory": os.getenv("STORAGE_DIR", "/tmp")
        }
    }


# Mount production React build if dist exists (for Docker, Render, Railway unified deployments)
try:
    from fastapi.staticfiles import StaticFiles
    dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
    if not os.getenv("VERCEL") and os.path.exists(dist_dir) and os.path.exists(os.path.join(dist_dir, "index.html")):
        app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
except Exception as e:
    print(f"Notice: Static files mount skipped: {e}")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
