"""
CLABSI targets per 1,000 catheter days.
Values are read live from storage/config/targets.json (editable via admin panel).
"""

from app.config import load_targets

_DEFAULTS = {
    "ICU":       10.0,
    "CCU":        9.0,
    "CSU":        4.0,
    "ICN":       14.0,
    "Pediatric":  8.0,
    "ITU":       10.0,
}

# Static fallback used at import time (e.g. for DEPARTMENTS list)
CLABSI_TARGETS = _DEFAULTS
DEPARTMENTS    = list(_DEFAULTS.keys())


def get_clabsi_targets() -> dict:
    """Return live CLABSI targets from config JSON."""
    return load_targets().get("clabsi", _DEFAULTS)
