"""
Healthcare Quality Indicators - Python Service
FastAPI application covering Mortality, Medication Error, VAP, CLABSI, CAUTI
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys
import os

# Import API routes
from app.api.mortality_routes import router as mortality_router
from app.api.medication_routes import router as medication_router
from app.api.vap_routes import router as vap_router
from app.api.clabsi_routes import router as clabsi_router
from app.api.cauti_routes import router as cauti_router
from app.api.admin_routes import router as admin_router

# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="INFO"
)

# Create logs directory
os.makedirs("logs", exist_ok=True)
logger.add(
    "logs/python-service.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)

# Create FastAPI app
app = FastAPI(
    title="Healthcare Quality Indicators API",
    description="Data processing and report generation for Mortality, Medication Error, VAP, CLABSI, CAUTI",
    version="2.0.0",
    docs_url="/docs"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(mortality_router, prefix="/api")
app.include_router(medication_router, prefix="/api/medication")
app.include_router(vap_router)          # prefix "/api/vap" already set in the router
app.include_router(clabsi_router)       # prefix "/api/clabsi" already set in the router
app.include_router(cauti_router)        # prefix "/api/cauti" already set in the router
app.include_router(admin_router)        # prefix "/api/admin" already set in the router


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "healthcare-quality-indicators",
        "version": "2.0.0",
        "modules": ["mortality", "medication", "vap", "clabsi", "cauti"],
    }


@app.on_event("startup")
async def startup_event():
    """Initialize service"""
    from app.config import init_config_files
    init_config_files()

    logger.info("=" * 60)
    logger.info("Healthcare Quality Indicators — Python Service v2.0")
    logger.info("=" * 60)
    logger.info("Modules loaded: Mortality | Medication | VAP | CLABSI | CAUTI")

    # Check AI availability
    try:
        from llama_cpp import Llama  # noqa: F401
        ai_status = "available (llama-cpp-python installed)"
    except ImportError:
        ai_status = "unavailable (llama-cpp-python not installed — static fallback active)"
    logger.info(f"AI service: {ai_status}")

    # Create directories
    os.makedirs("../storage/uploads", exist_ok=True)
    os.makedirs("../storage/charts", exist_ok=True)
    os.makedirs("../storage/temp", exist_ok=True)

    logger.success("Service ready on http://localhost:8000")
    logger.info("API Docs: http://localhost:8000/docs")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup"""
    logger.info("Shutting down Healthcare Quality Indicators service")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )