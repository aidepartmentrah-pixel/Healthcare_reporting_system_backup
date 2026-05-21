"""
FastAPI Routes - Medication Error API endpoints
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from loguru import logger
import os
import shutil
import pandas as pd
import numpy as np

from app.medication.data_processor import MedicationErrorProcessor
from app.medication.statistics import MedicationErrorStatistics
from app.medication.history_manager import MedicationErrorHistory
from app.medication.docx_generator import medication_error_docx_generator

router = APIRouter()

# Shared history instance (storage path relative to where the service runs)
me_history = MedicationErrorHistory('storage/data/medication_error_history.json')

# ─── Semester / quarter filtering ─────────────────────────────────────────────

_QUARTER_TO_NUM = {
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

_SEMESTER_COL_NAMES = {'الفصل', 'فصل', 'semester', 'quarter', 'الربع', 'ربع'}


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


def _find_semester_column(df: pd.DataFrame) -> str | None:
    for col in df.columns:
        if str(col).strip().lower() in _SEMESTER_COL_NAMES or str(col).strip() in _SEMESTER_COL_NAMES:
            return col
    return None


def _filter_by_semester(df: pd.DataFrame, quarter: str) -> pd.DataFrame:
    col = _find_semester_column(df)
    if col is None:
        logger.info("ℹ️  No semester column found — processing all rows")
        return df

    target = _QUARTER_TO_NUM.get(quarter.strip())
    if target is None:
        logger.warning(f"⚠️  Unrecognized quarter '{quarter}', skipping semester filter")
        return df

    mask = df[col].apply(_normalize_cell_semester) == target
    filtered = df[mask].copy()

    logger.info(f"🔍 Semester filter on '{col}': kept {len(filtered)}/{len(df)} rows for quarter {target}")

    if len(filtered) == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"لم يتم العثور على سجلات للفصل المحدد / "
                f"No records found for the selected quarter ({quarter}) "
                f"in column '{col}'. Please verify the file or your quarter selection."
            )
        )

    return filtered


def convert_numpy(obj):
    """Recursively convert numpy/pandas types to native Python types for JSON serialization."""
    import datetime as _dt
    if isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif obj is np.nan or (isinstance(obj, float) and np.isnan(obj)):
        return None
    elif isinstance(obj, (_dt.datetime, _dt.date)):
        return obj.isoformat()
    elif hasattr(obj, 'isoformat'):          # catches pandas Timestamp
        return obj.isoformat()
    return obj


@router.post("/process-data")
async def process_medication_data(
    file: UploadFile = File(...),
    quarter: str = Form(None),
    year: str = Form(None),
    total_doses: int = Form(...)
):
    temp_path = None

    try:
        logger.info(f"📤 Received medication error file: {file.filename}")

        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(400, "Invalid file type. Upload .xlsx or .xls")

        if total_doses <= 0:
            raise HTTPException(400, "total_doses must be greater than 0")

        os.makedirs("../storage/temp", exist_ok=True)
        temp_path = f"../storage/temp/me_{file.filename}"

        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"💾 Saved to: {temp_path}")

        processor = MedicationErrorProcessor()
        df = processor.load_excel(temp_path)
        processor.total_doses = total_doses
        logger.info(f"📝 Total doses: {total_doses:,}")

        # Filter to the selected semester/quarter (if column exists)
        if quarter:
            df = _filter_by_semester(df, quarter)

        df_clean = processor.clean_data(df)

        # Quarter/year: use overrides when provided, otherwise auto-detect
        if quarter and year:
            q = quarter
            y = int(year)
        else:
            q, y = processor.calculate_quarter(df_clean)
            if quarter:
                q = quarter
            if year:
                y = int(year)

        # --- Statistics ---
        stats_calc = MedicationErrorStatistics()
        stats = stats_calc.calculate_all_statistics(df_clean, processor.total_doses, q, y)

        # --- Serialize records ---
        df_json = df_clean.replace({np.nan: None, pd.NaT: None})
        for col in df_json.select_dtypes(include=['datetime64']).columns:
            df_json[col] = df_json[col].astype(str).replace('NaT', None)
        records = df_json.to_dict('records')

        # --- Save lean entry to history (rate / counts / doses only) ---
        me_history.save_quarter(quarter=q, year=y, stats=stats)

        # --- Save full snapshot to current (stats + raw records) ---
        me_history.save_current_data(
            quarter=q,
            year=y,
            stats=convert_numpy(dict(stats)),
            records=convert_numpy(records),
        )

        logger.success(
            f"✅ Processing complete: {len(records)} records, "
            f"rate={stats['summary']['error_rate']:.4f}%"
        )

        return convert_numpy({
            "success": True,
            "data": {
                "records": records,
                "total_records": len(records),
                "statistics": stats,
                "quarter": q,
                "year": str(y)
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/history")
async def get_medication_history():
    """Return all saved medication error quarters (oldest → newest) — lean fields only."""
    try:
        history = me_history.load_history()
        return convert_numpy(history)
    except Exception as e:
        logger.error(f"History fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/current")
async def get_medication_current():
    """Return the full statistics snapshot for the most recently uploaded quarter."""
    try:
        entry = me_history.get_latest_current_data()
        if not entry:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=404, content={"detail": "No current data found"})
        return convert_numpy({
            "quarter":      entry.get("quarter", ""),
            "year":         entry.get("year", ""),
            "statistics":   entry.get("statistics", {}),
            "records":      entry.get("records", []),
            "total_records": len(entry.get("records", [])),
        })
    except Exception as e:
        logger.error(f"Current data fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-report")
async def generate_medication_report(request: dict):
    """
    Generate a DOCX medication error report from already-processed data.

    JSON body:
        data:    { statistics: <stats dict from /process-data> }
        quarter: str  (e.g. "الفصل الثالث")
        year:    str  (e.g. "2025")
    """
    try:
        data = request.get('data', {})
        quarter = request.get('quarter', 'الفصل الثالث')
        year = str(request.get('year', '2025'))

        stats = data.get('statistics', {})
        if not stats or not stats.get('summary'):
            raise HTTPException(400, "No statistics data provided")

        # History for results table: all saved quarters except the current one
        all_history = me_history.load_history()
        history = [
            h for h in all_history
            if not (h['quarter'] == quarter and h['year'] == year)
        ]

        logger.info(
            f"Generating medication error report for {quarter} {year}, "
            f"using {len(history)} history entries"
        )

        result = await medication_error_docx_generator.generate_report(
            stats,
            history=history,
            options={'quarter': quarter, 'year': year}
        )

        logger.success(f"Report generated: {result['fileName']}")

        return {
            "success": True,
            "filePath": result['filePath'],
            "fileName": result['fileName']
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download-report")
async def download_medication_report(fileName: str):
    """
    Download a generated medication error DOCX report by filename.

    Args:
        fileName: The report filename returned by /generate-report
    """
    safe_name = os.path.basename(fileName)
    reports_dir = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'reports')
    )
    file_path = os.path.join(reports_dir, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(404, f"Report not found: {safe_name}")

    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/test")
async def test_medication_endpoint():
    """Health check for the medication error sub-service."""
    return {
        "status": "ok",
        "service": "medication-error-processor",
        "module": "medication_error"
    }
