"""
Shared Statistics Calculator for CLABSI, CAUTI, and VAP.

  - Takes normalized case dicts (output of processor) + floor device-day denominators
  - Returns a comprehensive statistics dict used by routes, history, charts, and docx
  - VAP uses a thin wrapper (vap/statistics.py) that adds floor targets and cases tables

Usage:
    from app.infection_control.ic_statistics import InfectionControlStatistics

    stats  = InfectionControlStatistics('clabsi')  # or 'cauti' or 'vap'
    result = stats.calculate_all_statistics(cases, floor_days, quarter=4, year=2025)
"""

import io
from typing import Dict, List, Optional

# ── Risk factor columns (snake_case — must match processor case dict keys) ────
RISK_FACTOR_COLS = [
    "diabetic", "hypertension", "dyslipidemia", "heart_disease",
    "kidney_disease", "copd", "smoker", "obesity",
    "cardiac_congenital_malformation", "advanced_age",
    "length_of_stay", "duration_of_catheter",
    "cancer", "compromised_immune_system", "respiratory_pb",
]

RISK_FACTOR_LABELS = {
    "diabetic":                        "Diabetic",
    "hypertension":                    "Hypertension",
    "dyslipidemia":                    "Dyslipidemia",
    "heart_disease":                   "Heart Disease",
    "kidney_disease":                  "Kidney Disease",
    "copd":                            "COPD",
    "smoker":                          "Smoker",
    "obesity":                         "Obesity",
    "cardiac_congenital_malformation": "Cardiac Congenital Malformation",
    "advanced_age":                    "Advanced Age",
    "length_of_stay":                  "Length of Stay",
    "duration_of_catheter":            "Duration of Catheter",
    "cancer":                          "Cancer",
    "compromised_immune_system":       "Compromised Immune System",
    "respiratory_pb":                  "Respiratory Problem",
}

# days_key must match what history and docx generator expect
CONFIGS: Dict[str, Dict] = {
    "clabsi": {"days_key": "catheter_days"},
    "cauti":  {"days_key": "urinary_catheter_days"},
    "vap":    {"days_key": "ventilator_days"},
}


def get_floors_from_excel(file_bytes: bytes, ic_type: str = None, quarter: int = 0) -> list:
    """
    Extract unique floor names from any IC Excel file.
    ic_type : filter by 'Type of IC' column (e.g. 'VAP', 'CAUTI', 'CLABSI')
    quarter : if > 0, also filter rows by the 'Semester' column (int 1-4)
    """
    try:
        import pandas as pd
    except ImportError:
        return []
    try:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
    except Exception:
        return []

    for sname in xl.sheet_names:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sname)
        except Exception:
            continue

        col_lower = {str(c).strip().lower(): c for c in df.columns}
        floor_col = col_lower.get('floor')
        if floor_col is None:
            continue

        if ic_type:
            ic_col = next(
                (c for c in df.columns if str(c).strip().lower() == 'type of ic'), None
            )
            if ic_col:
                df = df[df[ic_col].astype(str).str.strip().str.upper() == ic_type.upper()].copy()

        if quarter:
            sem_col = col_lower.get('semester')
            if sem_col:
                _SEM_TEXT = {
                    'first': 1, 'one': 1, 'الأول': 1, 'الاول': 1, 'أول': 1, 'اول': 1,
                    'الفصل الأول': 1, 'الفصل الاول': 1, 'الفصل 1': 1, 'فصل 1': 1,
                    'second': 2, 'two': 2, 'الثاني': 2, 'ثاني': 2,
                    'الفصل الثاني': 2, 'الفصل 2': 2, 'فصل 2': 2,
                    'third': 3, 'three': 3, 'الثالث': 3, 'ثالث': 3,
                    'الفصل الثالث': 3, 'الفصل 3': 3, 'فصل 3': 3,
                    'fourth': 4, 'four': 4, 'الرابع': 4, 'رابع': 4,
                    'الفصل الرابع': 4, 'الفصل 4': 4, 'فصل 4': 4,
                    'q1': 1, 'q2': 2, 'q3': 3, 'q4': 4,
                    'q 1': 1, 'q 2': 2, 'q 3': 3, 'q 4': 4,
                    's1': 1, 's2': 2, 's3': 3, 's4': 4,
                    'semester 1': 1, 'semester 2': 2, 'semester 3': 3, 'semester 4': 4,
                    'quarter 1': 1, 'quarter 2': 2, 'quarter 3': 3, 'quarter 4': 4,
                }

                def _norm_sem(v) -> int | None:
                    if v is None:
                        return None
                    s = str(v).strip()
                    try:
                        n = int(float(s))
                        if 1 <= n <= 4:
                            return n
                    except (ValueError, TypeError):
                        pass
                    return _SEM_TEXT.get(s.lower()) or _SEM_TEXT.get(s)

                def _sem_match(v):
                    n = _norm_sem(v)
                    if n is None:
                        return True   # blank → include
                    return n == quarter

                df = df[df[sem_col].apply(_sem_match)]

        floors = df[floor_col].dropna().astype(str).str.strip()
        result = sorted({f for f in floors if f and f.lower() not in ('nan', 'none', '')})
        if result:
            return result

    return []


def _nb(case: dict) -> int:
    """Return the nb_of_cases value for a case row (defaults to 1 if missing/invalid)."""
    try:
        v = case.get("nb_of_cases")
        return int(v) if v is not None else 1
    except (TypeError, ValueError):
        return 1


# ── Floor name aliases (same pattern as VAP) ──────────────────────────────────
def _match_floor(floor_value: Optional[str], standard: str) -> bool:
    """
    Match a floor value from Excel data against a standard floor key.

    Works bidirectionally — "Pediatric" key matches "Ped" value and vice versa,
    because both resolve to the same alias group ("PED").
    """
    if not floor_value:
        return False
    v = str(floor_value).strip().upper()
    s = standard.strip().upper()

    if v == s:
        return True

    _GROUPS: Dict[str, set] = {
        "ICU":      {"ICU", "INTENSIVE CARE UNIT", "MICU", "SICU", "TICU"},
        "CCU":      {"CCU", "CARDIAC CARE UNIT", "CORONARY CARE UNIT"},
        "CSU":      {"CSU", "CARDIAC SURGERY UNIT", "CARDIAC STEP DOWN"},
        "PED":      {"PED", "PEDS", "PEDIATRIC", "PAEDIATRIC", "PEDIATRICS"},
        "ICN":      {"ICN", "INFANT CARE NURSERY", "NICU", "NEONATAL ICU"},
        "ITU":      {"ITU", "INTENSIVE THERAPY UNIT"},
        "NEONATAL": {"NEONATAL", "NEONATAL ICU", "NICU"},
        "3RD WEST": {"3RD WEST", "THIRD WEST"},
    }

    # Build reverse map: any alias value → canonical group key
    _reverse: Dict[str, str] = {}
    for key, members in _GROUPS.items():
        for m in members:
            _reverse[m] = key

    # Resolve both sides to their canonical group; match if same group
    v_grp = _reverse.get(v)
    s_grp = _reverse.get(s)

    if v_grp is not None and s_grp is not None:
        return v_grp == s_grp
    # One side not in any group — fall back to direct set lookup (original behaviour)
    return v in _GROUPS.get(s, {s})


