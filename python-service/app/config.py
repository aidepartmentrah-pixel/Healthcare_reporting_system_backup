"""
Configuration settings for Python service
"""

from pydantic_settings import BaseSettings
from typing import Optional
import hashlib
import json
import os
import secrets
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""

    # Server
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # Paths
    UPLOAD_DIR: str = "../storage/uploads"
    CHARTS_DIR: str = "../storage/charts"
    TEMP_DIR: str = "../storage/temp"
    TEMPLATES_DIR: str = "../shared/templates"

    # AI Settings (Phase 2)
    ENABLE_AI: bool = False
    MODEL_PATH: Optional[str] = "./models/flan-t5-base"
    MODEL_NAME: str = "google/flan-t5-base"

    # Processing
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: list = [".xlsx", ".xls"]

    # Excel Chart Export
    USE_EXCEL_EXPORT: bool = True
    POWERSHELL_SCRIPT: str = "../scripts/export-charts.ps1"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# ─── Config paths ─────────────────────────────────────────────────────────────

CONFIG_DIR   = Path("storage/config")
TARGETS_PATH = CONFIG_DIR / "targets.json"
ADMIN_PATH   = CONFIG_DIR / "admin.json"

# ─── Default values ───────────────────────────────────────────────────────────

DEFAULT_TARGETS: dict = {
    "mortality":  {"rate": 2.0},
    "medication": {"error_rate": 0.03},
    "vap": {
        "ICU": 25.0, "CCU": 15.0, "CSU": 9.5,
        "Ped": 5.5,  "ICN": 10.0, "ITU": 25.0,
    },
    "clabsi": {
        "ICU": 10.0, "CCU": 9.0, "CSU": 4.0,
        "ICN": 14.0, "Pediatric": 8.0, "ITU": 10.0,
    },
    "cauti": {
        "ICU": 4.5, "CCU": 4.5, "CSU": 4.5,
        "Ped": 1.6, "ICN": 4.5, "3rd West": 4.8, "ITU": 4.5,
    },
}

_DEFAULT_ADMIN_USERNAME = "admin"
_DEFAULT_ADMIN_PASSWORD = "admin123"

# ─── Password hashing (PBKDF2-SHA256) ─────────────────────────────────────────

def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 260_000
    ).hex()


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    return _hash_password(password, salt) == stored_hash

# ─── Targets helpers ──────────────────────────────────────────────────────────

def load_targets() -> dict:
    try:
        if TARGETS_PATH.exists():
            return json.loads(TARGETS_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {k: dict(v) for k, v in DEFAULT_TARGETS.items()}


def save_targets(data: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    TARGETS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

# ─── Admin credentials helpers ────────────────────────────────────────────────

def load_admin() -> dict:
    try:
        if ADMIN_PATH.exists():
            return json.loads(ADMIN_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def save_admin(data: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    ADMIN_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

# ─── Initialisation (called once on server startup) ───────────────────────────

def init_config_files() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    if not TARGETS_PATH.exists():
        save_targets(DEFAULT_TARGETS)

    if not ADMIN_PATH.exists():
        salt = secrets.token_hex(32)
        save_admin({
            "username":      _DEFAULT_ADMIN_USERNAME,
            "password_hash": _hash_password(_DEFAULT_ADMIN_PASSWORD, salt),
            "salt":          salt,
        })