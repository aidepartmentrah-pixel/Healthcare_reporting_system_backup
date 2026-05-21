"""
CAUTI targets per 1000 urinary catheter days.
Values are read live from storage/config/targets.json (editable via admin panel).
"""

from app.config import load_targets

_DEFAULTS = {
    "ICU":      4.5,
    "CCU":      4.5,
    "CSU":      4.5,
    "Ped":      1.6,
    "ICN":      4.5,
    "3rd West": 4.8,
    "ITU":      4.5,
}

# Static fallback used at import time (e.g. for DEPARTMENTS list)
CAUTI_TARGETS = _DEFAULTS
DEPARTMENTS   = list(_DEFAULTS.keys())


def get_cauti_targets() -> dict:
    """Return live CAUTI targets from config JSON."""
    return load_targets().get("cauti", _DEFAULTS)
