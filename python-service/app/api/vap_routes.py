"""
VAP FastAPI Routes
Prefix: /api/vap
"""

import io
import os
from pathlib import Path
from typing import Optional
import pandas as pd

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from loguru import logger

from app.infection_control.vap.processor import process_vap_sheet
import json
from app.infection_control.vap.history import VAPHistory, load_history, load_current, FLOOR_TARGETS, STANDARD_FLOORS
from app.infection_control.ic_statistics import InfectionControlStatistics, get_floors_from_excel

router = APIRouter(prefix="/api/vap", tags=["VAP"])

# ─── Semester filtering ────────────────────────────────────────────────────────

_QUARTER_STR_TO_NUM = {
    'الفصل الأول': 1, 'الفصل الاول': 1,
    'الفصل الثاني': 2,
    'الفصل الثالث': 3,
    'الفصل الرابع': 4,
}

_CELL_TO_NUM = {
    'الأول': 1, 'الاول': 1, 'أول': 1, 'اول': 1,
    'الفصل الأول': 1, 'الفصل الاول': 1, 'الفصل 1': 1, 'فصل 1': 1,
    'الثاني': 2, 'ثاني': 2,
    'الفصل الثاني': 2, 'الفصل 2': 2, 'فصل 2': 2,
    'الثالث': 3, 'ثالث': 3,
    'الفصل الثالث': 3, 'الفصل 3': 3, 'فصل 3': 3,
    'الرابع': 4, 'رابع': 4,
    'الفصل الرابع': 4, 'الفصل 4': 4, 'فصل 4': 4,
    'first': 1, 'one': 1,
    'second': 2, 'two': 2,
    'third': 3, 'three': 3,
    'fourth': 4, 'four': 4,
    '1': 1, '2': 2, '3': 3, '4': 4,
    'q1': 1, 'q2': 2, 'q3': 3, 'q4': 4,
    'q 1': 1, 'q 2': 2, 'q 3': 3, 'q 4': 4,
    's1': 1, 's2': 2, 's3': 3, 's4': 4,
    's 1': 1, 's 2': 2, 's 3': 3, 's 4': 4,
    'semester 1': 1, 'semester 2': 2, 'semester 3': 3, 'semester 4': 4,
    'quarter 1': 1, 'quarter 2': 2, 'quarter 3': 3, 'quarter 4': 4,
}


def _normalize_cell_semester(value) -> int | None:
    if value is None:
        return None
    s = str(value).strip()
    try:
        n = int(float(s))
        if 1 <= n <= 4:
            return n
    except (ValueError, TypeError):
        pass
    return _CELL_TO_NUM.get(s.lower()) or _CELL_TO_NUM.get(s)


def _filter_cases_by_semester(cases: list, quarter) -> list:
    """Filter case dicts by semester field. quarter can be str (Arabic) or int (1-4)."""
    if isinstance(quarter, int):
        target = quarter if 1 <= quarter <= 4 else None
    else:
        target = _QUARTER_STR_TO_NUM.get(str(quarter).strip())

    if target is None:
        logger.warning(f"⚠️  Unrecognized quarter '{quarter}', skipping semester filter")
        return cases

    # Check if any case actually has a semester field populated
    has_semester = any(c.get("semester") is not None for c in cases)
    if not has_semester:
        logger.info("ℹ️  No semester data in cases — processing all rows")
        return cases

    filtered = [c for c in cases if _normalize_cell_semester(c.get("semester")) == target]
    logger.info(f"🔍 Semester filter: kept {len(filtered)}/{len(cases)} cases for quarter {target}")

    if len(filtered) == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"لم يتم العثور على سجلات للفصل المحدد / "
                f"No records found for the selected quarter ({quarter}). "
                f"Please verify the file or your quarter selection."
            )
        )

    return filtered

def _filter_by_ic_type(file_bytes: bytes, ic_type: str, sheet_name: str) -> bytes:
    """
    If the file contains a 'Type of IC' column, filter rows matching ic_type
    and rewrite the Excel with sheet_name. Returns original bytes if column is absent.
    """
    try:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
        for sname in xl.sheet_names:
            try:
                df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sname)
            except Exception:
                continue
            ic_col = next((c for c in df.columns if str(c).strip().lower() == 'type of ic'), None)
            if ic_col is None:
                continue
            filtered = df[df[ic_col].astype(str).str.strip().str.upper() == ic_type.upper()].copy()
            logger.info(f"🔍 Type of IC filter: kept {len(filtered)}/{len(df)} rows for '{ic_type}'")
            if len(filtered) == 0:
                raise HTTPException(400, f"No records found for Type of IC = '{ic_type}' in the uploaded file.")
            buf = io.BytesIO()
            with pd.ExcelWriter(buf, engine='openpyxl') as writer:
                filtered.to_excel(writer, sheet_name=sheet_name, index=False)
            return buf.getvalue()
        return file_bytes  # no 'Type of IC' column — process as normal
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"⚠️ IC type filter error: {e} — using original file")
        return file_bytes


# ── Storage paths ──────────────────────────────────────────────────────────────
UPLOAD_DIR  = Path("storage/uploads/vap")
HISTORY_PATH = Path("storage/data/VAP_history.json")
CHARTS_DIR  = Path("storage/charts/vap")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
CHARTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Shared instances ───────────────────────────────────────────────────────────
_history = VAPHistory(str(HISTORY_PATH))
_ic      = InfectionControlStatistics("vap")


def _compute_vap_stats(processed: dict, floor_vent_days: dict, quarter, year: int) -> dict:
    """Compute VAP statistics — delegates shared logic to InfectionControlStatistics."""
    from app.infection_control.vap.history import _to_arabic_quarter

    cases       = processed["cases"]
    total_cases = processed["meta"]["total_cases"]

    ic              = _ic.calculate_all_statistics(cases, floor_vent_days, quarter, year)
    total_vent_days = ic["total_days"]
    overall_rate    = ic["overall_rate"]

    from app.config import load_targets
    live_targets = load_targets().get("vap", FLOOR_TARGETS)

    floor_stats: dict = {}
    for floor in floor_vent_days.keys():
        fs = ic["summary"].get(floor, {})
        n  = fs.get("cases", 0)
        floor_stats[floor] = {
            "cases":           n,
            "ventilator_days": fs.get("ventilator_days", 0),
            "rate":            fs.get("rate", 0.0),
            "target":          live_targets.get(floor, 0.0),
            "pct_of_total":    round(n / total_cases * 100, 1) if total_cases > 0 else 0.0,
        }

    germs_by_floor: dict = {}
    for floor in floor_vent_days.keys():
        flat  = ic["germs_distribution"].get(floor, {})
        total = sum(flat.values())
        flat_sorted = dict(sorted(flat.items(), key=lambda x: x[1], reverse=True))
        germs_by_floor[floor] = {
            "counts":      flat_sorted,
            "total":       total,
            "percentages": {g: round(n / total * 100, 1) for g, n in flat_sorted.items()} if total else {},
        }

    all_counts: dict = {}
    for c in cases:
        g = (c.get("germs") or "Unknown").strip()
        all_counts[g] = all_counts.get(g, 0) + 1
    all_counts    = dict(sorted(all_counts.items(), key=lambda x: x[1], reverse=True))
    total_overall = sum(all_counts.values())
    germs_overall = {
        "counts":      all_counts,
        "percentages": {g: round(n / total_overall * 100, 1) for g, n in all_counts.items()} if total_overall else {},
        "total":       total_overall,
    }

    ar_quarter = _to_arabic_quarter(quarter)

    return {
        "summary": {
            "quarter":         ar_quarter,
            "year":            year,
            "total_cases":     total_cases,
            "total_vent_days": total_vent_days,
            "overall_rate":    overall_rate,
        },
        "floor_stats":    floor_stats,
        "germs_overall":  germs_overall,
        "germs_by_floor": germs_by_floor,
        "risk_factors":   ic["risk_factors"],
        "diagnoses":      processed["diagnoses"],
        "monthly_trend":  processed["monthly_trend"],
        "age_groups":     processed["age_groups"],
        "genders":        processed["genders"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/vap/process-data
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/get-floors")
async def get_floors(
    file:    UploadFile = File(...),
    quarter: int        = Form(0),
):
    """Scan the uploaded Excel and return the unique floor names found in the data."""
    contents = await file.read()
    contents = _filter_by_ic_type(contents, 'VAP', 'VAP')
    floors   = get_floors_from_excel(contents, ic_type='VAP', quarter=quarter)

    from app.config import load_targets
    targets  = load_targets().get('vap', FLOOR_TARGETS)
    missing  = [f for f in floors if f not in targets]

    return JSONResponse({"floors": floors, "targets": targets, "missing_targets": missing})


@router.post("/process-data")
async def process_data(
    file:         UploadFile = File(...),
    quarter:      str        = Form(...),
    year:         int        = Form(...),
    denominators: str        = Form(...),   # JSON: {"ICU": 500, "CCU": 200, ...}
    new_targets:  str        = Form("{}"),  # JSON: {"NICU": 15.0} — new floors
):
    """
    Upload VAP Excel file + floor ventilator days (as JSON).
    Processes the data, saves to history, returns summary stats.
    """
    logger.info(f"📥 VAP upload: {file.filename} | {quarter} {year}")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "Only Excel files (.xlsx / .xls) are accepted")

    try:
        floor_vent_days   = {k: int(v) for k, v in json.loads(denominators).items()}
        new_targets_dict  = {k: float(v) for k, v in json.loads(new_targets).items()}
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(400, f"Invalid denominators or targets format: {exc}")

    # Persist any new floor targets before processing
    if new_targets_dict:
        from app.config import load_targets, save_targets
        all_targets = load_targets()
        all_targets.setdefault('vap', {}).update(new_targets_dict)
        save_targets(all_targets)

    tmp_path = UPLOAD_DIR / file.filename
    content  = await file.read()
    content  = _filter_by_ic_type(content, 'VAP', 'VAP')
    tmp_path.write_bytes(content)

    try:
        total_vent_days = sum(floor_vent_days.values())
        processed = process_vap_sheet(str(tmp_path), ventilator_days=total_vent_days)

        processed["cases"] = _filter_cases_by_semester(processed["cases"], quarter)
        processed["meta"]["total_cases"] = len(processed["cases"])

        # ── Calculate statistics ───────────────────────────────────────────────
        stats = _compute_vap_stats(processed, floor_vent_days, quarter, year)

        # ── Save to history ────────────────────────────────────────────────────
        _history.load_history()          # refresh before saving
        _history.save_quarter(quarter, year, stats, processed["cases"])

        logger.success(f"✅ VAP processed & saved: {quarter} {year}")

        return JSONResponse({
            "status":      "success",
            "quarter":     quarter,
            "year":        year,
            "total_cases": stats["summary"]["total_cases"],
            "overall_rate": stats["summary"]["overall_rate"],
            "floor_stats": stats["floor_stats"],
            "message":     f"VAP data for {quarter} {year} processed and saved successfully",
        })

    except Exception as e:
        logger.error(f"❌ VAP processing error: {e}")
        raise HTTPException(500, f"Processing error: {str(e)}")
    finally:
        # Clean up temp file
        if tmp_path.exists():
            tmp_path.unlink()


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/vap/history
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/history")
async def get_history():
    """Return all saved VAP quarters (oldest → newest)."""
    _history.load_history()
    return JSONResponse(_history.get_all())


@router.get("/current")
async def get_current():
    """Return the current quarter's raw case data."""
    return JSONResponse(load_current())


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/vap/history/latest
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/history/latest")
async def get_latest():
    """Return the most recent quarter's data."""
    _history.load_history()
    all_q = _history.get_all()
    if not all_q:
        raise HTTPException(404, "No VAP history found")
    return JSONResponse(all_q[-1])


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/vap/chart-data
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/chart-data")
async def get_chart_data():
    """
    Return all chart data for the 6 VAP charts.
    Used by frontend dashboard when charts are enabled.
    """
    _history.load_history()
    return JSONResponse(_history.get_chart_data())


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/vap/table-comparison
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/table-comparison")
async def get_table_comparison(n: int = 5):
    """
    Return Table 1: multi-floor quarterly comparison data.
    n = number of recent quarters to include (default 5).
    """
    _history.load_history()
    return JSONResponse(_history.get_quarter_floor_comparison_table(n=n))


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/vap/charts/{chart_name}
# Returns a single chart PNG (for future dashboard use)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/charts/{chart_name}")
async def get_chart(chart_name: str):
    """
    Return a single VAP chart as a PNG image.
    chart_name: chart1_icu_trend | chart2_icu_germs | chart3_ccu_trend |
                chart4_ccu_germs | chart5_icn_trend | chart6_icn_germs
    """
    valid = {
        "chart1_icu_trend", "chart2_icu_germs",
        "chart3_ccu_trend", "chart4_ccu_germs",
        "chart5_icn_trend", "chart6_icn_germs",
    }
    if chart_name not in valid:
        raise HTTPException(400, f"Unknown chart: {chart_name}. Valid: {sorted(valid)}")

    try:
        from app.infection_control.vap.chart_generator import VAPChartGenerator
        _history.load_history()
        chart_data = _history.get_chart_data()
        gen  = VAPChartGenerator(str(CHARTS_DIR))
        bufs = gen.generate_all_charts(chart_data)
        buf  = bufs.get(chart_name)
        if not buf:
            raise HTTPException(500, "Chart generation failed")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")
    except Exception as e:
        logger.error(f"Chart generation error: {e}")
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /api/vap/history/{quarter}/{year}
# ══════════════════════════════════════════════════════════════════════════════
@router.delete("/history/{quarter}/{year}")
async def delete_quarter(quarter: str, year: int):
    """Delete a specific quarter from history."""
    _history.load_history()
    before = len(_history.history)
    _history.history = [
        e for e in _history.history
        if not (e["quarter"] == quarter and e["year"] == str(year))
    ]
    if len(_history.history) == before:
        raise HTTPException(404, f"{quarter} {year} not found in history")
    _history._save()
    return JSONResponse({"status": "deleted", "quarter": quarter, "year": year})


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/vap/generate-report
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/generate-report")
def generate_vap_report():
    """
    Generate a DOCX VAP report from the full history file.
    All statistics (cases, germs, rates) are already stored in the history JSON.
    """
    history = load_history()
    if not history:
        raise HTTPException(status_code=404, detail="No VAP data available")
    try:
        from app.infection_control.vap.docx_generator import VAPDocxGenerator
        from app.infection_control.vap.history import get_vap_targets
        current = load_current()
        gen     = VAPDocxGenerator()
        result  = gen.generate_report(history=history, targets=get_vap_targets(), current=current)
        return {"success": True, "filePath": result["filePath"], "fileName": result["fileName"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/vap/download-report?fileName=...
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/download-report")
async def download_vap_report(fileName: str):
    """
    Download a generated VAP DOCX report by filename.
    Reports are stored in the root storage/reports/ directory.
    """
    safe_name   = os.path.basename(fileName)
    reports_dir = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'reports')
    )
    file_path = os.path.join(reports_dir, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(404, f"Report not found: {safe_name}")

    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/targets")
def get_targets():
    """Return VAP targets per 1,000 ventilator-days per department."""
    from app.infection_control.vap.history import get_vap_targets
    return get_vap_targets()
