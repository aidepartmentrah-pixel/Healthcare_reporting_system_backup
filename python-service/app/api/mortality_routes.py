"""
FastAPI Routes - API endpoints for data processing
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger
import os
import shutil
import pandas as pd

import numpy as np

from app.mortality.data_processor import data_processor
from app.mortality.statistics import statistics_calculator
from app.mortality.excel_handler import excel_handler
from app.mortality.history_manager import history_manager
from app.mortality.docx_generator import matplotlib_docx_generator

router = APIRouter()

# ─── Semester / quarter filtering ─────────────────────────────────────────────

_QUARTER_TO_NUM = {
    'الفصل الأول': 1, 'الفصل الاول': 1,
    'الفصل الثاني': 2,
    'الفصل الثالث': 3,
    'الفصل الرابع': 4,
}

_CELL_TO_NUM = {
    # Arabic
    'الأول': 1, 'الاول': 1, 'أول': 1, 'اول': 1,
    'الفصل الأول': 1, 'الفصل الاول': 1,
    'الفصل 1': 1, 'فصل 1': 1,
    'الثاني': 2, 'ثاني': 2,
    'الفصل الثاني': 2, 'الفصل 2': 2, 'فصل 2': 2,
    'الثالث': 3, 'ثالث': 3,
    'الفصل الثالث': 3, 'الفصل 3': 3, 'فصل 3': 3,
    'الرابع': 4, 'رابع': 4,
    'الفصل الرابع': 4, 'الفصل 4': 4, 'فصل 4': 4,
    # English words
    'first': 1, 'one': 1,
    'second': 2, 'two': 2,
    'third': 3, 'three': 3,
    'fourth': 4, 'four': 4,
    # Numbers and short forms
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
    # Try numeric directly (handles float like 1.0)
    try:
        n = int(float(s))
        if 1 <= n <= 4:
            return n
    except (ValueError, TypeError):
        pass
    return _CELL_TO_NUM.get(s.lower()) or _CELL_TO_NUM.get(s)


def _find_semester_column(df: pd.DataFrame) -> str | None:
    for col in df.columns:
        normalized = str(col).strip().lower()
        if normalized in _SEMESTER_COL_NAMES or str(col).strip() in _SEMESTER_COL_NAMES:
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
    """Recursively convert numpy/datetime types to native Python types for JSON serialization."""
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
    return obj


@router.post("/process-data")
async def process_mortality_data(
    file: UploadFile = File(...),
    quarter: str = Form(...),
    year: str = Form(...),
    total_patients: int = Form(...)
):
    """
    Process uploaded Excel mortality file (first sheet only).

    Args:
        file: Excel file upload (.xlsx or .xls)
        quarter: Quarter name (e.g., "الفصل الثالث")
        year: Year (e.g., "2025")
        total_patients: Total hospital admissions this quarter

    Returns:
        Processed data with statistics
    """
    temp_path = None

    try:
        logger.info(f"📤 Received file: {file.filename}")
        logger.info(f"📊 Total patients: {total_patients}")

        # Validate file extension
        if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
            raise HTTPException(400, "Invalid file type. Upload .xlsx, .xls, or .csv")

        # Save uploaded file temporarily
        os.makedirs("../storage/temp", exist_ok=True)
        temp_path = f"../storage/temp/{file.filename}"

        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"💾 Saved to: {temp_path}")

        # 1. Parse file (Excel or CSV)
        if file.filename.endswith('.csv'):
            df = pd.read_csv(temp_path)
            who_summary = None
        else:
            df, who_summary, _ = excel_handler.parse_excel(temp_path)
        logger.info(f"📋 Parsed: {len(df)} records")

        # 1b. Filter to rows matching the selected semester/quarter (if column exists)
        df = _filter_by_semester(df, quarter)

        # 2. Clean data (auto-detects CSV vs Excel)
        df_cleaned = data_processor.clean_data(df)
        logger.info(f"🧹 Cleaned: {len(df_cleaned)} valid records")

        # 3. Build admission data from the data itself (building column)
        # Build admission data using KPI=YES records only (consistent with all other stats)
        admission_data = None
        if 'building' in df_cleaned.columns and 'include_kpi' in df_cleaned.columns:
            kpi_df = df_cleaned[df_cleaned['include_kpi'].str.upper() == 'YES']
            bci_deaths = len(kpi_df[kpi_df['building'].str.contains('BCI', case=False, na=False)])
            # Fallback: classify cardiac departments as BCI
            if bci_deaths == 0 and 'nursing_department' in kpi_df.columns:
                cardiac_depts = ['ICVU', 'CSU', 'CCU', 'ITCU', 'Cardiac', 'ICN']
                bci_deaths = len(kpi_df[kpi_df['nursing_department'].str.contains(
                    '|'.join(cardiac_depts), case=False, na=False
                )])
            rah_deaths = len(kpi_df) - bci_deaths
            kpi_total = len(kpi_df)

            admission_data = {
                'bci': {
                    'building': 'BCI',
                    'deaths': bci_deaths,
                    'percentage': round((bci_deaths / kpi_total) * 100, 1) if kpi_total > 0 else 0
                },
                'rah': {
                    'building': 'RAH',
                    'deaths': rah_deaths,
                    'percentage': round((rah_deaths / kpi_total) * 100, 1) if kpi_total > 0 else 0
                },
                'total': {
                    'deaths': kpi_total,
                    'admissions': total_patients
                }
            }

        # 4. Calculate WHO categories from main data if not from sheet
        if who_summary is None and 'who_category_1' in df_cleaned.columns:
            who_counts = df_cleaned['who_category_1'].dropna().value_counts()
            who_summary = [
                {'category': str(cat).strip(), 'count': int(cnt)}
                for cat, cnt in who_counts.items()
                if str(cat).strip() and str(cat).strip() != 'nan'
            ]
            logger.info(f"📊 WHO categories from main data: {len(who_summary)} categories")

        # 5. Calculate statistics
        stats = statistics_calculator.calculate_all_statistics(
            df_cleaned,
            total_patients=total_patients,
            admission_data=admission_data
        )

        # 6. Get validation report
        validation = data_processor.get_validation_report()

        # 7. Convert DataFrame to records (replace NaN/NaT with None for JSON)
        df_json = df_cleaned.replace({np.nan: None, pd.NaT: None})
        # Convert Timestamp objects to strings
        for col in df_json.select_dtypes(include=['datetime64']).columns:
            df_json[col] = df_json[col].astype(str).replace('NaT', None)
        records = df_json.to_dict('records')

        # 8. Build age_groups array (8 categories) for history (KPI=YES, from age_categories)
        age_group_order = [
            'اقل من 5 سنوات', 'من 5 الى 15 سنة', 'من 16 الى 30 سنة',
            'من 31 الى 50 سنة', 'من 51 الى 60 سنة', 'من 61 الى 70 سنة',
            'من 71 الى 80 سنة', 'اكثر من 81 سنة'
        ]
        # Prefer age_categories (from تصنيف العمر, KPI=YES) over age_groups
        age_cats = stats.get('demographics', {}).get('age_categories', [])
        if age_cats:
            age_groups_dict = {ag['group']: ag['count'] for ag in age_cats}
        else:
            age_groups_dict = {ag['group']: ag['count'] for ag in stats.get('demographics', {}).get('age_groups', [])}
        age_groups_array = [age_groups_dict.get(g, 0) for g in age_group_order]

        # 9. Build departments dict for history (KPI=YES)
        departments_dict = {d['name']: d['count'] for d in stats.get('departments', [])}

        # 10. Build WHO categories dict for history (KPI=YES, from تصنيف who category 1)
        who_dict = stats.get('who_categories_kpi', {})
        if not who_dict and who_summary:
            who_dict = {w['category']: w['count'] for w in who_summary}

        # 11. Get mortality rate from statistics (KPI deaths / total patients)
        kpi_deaths = stats.get('kpi_deaths', len(df_cleaned))
        mortality_rate = stats.get('mortality_metrics', {}).get('rate', 0.0)

        # 12. Save to history
        # 12a. Save lean comparison data to history
        history_manager.save_quarter(
            quarter=quarter,
            year=year,
            rate=mortality_rate,
            deaths=kpi_deaths,
            total_patients=total_patients or 0,
            age_groups=age_groups_array,
            departments=departments_dict,
            who_categories=who_dict
        )

        # 12b. Save full stats to current data file (used by report generator + dashboard)
        # Only non-KPI records are saved — they are the patient-detail rows used in
        # the DOCX report's "deaths within 24h" page. All KPI=YES stats are pre-computed
        # in `statistics` so raw records are not needed for the dashboard.
        kpi_no_records = [
            r for r in records
            if str(r.get('include_kpi', 'YES')).strip().upper() != 'YES'
        ]
        history_manager.save_current_data(
            quarter=quarter,
            year=year,
            statistics=convert_numpy(dict(stats)),
            who_categories=who_summary or [],
            records=convert_numpy(kpi_no_records),
            total_patients=total_patients,
            validation=convert_numpy(validation),
        )

        logger.success(f"✅ Processing complete: {len(records)} records ({len(kpi_no_records)} non-KPI), saved to history")

        return convert_numpy({
            "success": True,
            "data": {
                "records": kpi_no_records,
                "total_records": len(records),
                "statistics": stats,
                "who_categories": who_summary,
                "validation": validation,
                "quarter": quarter,
                "year": year
            }
        })
    
    except Exception as e:
        logger.error(f"❌ Processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.debug(f"🗑️  Cleaned up: {temp_path}")
            except:
                pass

@router.get("/current")
async def get_current():
    """Return the latest uploaded quarter's full data (records + stats) for the dashboard."""
    try:
        entry = history_manager.get_latest_current_data()
        if not entry:
            return JSONResponse(status_code=404, content={"detail": "No current data found"})
        return convert_numpy({
            "records":        entry.get("records", []),
            "total_records":  len(entry.get("records", [])),
            "statistics":     entry.get("statistics", {}),
            "who_categories": entry.get("who_categories", []),
            "validation":     entry.get("validation", {}),
            "quarter":        entry.get("quarter", ""),
            "year":           entry.get("year", ""),
            "totalPatients":  entry.get("total_patients", 0),
        })
    except Exception as e:
        logger.error(f"Current data fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quarter")
async def get_quarter_data(q: str, year: str):
    """Return full dashboard data for a specific quarter (last 4 stored)."""
    try:
        entry = history_manager.get_current_data(q, year)
        if not entry:
            raise HTTPException(status_code=404, detail=f"No full data for {q} {year}. Upload it first.")
        return convert_numpy({
            "records":        entry.get("records", []),
            "total_records":  len(entry.get("records", [])),
            "statistics":     entry.get("statistics", {}),
            "who_categories": entry.get("who_categories", []),
            "validation":     entry.get("validation", {}),
            "quarter":        entry.get("quarter", ""),
            "year":           entry.get("year", ""),
            "totalPatients":  entry.get("total_patients", 0),
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quarter data fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available-quarters")
async def get_available_quarters():
    """Return list of quarters that have full data stored (up to last 4)."""
    try:
        entries = history_manager.load_current_data()
        return convert_numpy([
            {"quarter": e.get("quarter", ""), "year": e.get("year", "")}
            for e in entries
        ])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_history():
    try:
        history = history_manager.load_history()
        # Sort chronologically (oldest first) for the trend chart
        history.sort(key=lambda r: history_manager._quarter_sort_key(r))
        return convert_numpy(history)
    except Exception as e:
        logger.error(f"History fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-report")
async def generate_report(request: dict):
    """
    Generate DOCX report from processed data.

    Args (JSON body):
        data: dict with 'statistics' and optionally 'who_categories'
        quarter: str (e.g., "الفصل الثالث")
        year: str (e.g., "2025")

    Returns:
        File path and name for the generated report
    """
    try:
        quarter = request.get('quarter', 'الفصل الثالث')
        year = request.get('year', '2025')

        # Primary: load full stats from current data file (saved on upload)
        current_entry = history_manager.get_current_data(quarter, year)
        if current_entry:
            data = {
                'statistics': current_entry['statistics'],
                'who_categories': current_entry.get('who_categories', []),
                'records': current_entry.get('records', []),
            }
        else:
            # Fallback: reconstruct minimal statistics from the lean history entry
            hist_entries = history_manager.load_history()
            hist_entry = next(
                (r for r in hist_entries
                 if r.get('quarter') == quarter and r.get('year') == year),
                None
            )
            if hist_entry:
                age_groups = hist_entry.get('age_groups', [])
                age_entries = [{'count': c} for c in age_groups]
                departments_dict = hist_entry.get('departments', {})
                who_dict = hist_entry.get('who_categories', {})
                data = {
                    'statistics': {
                        'mortality_metrics': {'rate': hist_entry.get('rate', 0)},
                        'total_deaths': hist_entry.get('deaths', 0),
                        'kpi_deaths': hist_entry.get('deaths', 0),
                        'total_patients': hist_entry.get('total_patients', 0),
                        'departments': [
                            {'name': k, 'count': v}
                            for k, v in departments_dict.items()
                        ],
                        'who_categories_kpi': who_dict,
                        'demographics': {
                            'age_categories': age_entries,
                            'age_groups': age_entries,
                        },
                        'clinical': {},
                        'buildings': {},
                        'specialties': [],
                    },
                    'who_categories': [
                        {'category': k, 'count': v}
                        for k, v in who_dict.items()
                    ]
                }
            else:
                data = {}

        if not data or not data.get('statistics'):
            raise HTTPException(400, "No data found for this quarter. Please upload the data first.")

        # Load all history excluding current quarter
        # get_last_n_quarters returns newest-first, reverse for charts (oldest-first)
        history = history_manager.get_last_n_quarters(100, quarter, year)
        history = list(reversed(history))

        logger.info(f"Generating report for {quarter} {year}")

        result = await matplotlib_docx_generator.generate_report(
            data,
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
async def download_report(fileName: str):
    """
    Download a generated DOCX report by filename.

    Args:
        fileName: The report filename (e.g., "mortality_report_الفصل الثالث_2025_123456.docx")

    Returns:
        The DOCX file as a downloadable attachment
    """
    # Sanitize: prevent path traversal
    safe_name = os.path.basename(fileName)
    # Shared storage directory (same as Node backend)
    # __file__ is in python-service/app/api/ -> go up 3 levels to project root
    reports_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'reports'))
    file_path = os.path.join(reports_dir, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(404, f"Report not found: {safe_name}")

    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@router.get("/test")
async def test_endpoint():
    """Test endpoint"""
    return {
        "status": "ok",
        "service": "python-data-processor",
        "phase": "1 - AI Disabled"
    }