"""
Admin API Routes
POST /api/admin/login           — validate credentials, return session token
POST /api/admin/logout          — invalidate token
GET  /api/admin/targets         — return all targets (public, used by dashboards)
PUT  /api/admin/targets         — update targets (requires token)
PUT  /api/admin/credentials     — change username + password (requires token)
"""

import secrets
from fastapi import APIRouter, HTTPException, Header
from loguru import logger

from app.config import (
    load_targets, save_targets, DEFAULT_TARGETS,
    load_admin, save_admin,
    verify_password, _hash_password,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ── In-memory token store ─────────────────────────────────────────────────────
_active_tokens: set[str] = set()


def _require_token(authorization: str = "") -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization[7:]
    if token not in _active_tokens:
        raise HTTPException(401, "Invalid or expired session. Please log in again.")
    return token


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def admin_login(body: dict):
    username = body.get("username", "")
    password = body.get("password", "")

    admin = load_admin()
    if not admin:
        raise HTTPException(500, "Admin config not initialised. Restart the server.")

    if username != admin.get("username") or not verify_password(
        password, admin["salt"], admin["password_hash"]
    ):
        raise HTTPException(401, "Invalid username or password.")

    token = secrets.token_urlsafe(32)
    _active_tokens.add(token)
    logger.info("Admin logged in")
    return {"token": token}


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def admin_logout(authorization: str = Header(default="")):
    token = _require_token(authorization)
    _active_tokens.discard(token)
    return {"success": True}


# ── Targets — public GET ──────────────────────────────────────────────────────

@router.get("/targets")
async def get_targets():
    """Public endpoint — dashboards fetch current targets from here."""
    return load_targets()


# ── Targets — protected PUT ───────────────────────────────────────────────────

@router.put("/targets")
async def update_targets(body: dict, authorization: str = Header(default="")):
    _require_token(authorization)

    current = load_targets()

    for module, values in body.items():
        if module not in DEFAULT_TARGETS:
            raise HTTPException(400, f"Unknown module '{module}'")
        if not isinstance(values, dict):
            raise HTTPException(400, f"Values for '{module}' must be an object")
        for key, val in values.items():
            if not isinstance(val, (int, float)):
                raise HTTPException(400, f"Target '{module}.{key}' must be a number")
        current[module] = values

    save_targets(current)
    logger.info("Admin updated targets")
    return {"success": True, "targets": current}


# ── Credentials — protected PUT ───────────────────────────────────────────────

@router.put("/credentials")
async def update_credentials(body: dict, authorization: str = Header(default="")):
    token = _require_token(authorization)

    new_username = body.get("username", "").strip()
    new_password = body.get("password", "").strip()

    if not new_username:
        raise HTTPException(400, "Username cannot be empty.")
    if len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    import secrets as _s
    salt = _s.token_hex(32)
    save_admin({
        "username":      new_username,
        "password_hash": _hash_password(new_password, salt),
        "salt":          salt,
    })

    # Invalidate all sessions so re-login is required with new credentials
    _active_tokens.clear()
    logger.info("Admin credentials updated — all sessions invalidated")
    return {"success": True, "message": "Credentials updated. Please log in again."}
