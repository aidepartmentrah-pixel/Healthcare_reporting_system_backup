"""
CAUTI API Routes
Prefix: /api/cauti
"""

import io
import json
import os
from pathlib import Path
from uuid import uuid4
import pandas as pd

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from loguru import logger

from app.infection_control.cauti.processor import process_cauti_excel
from app.infection_control.cauti.history import (
    load_history,
    load_current,
    add_or_update_quarter,
    get_current_quarter,
    save_history,
)
from app.infection_control.cauti.cauti_targets import CAUTI_TARGETS
from app.infection_control.ic_statistics import InfectionControlStatistics, get_floors_from_excel

router = APIRouter(prefix="/api/cauti", tags=["CAUTI"])

TEMP_DIR = Path("storage/temp")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

_stats = InfectionControlStatistics("cauti")

def _filter_by_ic_type(file_bytes: bytes, ic_type: str, sheet_name: str) -> bytes:
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
        return file_bytes
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"⚠️ IC type filter error: {e} — using original file")
        return file_bytes


# ─── Semester filtering ────────────────────────────────────────────────────────

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


def _filter_cases_by_semester(cases: list, quarter: int) -> list:
    """Filter case dicts by semester field. quarter is int 1-4."""
    from loguru import logger
    has_semester = any(c.get("semester") is not None for c in cases)
    if not has_semester:
        logger.info("ℹ️  No semester data in CAUTI cases — processing all rows")
        return cases

    filtered = [c for c in cases if _normalize_cell_semester(c.get("semester")) == quarter]
    logger.info(f"🔍 CAUTI semester filter: kept {len(filtered)}/{len(cases)} cases for quarter {quarter}")

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


@router.post("/get-floors")
async def get_floors(
    file:    UploadFile = File(...),
    quarter: int        = Form(0),
):
    """Scan the uploaded Excel and return unique floor names found in the data."""
    contents = await file.read()
    contents = _filter_by_ic_type(contents, 'CAUTI', 'CAUTI')
    floors   = get_floors_from_excel(contents, ic_type='CAUTI', quarter=quarter)

    from app.config import load_targets
    from app.infection_control.cauti.cauti_targets import get_cauti_targets
    targets = get_cauti_targets()
    missing = [f for f in floors if f not in targets]

    return JSONResponse({"floors": floors, "targets": targets, "missing_targets": missing})


@router.post("/process-data")
async def process_data(
    file:        UploadFile = File(...),
    year:        int        = Form(...),
    quarter:     int        = Form(...),
    denominators: str       = Form(...),   # JSON: {"ICU": 200, "CCU": 150, ...}
    new_targets:  str       = Form("{}"),  # JSON: {"NICU": 4.5} — new floors
):
    """Process uploaded CAUTI Excel sheet and save to history."""
    tmp_path = TEMP_DIR / f"cauti_{uuid4()}.xlsx"
    try:
        contents = await file.read()
        contents = _filter_by_ic_type(contents, 'CAUTI', 'CAUTI')
        tmp_path.write_bytes(contents)

        denominators_dict: dict = {k: int(v) for k, v in json.loads(denominators).items()}
        new_targets_dict: dict  = {k: float(v) for k, v in json.loads(new_targets).items()}

        if new_targets_dict:
            from app.config import load_targets, save_targets
            all_targets = load_targets()
            all_targets.setdefault('cauti', {}).update(new_targets_dict)
            save_targets(all_targets)

        result = process_cauti_excel(str(tmp_path), int(year), int(quarter), denominators_dict)
        cases  = _filter_cases_by_semester(result["cases"], int(quarter))

        all_stats = _stats.calculate_all_statistics(
            cases=cases,
            floor_device_days=denominators_dict,
            quarter=int(quarter),
            year=int(year),
        )

        record = {
            "year":               int(year),
            "quarter":            int(quarter),
            "summary":            all_stats["summary"],
            "cases":              cases,
            "germs_distribution": all_stats["germs_distribution"],
        }

        add_or_update_quarter(record)

        return JSONResponse(content={
            "status":      "success",
            "message":     "CAUTI data processed and saved successfully",
            "year":        int(year),
            "quarter":     int(quarter),
            "total_cases": all_stats["total_cases"],
        })

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid denominators JSON format")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@router.get("/history")
def get_history():
    return load_history()


@router.get("/history/latest")
def get_latest():
    latest = get_current_quarter()
    if latest is None:
        raise HTTPException(status_code=404, detail="No CAUTI data available")
    return latest


@router.get("/current")
def get_current():
    """Return the current quarter's raw case data."""
    return load_current()


@router.get("/targets")
def get_targets():
    from app.infection_control.cauti.cauti_targets import get_cauti_targets
    return get_cauti_targets()


@router.post("/generate-report")
def generate_report():
    """Generate a DOCX CAUTI report from history + current quarter data."""
    history = load_history()
    if not history:
        raise HTTPException(status_code=404, detail="No CAUTI data available")
    try:
        from app.infection_control.cauti.docx_generator import CAUTIDocxGenerator
        current = load_current()
        gen     = CAUTIDocxGenerator()
        from app.infection_control.cauti.cauti_targets import get_cauti_targets
        result  = gen.generate_report(history=history, targets=get_cauti_targets(), current=current)
        return {"success": True, "filePath": result["filePath"], "fileName": result["fileName"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/download-report")
def download_report(fileName: str):
    """Download a generated CAUTI DOCX report by filename."""
    safe_name   = os.path.basename(fileName)
    reports_dir = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'reports')
    )
    file_path = os.path.join(reports_dir, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Report not found: {safe_name}")
    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.delete("/history/{year}/{quarter}")
def delete_quarter(year: int, quarter: int):
    history = load_history()
    filtered = [r for r in history if not (r["year"] == year and r["quarter"] == quarter)]
    if len(filtered) == len(history):
        raise HTTPException(status_code=404, detail="Quarter not found")
    save_history(filtered)
    return {"status": "deleted", "year": year, "quarter": quarter}
