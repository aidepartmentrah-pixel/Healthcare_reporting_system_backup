"""
VAP Historical Data Manager
Stores per-quarter, per-floor VAP statistics in VAP_history.json.
Mirrors MedicationErrorHistory pattern.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from loguru import logger

STANDARD_FLOORS = ["ICU", "CCU", "CSU", "Ped", "ICN", "ITU"]

FLOOR_TARGETS = {
    "ICU":  25.0,
    "CCU":  15.0,
    "CSU":   9.5,
    "Ped":   5.5,
    "ICN":  10.0,
    "ITU":  25.0,
}


def get_vap_targets() -> dict:
    """Return live VAP targets from config JSON."""
    from app.config import load_targets
    return load_targets().get("vap", FLOOR_TARGETS)


HISTORY_PATH      = Path("storage/data/VAP_history.json")
CASES_DIR         = Path("storage/data/VAP/cases")
_LEGACY_CURRENT   = Path("storage/data/VAP_current.json")
MAX_CASE_QUARTERS = 8

# Arabic quarter name → Q number used in filenames
_AR_TO_Q = {
    "الفصل الأول":  1, "الفصل الاول": 1,
    "الفصل الثاني": 2,
    "الفصل الثالث": 3,
    "الفصل الرابع": 4,
}


def _cases_file(quarter: str, year) -> Path:
    """Return the per-quarter cases file path, e.g. storage/data/VAP/cases/2025_Q3.json."""
    n = _AR_TO_Q.get(str(quarter).strip(), 0)
    return CASES_DIR / f"{year}_Q{n}.json"


def load_history() -> list:
    """Load VAP history from JSON (module-level, mirrors CLABSI/CAUTI pattern)."""
    if not HISTORY_PATH.exists():
        return []
    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_current() -> dict:
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


def save_current(data: dict) -> None:
    """Save raw cases to a per-quarter file and keep at most MAX_CASE_QUARTERS files."""
    path = _cases_file(data.get("quarter", ""), data.get("year", ""))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # Trim oldest files beyond the limit
    files = sorted(CASES_DIR.glob("*.json"))
    for old in files[:-MAX_CASE_QUARTERS]:
        old.unlink(missing_ok=True)


def load_cases_for_quarter(quarter: str, year) -> dict:
    """Load individual cases for a specific quarter. Returns empty cases list if not found."""
    path = _cases_file(quarter, str(year))
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
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


# Map English/numeric quarter input → Arabic display name stored in JSON
QUARTER_AR = {
    # English (any case handled by _to_arabic_quarter lowercasing)
    "first":          "الفصل الأول",
    "second":         "الفصل الثاني",
    "third":          "الفصل الثالث",
    "fourth":         "الفصل الرابع",
    "1":              "الفصل الأول",
    "2":              "الفصل الثاني",
    "3":              "الفصل الثالث",
    "4":              "الفصل الرابع",
    # Already-Arabic passthrough
    "الفصل الأول":   "الفصل الأول",
    "الفصل الثاني":  "الفصل الثاني",
    "الفصل الثالث":  "الفصل الثالث",
    "الفصل الرابع":  "الفصل الرابع",
    "الاول":          "الفصل الأول",
    "الأول":          "الفصل الأول",
    "الثاني":         "الفصل الثاني",
    "الثالث":         "الفصل الثالث",
    "الرابع":         "الفصل الرابع",
}

# Sort order by Arabic name
QUARTER_ORDER = {
    "الفصل الأول":  1,
    "الفصل الثاني": 2,
    "الفصل الثالث": 3,
    "الفصل الرابع": 4,
}


def _to_arabic_quarter(quarter: str) -> str:
    """Normalise any quarter input → Arabic display name (case-insensitive)."""
    q = str(quarter).strip()
    # Try exact match first, then lowercase
    return QUARTER_AR.get(q) or QUARTER_AR.get(q.lower()) or q


def _quarter_sort_key(entry: Dict):
    year = int(entry.get("year", 0))
    q    = str(entry.get("quarter", "")).strip()
    return (year, QUARTER_ORDER.get(q, 99))


class VAPHistory:
    """Manage VAP historical data across quarters."""

    def __init__(self, storage_path: str = "storage/data/VAP_history.json"):
        self.storage_path = Path(storage_path)
        self.history: List[Dict] = []
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.load_history()

    # ── Persistence ──────────────────────────────────────────────────────────

    def load_history(self) -> List[Dict]:
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self.history = json.load(f)
                logger.info(f"📂 Loaded {len(self.history)} VAP historical quarters")
            except Exception as e:
                logger.error(f"❌ Error loading VAP history: {e}")
                self.history = []
        else:
            logger.info("📝 No existing VAP history — starting fresh")
            self.history = []
        return self.history

    def _save(self) -> bool:
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
            logger.success(f"✅ Saved {len(self.history)} VAP quarters → {self.storage_path}")
            return True
        except Exception as e:
            logger.error(f"❌ Error saving VAP history: {e}")
            return False

    # ── Write ─────────────────────────────────────────────────────────────────

    def save_quarter(self, quarter: str, year: int, stats: Dict, cases: list = None) -> bool:
        """
        Save (or update) one quarter's VAP data to history.

        Storage format mirrors CLABSI/CAUTI exactly:
          summary:            { floor: { cases, ventilator_days, rate } }
          germs_distribution: { floor: { germ: count } }

        Raw cases are saved separately to VAP_current.json (not in history).
        cases: raw processor output cases (passed from routes, same pattern as CLABSI/CAUTI)
        """
        ar_quarter = _to_arabic_quarter(quarter)
        logger.info(f"Saving VAP quarter: {ar_quarter} {year}")

        floor_stats = stats.get("floor_stats", {})

        # summary — keyed by whichever floors were actually in this upload
        summary_entry = {
            floor: {
                "cases":           data.get("cases", 0),
                "ventilator_days": data.get("ventilator_days", 0),
                "rate":            data.get("rate", 0.0),
            }
            for floor, data in floor_stats.items()
        }

        # germs_distribution — flat {floor: {germ: count}} matching CLABSI/CAUTI
        germs_distribution = {
            floor: data.get("counts", {})
            for floor, data in stats.get("germs_by_floor", {}).items()
            if data.get("total", 0) > 0
        }

        # Save raw cases to current file (same as CLABSI/CAUTI — no pre-building)
        save_current({"year": str(year), "quarter": ar_quarter, "cases": cases or []})

        entry = {
            "quarter":            ar_quarter,
            "year":               str(year),
            "summary":            summary_entry,
            "germs_distribution": germs_distribution,
        }

        # Upsert — match on Arabic quarter name
        existing_idx = next(
            (i for i, e in enumerate(self.history)
             if e["quarter"] == ar_quarter and e["year"] == str(year)),
            None,
        )
        if existing_idx is not None:
            self.history[existing_idx] = entry
            logger.info(f"✏️  Updated {ar_quarter} {year}")
        else:
            self.history.append(entry)
            logger.info(f"➕ Added {ar_quarter} {year}")

        self.history.sort(key=_quarter_sort_key)
        return self._save()

    # ── Read ──────────────────────────────────────────────────────────────────

    def get_last_n_quarters(self, n: int = 5) -> List[Dict]:
        """Return last N quarters (oldest → newest) for trend charts."""
        return self.history[-n:] if len(self.history) >= n else self.history

    def get_quarter(self, quarter: str, year: int) -> Optional[Dict]:
        for e in self.history:
            if e["quarter"] == quarter and e["year"] == str(year):
                return e
        return None

    def get_all(self) -> List[Dict]:
        return self.history

    # ── Derived helpers for chart data ────────────────────────────────────────

    def get_floor_trend(self, floor: str, n: int = 5) -> List[Dict]:
        """Return last N quarters with stats for a specific floor."""
        result = []
        for entry in self.history[-n:]:
            f = entry.get("summary", entry.get("floors", {})).get(floor, {})
            result.append({
                "quarter":         entry["quarter"],
                "year":            entry["year"],
                "cases":           f.get("cases", 0),
                "ventilator_days": f.get("ventilator_days", 0),
                "rate":            f.get("rate", 0.0),
                "target":          FLOOR_TARGETS.get(floor, 0.0),
            })
        return result

    def get_floor_germs_comparison(self, floor: str) -> Dict:
        """
        Return germ comparison data for the last 2 quarters that have cases
        for a specific floor (used by Chart 2 / Chart 4).

        The returned structure has a unified `germs` list that is the
        union of all germs appearing in either quarter, sorted by current-
        quarter count descending (then alphabetically), so bar charts can
        render every germ with zero-filled values where missing.

        Returns
        -------
        {
          current: {
            quarter, year, total,
            counts:      { germ: n },          # 0 if germ absent this quarter
            percentages: { germ: pct },        # 0.0 if absent
            labels:      { germ: "25%(1)" },   # display label for bar
          },
          previous: { same structure } | None,
          germs:    [ "germ1", "germ2", ... ]  # unified sorted list
        }
        """
        # Take all quarters that have at least 1 germ entry for this floor
        quarters_with_data = [
            e for e in self.history
            if e.get("germs_distribution", e.get("germs_by_floor", {})).get(floor)
        ]

        if not quarters_with_data:
            return {"current": None, "previous": None, "germs": []}

        def _raw(entry):
            # Support both new format (germs_distribution) and old (germs_by_floor)
            gd = entry.get("germs_distribution", {}).get(floor)
            if gd is not None:
                # New format: flat {germ: count}
                counts = gd
                total  = sum(counts.values())
                percentages = {g: round(n / total * 100, 1) for g, n in counts.items()} if total else {}
            else:
                gbd = entry.get("germs_by_floor", {}).get(floor, {})
                counts      = gbd.get("counts", {})
                total       = gbd.get("total", 0)
                percentages = gbd.get("percentages", {})
            return {
                "quarter":     entry["quarter"],
                "year":        entry["year"],
                "total":       total,
                "counts":      counts,
                "percentages": percentages,
            }

        cur_raw  = _raw(quarters_with_data[-1])
        prev_raw = _raw(quarters_with_data[-2]) if len(quarters_with_data) >= 2 else None

        # Build unified germ list: union of both quarters
        all_germs = set(cur_raw["counts"].keys())
        if prev_raw:
            all_germs |= set(prev_raw["counts"].keys())

        # Sort: by current-quarter count desc, then alphabetically
        all_germs_sorted = sorted(
            all_germs,
            key=lambda g: (-cur_raw["counts"].get(g, 0), g)
        )

        def _fill(raw, germs_list):
            """Fill missing germs with 0 and build display labels."""
            total = raw["total"]
            counts = {}
            percentages = {}
            labels = {}
            for g in germs_list:
                n   = raw["counts"].get(g, 0)
                pct = round(n / total * 100, 0) if total > 0 else 0.0
                counts[g]      = n
                percentages[g] = pct
                labels[g]      = f"{int(pct)}%({n})" if n > 0 else "0%(0)"
            return {
                "quarter":     raw["quarter"],
                "year":        raw["year"],
                "total":       total,
                "counts":      counts,
                "percentages": percentages,
                "labels":      labels,
            }

        current  = _fill(cur_raw, all_germs_sorted)
        previous = _fill(prev_raw, all_germs_sorted) if prev_raw else None

        return {
            "current":  current,
            "previous": previous,
            "germs":    all_germs_sorted,
        }

    def get_chart_data(self) -> Dict:
        """
        Return all 4 chart datasets in a single call.

        Chart 1 — ICU VAP rate trend (last 5 quarters)
        Chart 2 — ICU germs: current quarter vs previous quarter
        Chart 3 — CCU VAP rate trend (last 4 quarters)
        Chart 4 — CCU germs: current quarter vs previous quarter

        Each chart key maps directly to the data structure needed
        by the chart renderer — no further transformation required.
        """
        return {
            "chart1_icu_trend":      self.get_floor_trend("ICU", n=5),
            "chart2_icu_germs":      self.get_floor_germs_comparison("ICU"),
            "chart3_ccu_trend":      self.get_floor_trend("CCU", n=5),
            "chart4_ccu_germs":      self.get_floor_germs_comparison("CCU"),
            "chart5_icn_trend":      self.get_floor_trend("ICN", n=5),
            "chart6_icn_germs":      self.get_floor_germs_comparison("ICN"),
        }

    def get_quarter_floor_comparison_table(self, n: int = 5) -> Dict:
        """
        Build the full multi-floor comparison table (Table 1 in the report).

        Returns:
            quarters : list of "Quarter Year" labels (oldest → newest)
            floors   : list of floor names
            targets  : { floor: target }
            data     : {
                floor: [
                    { quarter, year, cases, ventilator_days, rate },
                    ...   (one entry per quarter, in same order as `quarters`)
                ]
            }
        """
        recent = self.history[-n:] if len(self.history) >= n else self.history
        quarter_labels = [f"{e['quarter']} {e['year']}" for e in recent]

        data: Dict[str, List[Dict]] = {floor: [] for floor in STANDARD_FLOORS}

        for entry in recent:
            for floor in STANDARD_FLOORS:
                f = entry.get("summary", entry.get("floors", {})).get(floor, {})
                data[floor].append({
                    "quarter":         entry["quarter"],
                    "year":            entry["year"],
                    "cases":           f.get("cases", 0),
                    "ventilator_days": f.get("ventilator_days", 0),
                    "rate":            f.get("rate", 0.0),
                })

        return {
            "quarters": quarter_labels,
            "floors":   STANDARD_FLOORS,
            "targets":  FLOOR_TARGETS,
            "data":     data,
        }