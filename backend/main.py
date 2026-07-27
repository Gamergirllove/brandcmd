import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from app.config import get_settings
from app.routers import analytics, auth, connect, goals, profile
from app.services.platform_factory import list_supported_platforms
from app.services.platform_router import is_configured

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configured = [p for p in list_supported_platforms() if is_configured(p)]
    logger.info("BrandCommand API starting — frontend: %s", settings.frontend_url)
    logger.info(
        "OAuth configured for: %s", ", ".join(configured) if configured else "no platforms"
    )
    missing = [p for p in ("twitch", "youtube") if p not in configured]
    if missing:
        # These two drive the MVP dashboard; surface it loudly at boot rather
        # than as a 503 the first time someone clicks Connect.
        logger.warning("MVP platform credentials missing: %s", ", ".join(missing))
    yield
    logger.info("BrandCommand API shutting down")


app = FastAPI(
    title="BrandCommand API",
    description=(
        "Creator intelligence API — aggregates analytics across Twitch, YouTube, "
        "Instagram, TikTok, X, Pinterest, LinkedIn, Facebook and Snapchat."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
settings = get_settings()

# Deduplicate while preserving order — a repeated origin makes the header invalid.
_origins = list(
    dict.fromkeys(
        [
            settings.frontend_url.rstrip("/"),
            "http://localhost:3000",
            "http://localhost:3001",
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(connect.router)
app.include_router(analytics.router)
app.include_router(goals.router)
app.include_router(profile.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "platforms_configured": [p for p in list_supported_platforms() if is_configured(p)],
    }


@app.get("/", tags=["root"])
async def root():
    return {
        "name": "BrandCommand API",
        "docs": "/docs",
        "health": "/health",
    }