class InfectionControlStatistics:
    """Calculate all CLABSI or CAUTI statistics from normalized case dicts."""

    def __init__(self, infection_type: str):
        if infection_type not in CONFIGS:
            raise ValueError(f"Unknown type '{infection_type}'. Use 'clabsi', 'cauti', or 'vap'.")
        self.infection_type = infection_type
        self.days_key       = CONFIGS[infection_type]["days_key"]

    # =========================================================================
    # PUBLIC ENTRY POINT
    # =========================================================================

    def calculate_all_statistics(
        self,
        cases: List[Dict],
        floor_device_days: Dict[str, int],
        quarter,
        year: int,
    ) -> Dict:
        """
        Parameters
        ----------
        cases             : normalized case dicts from processor (each row = 1 case)
        floor_device_days : {floor_name: device_day_count}  — user-entered denominator
                            (catheter days for CLABSI/CAUTI, ventilator days for VAP)
        quarter           : int (1–4) or string label
        year              : e.g. 2025

        Returns a dict with all statistics needed by history, charts, and docx.
        """
        days_key    = self.days_key
        total_cases = len(cases)
        total_days  = sum(floor_device_days.values())
        overall_rate = round((total_cases / total_days) * 1000, 2) if total_days > 0 else 0.0

        # ── summary (history-compatible format) ───────────────────────────────
        summary: Dict[str, Dict] = {}
        for floor, catheter_days in floor_device_days.items():
            floor_cases = [c for c in cases if _match_floor(c.get("floor"), floor)]
            n    = len(floor_cases)
            rate = round((n / catheter_days) * 1000, 2) if catheter_days > 0 else 0.0
            summary[floor] = {
                "cases":   n,
                days_key:  catheter_days,
                "rate":    rate,
            }

        # ── germs distribution per floor ─────────────────────────────────────
        germs_distribution = self._germs_by_floor(cases, list(floor_device_days.keys()))

        # ── risk factors ─────────────────────────────────────────────────────
        risk_factors = self._calculate_risk_factors(cases, total_cases)

        # ── age groups ───────────────────────────────────────────────────────
        age_groups = self._calculate_age_groups(cases)

        # ── genders ──────────────────────────────────────────────────────────
        genders = self._calculate_genders(cases)

        # ── monthly trend ─────────────────────────────────────────────────────
        monthly_trend = self._calculate_monthly_trend(cases)

        # ── top diagnoses ─────────────────────────────────────────────────────
        diagnoses = self._calculate_diagnoses(cases)

        return {
            "quarter":            quarter,
            "year":               year,
            "total_cases":        total_cases,
            "total_days":         total_days,
            "overall_rate":       overall_rate,
            "summary":            summary,
            "germs_distribution": germs_distribution,
            "risk_factors":       risk_factors,
            "age_groups":         age_groups,
            "genders":            genders,
            "monthly_trend":      monthly_trend,
            "diagnoses":          diagnoses,
        }

    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================

    def _germs_by_floor(self, cases: List[Dict], floors: List[str]) -> Dict:
        result: Dict[str, Dict] = {}
        for floor in floors:
            floor_cases = [c for c in cases if _match_floor(c.get("floor"), floor)]
            counts: Dict[str, int] = {}
            for c in floor_cases:
                g = (c.get("germs") or "Unknown").strip()
                counts[g] = counts.get(g, 0) + 1
            result[floor] = dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))
        return result

    def _calculate_risk_factors(self, cases: List[Dict], total: int) -> Dict:
        counts = {
            RISK_FACTOR_LABELS[col]: sum(1 for c in cases if c.get(col) is True)
            for col in RISK_FACTOR_COLS
        }
        counts = dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))
        return {
            "counts":      counts,
            "percentages": {k: round(v / total * 100, 1) for k, v in counts.items()} if total else {},
            "total":       total,
        }

    def _calculate_age_groups(self, cases: List[Dict]) -> Dict:
        groups = {"<1": 0, "1-30": 0, "31-50": 0, "51-65": 0, "66-80": 0, "80+": 0, "Unknown": 0}
        for c in cases:
            a = c.get("age")
            if   a is None: groups["Unknown"] += 1
            elif a < 1:     groups["<1"]      += 1
            elif a <= 30:   groups["1-30"]    += 1
            elif a <= 50:   groups["31-50"]   += 1
            elif a <= 65:   groups["51-65"]   += 1
            elif a <= 80:   groups["66-80"]   += 1
            else:           groups["80+"]     += 1
        return groups

    def _calculate_genders(self, cases: List[Dict]) -> Dict:
        genders: Dict[str, int] = {"Male": 0, "Female": 0, "Unknown": 0}
        for c in cases:
            g = (c.get("gender") or "").strip().capitalize()
            if g in ("Male", "Female"):
                genders[g] += 1
            else:
                genders["Unknown"] += 1
        return genders

    def _calculate_monthly_trend(self, cases: List[Dict]) -> List[Dict]:
        monthly: Dict[str, int] = {}
        for c in cases:
            m = c.get("infection_month") or "Unknown"
            monthly[m] = monthly.get(m, 0) + 1
        return [{"month": k, "cases": v} for k, v in sorted(monthly.items())]

    def _calculate_diagnoses(self, cases: List[Dict]) -> List[Dict]:
        counts: Dict[str, int] = {}
        for c in cases:
            d = c.get("diagnosis") or "Unknown"
            counts[d] = counts.get(d, 0) + 1
        return [
            {"diagnosis": k, "count": v}
            for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)
        ]
