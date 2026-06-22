import json
from pathlib import Path

BASE_DIR          = Path(__file__).resolve().parents[3]
HISTORY_PATH      = BASE_DIR / "storage" / "data" / "cauti_history.json"
_LEGACY_CURRENT   = BASE_DIR / "storage" / "data" / "cauti_current.json"
CASES_DIR         = BASE_DIR / "storage" / "data" / "CAUTI" / "cases"
MAX_CASE_QUARTERS = 8

_AR_TO_Q = {
    "الفصل الأول":  1, "الفصل الاول": 1,
    "الفصل الثاني": 2,
    "الفصل الثالث": 3,
    "الفصل الرابع": 4,
}


def _cases_file(quarter: str, year) -> Path:
    n = _AR_TO_Q.get(str(quarter).strip(), 0)
    return CASES_DIR / f"{year}_Q{n}.json"

_QUARTER_TO_AR = {
    1: "الفصل الاول",
    2: "الفصل الثاني",
    3: "الفصل الثالث",
    4: "الفصل الرابع",
}
_QUARTER_TO_INT = {v: k for k, v in _QUARTER_TO_AR.items()}
# Also handle hamza variants from older data
_QUARTER_TO_INT["الفصل الأول"]  = 1
_QUARTER_TO_INT["الفصل الأولى"] = 1


def _quarter_str(q) -> str:
    """Convert int quarter to Arabic string. Pass-through if already a string."""
    if isinstance(q, int):
        return _QUARTER_TO_AR.get(q, str(q))
    return q


def _quarter_int(q) -> int:
    """Convert Arabic quarter string to int for sorting."""
    if isinstance(q, int):
        return q
    return _QUARTER_TO_INT.get(q, 0)


def load_history():
    if not HISTORY_PATH.exists():
        return []
    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_history(history):
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def load_current():
    """Return the latest quarter's raw cases (newest per-quarter file, legacy fallback)."""
    if CASES_DIR.exists():
        files = sorted(CASES_DIR.glob("*.json"))
        if files:
            with open(files[-1], "r", encoding="utf-8") as f:
                return json.load(f)
    if _LEGACY_CURRENT.exists():
        with open(_LEGACY_CURRENT, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_current(data: dict):
    """Save raw cases to a per-quarter file and keep at most MAX_CASE_QUARTERS files."""
    path = _cases_file(data.get("quarter", ""), data.get("year", ""))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    files = sorted(CASES_DIR.glob("*.json"))
    for old in files[:-MAX_CASE_QUARTERS]:
        old.unlink(missing_ok=True)


def load_cases_for_quarter(quarter: str, year) -> dict:
    """Load individual cases for a specific quarter."""
    path = _cases_file(quarter, str(year))
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    # Fall back to legacy current file if quarter/year match
    if _LEGACY_CURRENT.exists():
        with open(_LEGACY_CURRENT, "r", encoding="utf-8") as f:
            legacy = json.load(f)
        if str(legacy.get("year")) == str(year) and _quarter_str(legacy.get("quarter")) == _quarter_str(quarter):
            return legacy
    return {"year": str(year), "quarter": quarter, "cases": []}


def list_case_quarters() -> list:
    """Return [{quarter, year}] for all stored case files, sorted oldest → newest."""
    result = []
    if CASES_DIR.exists():
        for f in sorted(CASES_DIR.glob("*.json")):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    d = json.load(fh)
                if d.get("quarter") and d.get("year"):
                    result.append({"quarter": d["quarter"], "year": d["year"]})
            except Exception:
                pass
    if not result and _LEGACY_CURRENT.exists():
        try:
            with open(_LEGACY_CURRENT, "r", encoding="utf-8") as f:
                d = json.load(f)
            if d.get("quarter") and d.get("year"):
                return [{"quarter": d["quarter"], "year": d["year"]}]
        except Exception:
            pass
    return result


def sort_history(history):
    return sorted(history, key=lambda x: (int(x["year"]), _quarter_int(x["quarter"])))


def _deduplicate(history):
    """Keep the last occurrence of each (year, quarter) pair."""
    seen = {}
    for entry in history:
        key = (str(entry["year"]), _quarter_str(entry["quarter"]))
        seen[key] = entry  # overwrite → last upload wins
    return list(seen.values())


def add_or_update_quarter(new_record):
    """
    Save year (string), quarter (Arabic string), summary, and germs_distribution to history.
    Only raw cases are saved separately in cauti_current.json.
    """
    # Normalise year → string, quarter → Arabic string
    new_record["year"]    = str(new_record["year"])
    new_record["quarter"] = _quarter_str(new_record["quarter"])

    # Move cases to the current file only — germs stay in history for comparison
    current_data = {
        "year":    new_record["year"],
        "quarter": new_record["quarter"],
        "cases":   new_record.pop("cases", []),
    }
    save_current(current_data)

    history = load_history()
    updated = False
    for i, record in enumerate(history):
        if str(record["year"]) == new_record["year"] and _quarter_str(record["quarter"]) == new_record["quarter"]:
            history[i] = new_record
            updated = True
            break

    if not updated:
        history.append(new_record)

    history = sort_history(_deduplicate(history))
    save_history(history)
    return history


def get_current_quarter():
    history = sort_history(load_history())
    return history[-1] if history else None
