# Smart Healthcare Reporting System

A comprehensive hospital reporting platform with **five integrated modules**: Mortality Analysis, Medication Error Reporting, VAP, CLABSI, and CAUTI Infection Control. Each module processes Excel data uploaded by hospital staff, tracks quarterly history, generates interactive Arabic/English dashboards, and produces fully formatted Arabic RTL Word reports with embedded charts and AI-written analysis.

---

## Table of Contents

- [Overview](#overview)
- [Modules](#modules)
  - [Mortality Analysis](#1-mortality-analysis)
  - [Medication Error Reporting](#2-medication-error-reporting)
  - [VAP Infection Control](#3-vap-ventilator-associated-pneumonia)
  - [CLABSI Infection Control](#4-clabsi-central-line-associated-bloodstream-infection)
  - [CAUTI Infection Control](#5-cauti-catheter-associated-urinary-tract-infection)
- [Admin Panel](#admin-panel)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Data Flow](#data-flow)
- [Data Processing & Validation](#data-processing--validation)
- [Report Generation](#report-generation)
- [AI Analysis](#ai-analysis)
- [History & Storage](#history--storage)
- [API Endpoints](#api-endpoints)
- [Installation](#installation)
- [Running the System](#running-the-system)
- [Local Deployment (Production)](#local-deployment-production)
- [Usage Guide](#usage-guide)
  - [Admin Panel](#admin-panel-1)

---

## Overview

This system replaces manual Excel-based hospital reporting with an automated pipeline. Hospital staff upload a quarterly Excel file, and the system:

1. Parses and validates the data automatically
2. Calculates all KPIs, rates, and statistical breakdowns
3. Stores the quarter in a history file for trend tracking
4. Displays a live interactive dashboard
5. Generates a complete Arabic RTL Word report with charts and AI-written analysis — in under 60 seconds

No database required. All data is stored in versioned JSON flat files.

---

## Modules

### 1. Mortality Analysis

Tracks quarterly inpatient deaths across all hospital departments.

**What it calculates:**
- Total deaths vs KPI deaths (deaths qualifying for the official mortality rate)
- Mortality rate = KPI deaths / total admitted patients × 100
- Death breakdown by: department, building (BCI/RAH), gender, age group, admission source, WHO disease category, doctor specialty
- Length of stay distribution
- Month-by-month trend within the quarter

**Dashboard features:**
- Mortality rate KPI card vs target
- Building distribution (BCI vs RAH)
- Age group bar chart
- Department pie chart
- WHO diagnosis categories
- Historical quarterly trend (last 10 quarters)

---

### 2. Medication Error Reporting

Monitors medication mistakes reported across hospital departments.

**What it calculates:**
- Error count by type (wrong dose, wrong drug, wrong patient, wrong route, wrong time, omission)
- Error count by severity level
- Department-level breakdown and ranking
- Quarter-over-quarter trend
- AI-generated Arabic narrative analysis per section

**Dashboard features:**
- Error type distribution chart
- Severity heatmap
- Department comparison bar chart
- Historical trend line

---

### 3. VAP (Ventilator-Associated Pneumonia)

Tracks VAP cases per 1000 ventilator days across ICU floors.

**Floors tracked:** ICU, CCU, CSU, Ped, ICN, ITU, Neonatal

**What it calculates per floor:**
- VAP rate (‰) = cases / ventilator days × 1000
- Status vs target rate (floor-specific targets)
- Germ distribution (type, count, percentage)
- Per-case details: age (with display format: "53Y", "3M", "10D"), gender, diagnosis, dates, ventilation duration, risk factors, germ

**Target rates:**

| Floor | Target (‰) |
|-------|-----------|
| ICU   | 25.0      |
| CCU   | 15.0      |
| CSU   | 9.5       |
| Ped   | 5.5       |
| ICN   | 10.0      |
| ITU   | 25.0      |
| Neonatal | 0.0   |

**Dashboard features:**
- Gauge per floor (rate vs target, color-coded)
- Germ distribution heatmap across all floors
- Quarterly trend chart (Actual Rate vs Target line)
- Summary table with all floor metrics

---

### 4. CLABSI (Central Line-Associated Bloodstream Infection)

Tracks central-line infections per 1000 catheter days across departments.

**What it calculates:**
- CLABSI rate (‰) = cases / catheter days × 1000 per department
- Germ distribution with percentages
- Quarter-over-quarter trend
- Per-case details: age, gender, diagnosis, floor, risk factors, germ, dates

**Dashboard features:**
- Rate gauges per department
- Trend chart
- Germ heatmap
- Case detail table

---

### 5. CAUTI (Catheter-Associated Urinary Tract Infection)

Tracks urinary catheter infections per 1000 urinary catheter days across departments.

**What it calculates:**
- CAUTI rate (‰) = cases / urinary catheter days × 1000 per department
- Germ distribution with percentages
- Quarter-over-quarter trend
- Per-case details: age, gender, diagnosis, floor, risk factors, germ, dates

**Dashboard features:**
- Rate gauges per department
- Trend chart
- Germ heatmap
- Case detail table (same shared component as CLABSI)

> **Note:** CAUTI uses the **same shared infrastructure** as CLABSI — shared processor, shared statistics engine (`InfectionControlStatistics`), shared docx generator (`ic_docx_generator.py`), shared chart generator, and shared frontend pages — configured by a type parameter.

---

## Admin Panel

The Admin Panel lets authorized users change KPI target values for all modules and update the admin login credentials — without touching any config files or restarting the server.

**Access:** Navigate to `/admin` in the browser (e.g. `http://localhost:3000/admin`).

### Authentication

The system uses a **single unified login** for both the frontend and the admin panel. Credentials are validated against the backend on every login — no credentials are stored in the browser.

| Field | Default value |
|-------|--------------|
| Username | `admin` |
| Password | *(set during first setup — stored hashed in `admin.json`)* |

> Change your password immediately after first login using **Settings → Change Credentials**.

### What you can do

| Action | Description |
|--------|-------------|
| **Edit targets** | Update KPI target rates for Mortality, Medication Error, VAP, CLABSI, and CAUTI. Changes take effect immediately across all dashboards. |
| **Change credentials** | Set a new username and password. All active sessions are invalidated and you must log in again. |

### Default Target Values

| Module | Field | Default |
|--------|-------|---------|
| Mortality | Mortality Rate | 2.0 % |
| Medication Error | Error Rate | 0.03 % |
| VAP | Per-floor target rates | ICU 25‰ · CCU 15‰ · CSU 9.5‰ · Ped 5.5‰ · ICN 10‰ · ITU 25‰ |
| CLABSI | Per-floor target rates | ICU 10‰ · CCU 9‰ · CSU 4‰ · ICN 14‰ |
| CAUTI | Per-floor target rates | ICU 4.5‰ · CCU 4.5‰ · CSU 4.5‰ · Ped 1.6‰ · ICN 4.5‰ |

### How it works

- Targets stored in `python-service/storage/config/targets.json`, loaded on every dashboard visit.
- Admin credentials stored as a salted SHA-256 hash in `python-service/storage/config/admin.json` — plaintext is never stored.
- Login issues a short-lived in-memory Bearer token (lost on server restart).
- Changing credentials immediately invalidates all active sessions.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | 19.x / 7.x |
| Routing | React Router | v6 |
| Charts (UI) | Recharts | 2.10 |
| Styling | Tailwind CSS + CSS Modules | 4.x |
| Internationalization | i18next + react-i18next | 23.x |
| HTTP Client | Axios | 1.6 |
| Backend API | FastAPI + Uvicorn | 0.128 / 0.40 |
| Data Processing | Pandas + NumPy | 3.0 / 2.4 |
| Excel Parsing | openpyxl | 3.1 |
| Report Generation | python-docx | 1.2 |
| Charts (Reports) | Matplotlib + Pillow | 3.10 / 12 |
| Arabic Text | arabic-reshaper + python-bidi | 3.0 / 0.4 |
| AI Analysis | llama-cpp-python + Qwen 2.5-7B GGUF | local |
| Logging | Loguru | 0.7 |
| Storage | JSON flat files | — |

---

## Architecture Overview

The system is split into two processes that communicate over HTTP:

```
┌──────────────────────────────────────────────────────┐
│  React Frontend (port 3000 dev / port 80 production) │
│  • React Router for module navigation                 │
│  • Recharts for interactive dashboards                │
│  • i18next for Arabic/English switching               │
│  • Axios → HTTP → FastAPI                            │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP (localhost:8000)
┌────────────────────▼─────────────────────────────────┐
│  FastAPI Backend (port 8000)                         │
│  • 5 routers (mortality, medication, vap, clabsi,    │
│    cauti) registered in main.py                      │
│  • All heavy work done in Python                     │
│  • No database — JSON flat files                     │
└──────────────────────────────────────────────────────┘
```

### Shared Infection Control Architecture

CLABSI, CAUTI, and VAP share a common backend engine located in `app/infection_control/`:

```
infection_control/
├── ic_statistics.py      ← InfectionControlStatistics('clabsi'|'cauti'|'vap')
├── ic_docx_generator.py  ← InfectionControlDocxGenerator (configurable per type)
├── ic_chart_generator.py ← InfectionControlChartGenerator
├── ic_ai_service.py      ← Shared AI service
├── clabsi/               ← CLABSI-specific: processor, history, targets, docx config
├── cauti/                ← CAUTI-specific: processor, history, targets, docx config
└── vap/                  ← VAP-specific: processor, history, ai_service, chart, docx
```

Each module passes its type string at construction time. The shared engines handle calculations, charts, and report layout generically — only the column names, targets, and floor lists differ.

---

## Project Structure

```
healthcare_motality_system/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js                 # Dev server on port 3000
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx                    # Main router + all route definitions
│       ├── main.jsx                   # React entry point
│       ├── components/
│       │   └── Navbar.jsx             # Top navigation bar
│       ├── i18n/
│       │   └── config.js              # Arabic / English translation strings
│       ├── styles/                    # CSS Modules (shared across modules)
│       │   ├── Dashboard.module.css
│       │   ├── Home.module.css
│       │   ├── Reports.module.css
│       │   └── Upload.module.css
│       └── pages/
│           ├── Home.jsx               # Module selector home page
│           ├── mortality/
│           │   ├── Dashboard.jsx      # Mortality charts and KPIs
│           │   ├── Upload.jsx         # Mortality Excel upload
│           │   └── Reports.jsx        # Mortality Word report
│           ├── medication/
│           │   ├── Dashboard.jsx      # Medication error dashboard
│           │   ├── Upload.jsx         # Medication error upload
│           │   └── Reports.jsx        # Medication error Word report
│           └── infection_control/
│               ├── Upload.jsx         # Shared upload page (tab: vap/clabsi/cauti)
│               ├── Reports.jsx        # Shared reports page (type prop)
│               ├── vap/
│               │   └── Dashboard.jsx  # VAP gauges, heatmap, trend
│               ├── clabsi/
│               │   └── Dashboard.jsx  # CLABSI gauges, germ heatmap
│               └── cauti/
│                   └── Dashboard.jsx  # CAUTI gauges, germ heatmap
│
├── python-service/
│   ├── main.py                        # FastAPI app: CORS, all 5 routers, startup
│   ├── requirements.txt
│   ├── assets/
│   │   └── LOGO.png                   # Hospital logo embedded in Word reports
│   └── app/
│       ├── config.py                  # Settings (paths, env vars)
│       ├── api/                       # FastAPI route handlers
│       │   ├── mortality_routes.py    # /api/*
│       │   ├── medication_routes.py   # /api/medication/*
│       │   ├── vap_routes.py          # /api/vap/*
│       │   ├── clabsi_routes.py       # /api/clabsi/*
│       │   └── cauti_routes.py        # /api/cauti/*
│       ├── mortality/                 # Mortality module
│       │   ├── data_processor.py      # Excel parsing, cleaning, validation
│       │   ├── excel_handler.py       # Multi-sheet Excel reader with auto-detection
│       │   ├── statistics.py          # KPI calculations, department breakdown
│       │   ├── history_manager.py     # Read/write mortality_history.json
│       │   ├── docx_generator.py      # 6-page Arabic Word report
│       │   ├── chart_generator.py     # 10 Matplotlib charts
│       │   └── ai_service.py          # Qwen AI paragraphs (mortality)
│       ├── medication/                # Medication error module
│       │   ├── data_processor.py      # Excel parsing and normalization
│       │   ├── statistics.py          # Error type, severity, department stats
│       │   ├── history_manager.py     # Read/write medication_error_history.json
│       │   ├── chart_generator.py     # 7 Matplotlib charts
│       │   ├── docx_generator.py      # Multi-page Arabic Word report
│       │   └── ai_service.py          # Qwen AI paragraphs (medication)
│       └── infection_control/         # Shared IC engine + per-type modules
│           ├── ic_statistics.py       # InfectionControlStatistics('clabsi'|'cauti'|'vap')
│           ├── ic_docx_generator.py   # InfectionControlDocxGenerator (shared report builder)
│           ├── ic_chart_generator.py  # InfectionControlChartGenerator (shared charts)
│           ├── ic_ai_service.py       # Shared AI service for IC modules
│           ├── clabsi/
│           │   ├── processor.py       # openpyxl Excel parser → normalized case dicts
│           │   ├── history.py         # clabsi_current.json + clabsi_history.json
│           │   ├── clabsi_targets.py  # Per-floor target rates
│           │   └── docx_generator.py  # CLABSI-specific docx config wrapper
│           ├── cauti/
│           │   ├── processor.py       # openpyxl Excel parser → normalized case dicts
│           │   ├── history.py         # cauti_current.json + cauti_history.json
│           │   ├── cauti_targets.py   # Per-floor target rates
│           │   └── docx_generator.py  # CAUTI-specific docx config wrapper
│           └── vap/
│               ├── processor.py       # openpyxl Excel parser + age_display field
│               ├── history.py         # VAP_current.json + VAP_history.json + FLOOR_TARGETS
│               ├── chart_generator.py # 6 Matplotlib charts (VAP-specific)
│               ├── docx_generator.py  # VAP Word report
│               └── ai_service.py      # Qwen AI paragraphs (VAP, 11 methods)
│
├── storage/                           # Runtime-generated (not committed except .gitkeep)
│   ├── data/
│   │   ├── mortality_history.json
│   │   ├── VAP_history.json
│   │   ├── VAP_current.json           # Latest VAP quarter raw cases
│   │   ├── clabsi_history.json
│   │   ├── clabsi_current.json        # Latest CLABSI quarter raw cases
│   │   ├── cauti_history.json
│   │   ├── cauti_current.json         # Latest CAUTI quarter raw cases
│   │   └── medication_error_history.json
│   ├── reports/                       # Generated .docx files
│   ├── charts/                        # Generated .png chart files
│   ├── uploads/                       # Temporary Excel uploads
│   └── temp/
│
└── sample_data/                       # Example Excel files for testing
    ├── mortality-data2.xlsx
    ├── Medication Error3.xlsx
    └── infection_control.xlsx
```

---

## Data Flow

### Upload Flow (same pattern for all 5 modules)

```
Hospital Staff
    │
    │  Upload Excel file via browser
    ▼
React Upload Page
    │  POST multipart/form-data
    │  (file + quarter + year + module-specific params)
    ▼
FastAPI Route Handler
    ├── 1. Validate file type (.xlsx / .xls only)
    ├── 2. Save file temporarily to storage/uploads/ or storage/temp/
    ├── 3. Parse Excel → normalized case dicts
    │       • Mortality: Pandas DataFrame (excel_handler → data_processor)
    │       • IC (VAP/CLABSI/CAUTI): openpyxl row-by-row (processor.py)
    │       • Medication: Pandas DataFrame (data_processor.py)
    ├── 4. Calculate statistics
    │       • Mortality: statistics.py (custom)
    │       • IC: InfectionControlStatistics(type).calculate_all_statistics()
    │       • Medication: statistics.py (custom)
    ├── 5. Save raw cases to *_current.json (IC modules only)
    ├── 6. Save quarter summary to *_history.json
    ├── 7. Delete temp file
    └── 8. Return statistics JSON to React
    │
    ▼
React Dashboard (live charts and KPIs from returned JSON)
```

### Report Generation Flow

```
React Reports Page
    │  User selects quarter → clicks "Generate Report"
    │  POST /generate-report { quarter, year, [statistics] }
    ▼
FastAPI Report Route
    ├── 1. Load history (for trend charts across quarters)
    ├── 2. Load current raw cases from *_current.json (IC modules)
    ├── 3. Generate charts (Matplotlib → BytesIO PNG, never written to disk)
    ├── 4. Call AI service:
    │       • Load Qwen 2.5-7B GGUF model via llama-cpp-python
    │       • Generate 2–3 sentence Arabic analysis per section
    │       • Validate output (length, Arabic chars, no CJK contamination)
    │       • Fall back to static Arabic text if AI fails or model not found
    │       • Unload model from memory after report completes
    ├── 5. Build Word document (python-docx with raw XML for RTL/BiDi)
    ├── 6. Save .docx to storage/reports/
    └── 7. Return file path to React
    │
    ▼
React shows download link
    │  GET /download-report?fileName=...
    ▼
Browser downloads the .docx file
```

### Current JSON Pattern (IC Modules)

VAP, CLABSI, and CAUTI each maintain two separate JSON files:

| File | Purpose |
|------|---------|
| `*_history.json` | Summary statistics for every quarter (rates, floor stats, germ counts) |
| `*_current.json` | Raw case rows from the latest uploaded quarter (for case detail tables in reports) |

The report generator reads **both**: history for trend charts, current for per-patient case tables.

---

## Data Processing & Validation

### Mortality Data Validation

The mortality processor applies **conservative cleaning** — no records are ever deleted.

**Source Auto-Detection**

The system detects whether the file is a proper Excel (Arabic column names) or a misencoded CSV export:
- If > 10 garbled characters and < 3 Arabic column names → **CSV mode** (maps by position)
- Otherwise → **Excel mode** (maps by Arabic/English column name)

**Column Standardization**

| Hospital Column | Internal Name |
|----------------|--------------|
| `العمر` / `Age` | `age` |
| `الجنس` / `gender` | `gender` |
| `القسم التمريضي` | `nursing_department` |
| `تاريخ الدخول` | `admission_date` |
| `تاريخ الوفاة` | `death_date` |
| `تصنيف who category 1` | `who_category_1` |
| `include kpi` | `include_kpi` |
| `المبنى` | `building` |
| `الإختصاص` | `specialty` |

**Age Cleaning**

| Input | Output |
|-------|--------|
| `45` | `45.0` years |
| `"1 month"` | `0.083` years |
| `"10 days"` | `0.027` years |
| `-1`, `999`, empty | `"Unknown"` (record kept) |

**KPI Flag** — determines if the death counts toward the official mortality rate:

| Input | Result |
|-------|--------|
| `"YES"` / `"yes"` / `"Y"` / `"نعم"` / `1` / `True` | KPI = YES |
| Everything else | KPI = NO |

**Age Categories** assigned after cleaning:
```
< 5 years | 5–15 | 16–30 | 31–50 | 51–60 | 61–70 | 71–80 | 81+
```

---

### Infection Control Data Validation (VAP / CLABSI / CAUTI)

IC data is processed with `openpyxl` directly (row by row) rather than Pandas, because each row requires structured multi-field parsing including boolean risk factor columns.

**Column Normalization**
```
"  Heart disease " → strip → lowercase → "heart disease" → "heart_disease"
```

**Age Parsing (VAP)**

| Input | Output |
|-------|--------|
| `"45Y"` | `45.0` years |
| `"3M"` | `0.25` years |
| `"10D"` | `0.027` years |
| `"N/A"` / empty | `None` |

An `age_display` field is also stored (e.g., `"53Y"`, `"3M"`, `"10D"`) for rendering in report tables.

**Date Parsing** — 4 formats tried automatically:
```
DD/MM/YYYY  |  DD/MM/YY  |  YYYY-MM-DD  |  MM/DD/YYYY
```

**Risk Factor Parsing** — 13+ Yes/No boolean columns:

| Input | Result |
|-------|--------|
| `"Yes"` / `True` / `1` / `"نعم"` | `True` |
| `"No"` / `False` / `0` | `False` |

**Rate Calculation (per floor)**
```
IC Rate (‰) = (cases on floor / device days on floor) × 1000

VAP:   device days = ventilator days
CLABSI: device days = catheter days
CAUTI:  device days = urinary catheter days
```

**Floor Matching** — `_match_floor()` handles name aliases:
```python
"ICU" matches: "ICU", "INTENSIVE CARE UNIT", "MICU", "SICU", "TICU"
"ICN" matches: "ICN", "NICU", "NEONATAL ICU", "INFANT CARE NURSERY"
```
This ensures floors are matched even if the Excel uses slightly different spelling.

---

### Medication Error Validation

- Error type normalized to fixed categories
- Severity levels mapped to standard tiers (minor, moderate, severe)
- Department names trimmed and lowercased for consistent grouping
- Empty or unrecognized values default to `"غير محدد"` — no record dropped

---

## Report Generation

### Mortality Word Report (6 pages)

| Page | Contents |
|------|---------|
| 1 | Metadata table, results table (KPI vs total deaths), trend chart, AI analysis box |
| 2 | Building distribution chart (BCI/RAH), admission source chart, age distribution chart |
| 3 | Department pie chart + data table, age-vs-quarter trend chart |
| 4 | Department comparison chart (current vs previous quarter), WHO age category chart |
| 5 | WHO diagnosis categories chart, doctor specialty table |
| 6 | Final result statement, previous actions table, current actions table, approval/signature table |

All 10 charts generated as `BytesIO` PNG buffers in memory (never written to disk) and embedded directly.

---

### VAP Word Report (multi-page)

| Section | Contents |
|---------|---------|
| Page 1 | Metadata, 6-quarter results table, floor comparison table, AI analysis |
| Per-floor sections | Trend chart + AI analysis, Germ comparison chart + AI analysis, Case detail table + AI analysis |
| Last page | Final result, action tracking tables, approval table |

**Case detail tables** are built dynamically from `VAP_current.json` — only floors that actually have cases appear. Columns: case number, age (display format), gender, diagnosis, admission date, intubation date, infection date, germ, risk factors, ventilation duration.

---

### CLABSI / CAUTI Word Reports

Identical structure built by `InfectionControlDocxGenerator` with CLABSI/CAUTI config:

| Section | Contents |
|---------|---------|
| Page 1 | Metadata, 6-quarter results table, floor comparison table |
| Per-floor sections | Trend chart + analysis, Germ chart + analysis, Case detail table + analysis |
| Last page | Final result, action tables, approval table |

Case detail tables built dynamically from `clabsi_current.json` / `cauti_current.json`.

---

## AI Analysis

All modules use the same local AI model: **Qwen 2.5-7B Instruct** in GGUF format, loaded via `llama-cpp-python`. Runs entirely on your machine — no internet or API required.

For each report section, the AI:
1. Receives a focused Arabic prompt with exact numbers from the data
2. Generates a 2–3 sentence Arabic analysis paragraph
3. Output is validated (minimum length, Arabic characters present, no CJK contamination, no bullet points)
4. If validation fails → a pre-written static Arabic fallback is used

**The report is always complete even if the AI fails or the model is not installed.**

After the report is saved, the model is automatically unloaded from memory so it does not conflict with other modules.

---

### GPU Setup (Recommended)

Using a GPU dramatically speeds up generation (~10s GPU vs ~60s CPU).

**Requirements:**
- NVIDIA GPU with CUDA support
- [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) matching your driver version
- Verify: `nvcc --version` and `nvidia-smi`

**Install llama-cpp-python (pre-built wheel — no compiler needed):**

```bash
# CUDA 12.2
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu122

# CUDA 12.1
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121

# CUDA 12.0
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu120

# CUDA 11.8
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu118
```

---

### CPU Setup (Fallback)

```bash
pip install llama-cpp-python --prefer-binary --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```

Then open each AI service file and change `n_gpu_layers=-1` to `n_gpu_layers=0`:

- `python-service/app/mortality/ai_service.py`
- `python-service/app/medication/ai_service.py`
- `python-service/app/infection_control/vap/ai_service.py`
- `python-service/app/infection_control/ic_ai_service.py`

---

### Download the Model

```bash
pip install huggingface_hub
python -c "
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id='Qwen/Qwen2.5-7B-Instruct-GGUF',
    filename='qwen2.5-7b-instruct-q3_k_m.gguf',
    local_dir='C:/models'
)
"
```

Or manually download and place at `C:\models\qwen2.5-7b-instruct-q3_k_m.gguf`.

The model is searched in these locations (in order):
```
C:/models/*.gguf
models/*.gguf
/models/*.gguf
/app/models/*.gguf
python-service/models/*.gguf
```

Any quantization variant works (`q3_k_m`, `q4_k_m`, `q5_k_m`). Higher = better quality, more VRAM.

---

### Editing the Model Path

If your model is in a different location, set the environment variable before starting:

```bash
# Windows
set QWEN_MODEL_PATH=D:/my-models/qwen2.5-7b-instruct-q3_k_m.gguf

# Linux / macOS
export QWEN_MODEL_PATH=/home/user/models/qwen2.5-7b-instruct-q3_k_m.gguf
```

Or edit the `candidates` list in `_load_llm()` in each AI service file.

---

## History & Storage

Each module stores quarterly data in two tiers:

- **History file** — lean summary per quarter (rates, counts, germ distributions). Used for trend charts. Never trimmed.
- **Per-quarter files** — full data (individual case rows, complete statistics) for each of the last **8 quarters**. Oldest file is deleted automatically when the 9th quarter is uploaded.

| Module | History File | Per-quarter Directory |
|--------|-------------|----------------------|
| Mortality | `storage/data/mortality_history.json` | `storage/data/mortality/quarters/` |
| VAP | `storage/data/VAP_history.json` | `storage/data/VAP/cases/` |
| CLABSI | `storage/data/clabsi_history.json` | `storage/data/CLABSI/cases/` |
| CAUTI | `storage/data/cauti_history.json` | `storage/data/CAUTI/cases/` |
| Medication Error | `storage/data/medication_error_history.json` | `storage/data/medication/quarters/` |

Per-quarter files are named `{year}_Q{n}.json` (e.g. `2025_Q3.json`). The dashboard's quarter selector reads the available files and lets the user switch between any of the last 8 quarters. The selected quarter is also used when generating a report — downloading the report always uses whichever quarter is currently selected in the top-of-page selector.

**VAP history entry example:**
```json
{
  "quarter": "الفصل الرابع",
  "year": "2025",
  "floors": {
    "ICU": { "cases": 2, "ventilator_days": 1200, "rate": 1.67, "target": 25.0 },
    "CCU": { "cases": 4, "ventilator_days": 980,  "rate": 4.08, "target": 15.0 }
  },
  "germs_overall": { "Klebsiella": 3, "Acinetobacter": 2 }
}
```

**VAP current entry example:**
```json
{
  "year": "2025",
  "quarter": "الفصل الرابع",
  "cases": [
    {
      "floor": "ICU", "age": 53.0, "age_display": "53Y", "gender": "Male",
      "diagnosis": "ARDS", "germs": "Klebsiella",
      "diabetic": true, "copd": false,
      "admission_date": "2025-10-01", "infection_date": "2025-10-07"
    }
  ]
}
```

Generated reports → `storage/reports/` | Charts → `storage/charts/`

---

## API Endpoints

All endpoints documented interactively at **http://localhost:8000/docs** (Swagger UI).

### Mortality

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/process-data` | Upload and process mortality Excel |
| `GET` | `/api/history` | Get all saved quarterly records |
| `POST` | `/api/generate-report` | Generate mortality Word report |
| `GET` | `/api/download-report?fileName=...` | Download generated .docx |
| `GET` | `/api/test` | Health check |

### Medication Error

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/medication/process-data` | Upload and process medication error Excel |
| `GET` | `/api/medication/history` | Get all saved quarterly records |
| `POST` | `/api/medication/generate-report` | Generate medication error Word report |
| `GET` | `/api/medication/download-report?fileName=...` | Download generated .docx |

### VAP Infection Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/vap/process-data` | Upload VAP Excel + floor ventilator days |
| `GET` | `/api/vap/history` | Get all saved quarters (oldest → newest) |
| `GET` | `/api/vap/history/latest` | Get the most recent quarter |
| `GET` | `/api/vap/chart-data` | Get data for dashboard charts |
| `GET` | `/api/vap/table-comparison?n=5` | Multi-floor comparison table (last n quarters) |
| `POST` | `/api/vap/generate-report` | Generate VAP Word report |
| `GET` | `/api/vap/download-report?fileName=...` | Download generated .docx |
| `DELETE` | `/api/vap/history/{quarter}/{year}` | Delete a specific quarter |

### CLABSI Infection Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/clabsi/process-data` | Upload CLABSI Excel + catheter days |
| `GET` | `/api/clabsi/history` | Get all saved quarterly records |
| `GET` | `/api/clabsi/history/latest` | Get the most recent quarter |
| `POST` | `/api/clabsi/generate-report` | Generate CLABSI Word report |
| `GET` | `/api/clabsi/download-report?fileName=...` | Download generated .docx |
| `DELETE` | `/api/clabsi/history/{year}/{quarter}` | Delete a specific quarter |

### CAUTI Infection Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cauti/process-data` | Upload CAUTI Excel + urinary catheter days |
| `GET` | `/api/cauti/history` | Get all saved quarterly records |
| `GET` | `/api/cauti/history/latest` | Get the most recent quarter |
| `POST` | `/api/cauti/generate-report` | Generate CAUTI Word report |
| `GET` | `/api/cauti/download-report?fileName=...` | Download generated .docx |
| `DELETE` | `/api/cauti/history/{year}/{quarter}` | Delete a specific quarter |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/admin/login` | — | Validate credentials, return session token |
| `POST` | `/api/admin/logout` | Bearer token | Invalidate current session token |
| `GET` | `/api/admin/targets` | — | Get all target values (public — used by dashboards) |
| `PUT` | `/api/admin/targets` | Bearer token | Update target values for one or more modules |
| `PUT` | `/api/admin/credentials` | Bearer token | Change admin username and password |

---

## Installation

### Prerequisites

- **Python** 3.10 or higher
- **Node.js** 18 or higher (tested with v24.x)
- **CUDA Toolkit** (optional, for GPU AI inference — see [GPU Setup](#gpu-setup-recommended))

### 1. Clone the Repository

```bash
git clone <repository-url>
cd healthcare_motality_system
```

### 2. Python Backend

```bash
cd python-service

# Create virtual environment
python -m venv venv

# Activate — Windows
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**For AI support, also install llama-cpp-python:**

```bash
# GPU (check your CUDA version with: nvcc --version)
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu122

# CPU only (slower)
pip install llama-cpp-python --prefer-binary --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```

### 3. Frontend

```bash
cd frontend
npm install
```

### 4. Model File (for AI analysis)

```bash
pip install huggingface_hub
python -c "
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id='Qwen/Qwen2.5-7B-Instruct-GGUF',
    filename='qwen2.5-7b-instruct-q3_k_m.gguf',
    local_dir='C:/models'
)
"
```

---

## Running the System

> **Windows:** Set `PYTHONUTF8=1` before starting the backend to ensure correct Arabic text encoding in Word reports.

**Terminal 1 — Python Backend:**

```bash
cd python-service

# Windows
set PYTHONUTF8=1 && venv\Scripts\python.exe main.py

# macOS / Linux
PYTHONUTF8=1 python main.py
```

**Terminal 2 — React Frontend:**

```bash
cd frontend
npm run dev
```

**Access:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Python API | http://localhost:8000 |
| API Docs (Swagger UI) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

---

## Local Deployment (Production)
 
For deploying on a local server so the entire hospital network can access it — without Docker.

### Step 1 — Build the React Frontend

```bash
cd frontend
npm run build
```

This creates `frontend/dist/` — a static folder of optimized HTML/JS/CSS files.

### Step 2 — Serve the Frontend with a Static Web Server

Install a lightweight static file server (choose one):

**Option A — nginx (recommended for Windows/Linux servers):**

1. Download nginx from https://nginx.org/en/download.html
2. Create or edit `nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    # Serve the React build
    root C:/path/to/healthcare_motality_system/frontend/dist;
    index index.html;

    # Handle React Router (all unknown paths → index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. Start nginx: `nginx` (Windows) or `sudo systemctl start nginx` (Linux)

**Option B — Python's built-in server (quick test only):**

```bash
cd frontend/dist
python -m http.server 80
```

> Note: This does not support React Router. Use nginx for proper deployment.

### Step 3 — Run the Python Backend as a Background Service

**Windows — Run as a background process:**

```bash
cd python-service
set PYTHONUTF8=1
start /B venv\Scripts\python.exe main.py > logs\service.log 2>&1
```

**Windows — Run as a Windows Service (permanent, survives reboot):**

Install [NSSM](https://nssm.cc/download) (Non-Sucking Service Manager), then:

```bash
nssm install HealthcareAPI "C:\path\to\python-service\venv\Scripts\python.exe" "C:\path\to\python-service\main.py"
nssm set HealthcareAPI AppDirectory "C:\path\to\python-service"
nssm set HealthcareAPI AppEnvironmentExtra "PYTHONUTF8=1"
nssm start HealthcareAPI
```

**Linux — Run with systemd (permanent service):**

Create `/etc/systemd/system/healthcare-api.service`:

```ini
[Unit]
Description=Healthcare Quality Indicators API
After=network.target

[Service]
User=your-user
WorkingDirectory=/path/to/python-service
Environment=PYTHONUTF8=1
ExecStart=/path/to/python-service/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable healthcare-api
sudo systemctl start healthcare-api
sudo systemctl status healthcare-api
```

### Step 4 — Update Frontend API URL for Network Access

If other computers on the network will access this system, update the API URL in the frontend before building.

Create `frontend/.env.production`:

```env
VITE_API_URL=http://YOUR-SERVER-IP:8000
```

Then update any hardcoded `http://localhost:8000` references in the frontend source to use `import.meta.env.VITE_API_URL`.

Rebuild after changing:

```bash
cd frontend
npm run build
```

### Step 5 — Allow Port Through Firewall

**Windows Firewall:**

```bash
# Allow port 80 (frontend)
netsh advfirewall firewall add rule name="Healthcare Frontend" dir=in action=allow protocol=TCP localport=80

# Allow port 8000 (API — only if directly accessed)
netsh advfirewall firewall add rule name="Healthcare API" dir=in action=allow protocol=TCP localport=8000
```

**Linux (ufw):**

```bash
sudo ufw allow 80
sudo ufw allow 8000   # only if API is directly accessed, not proxied
```

### Step 6 — Verify

| Check | URL |
|-------|-----|
| Frontend (from server) | http://localhost |
| Frontend (from network) | http://YOUR-SERVER-IP |
| API Health | http://YOUR-SERVER-IP:8000/health |
| API Docs | http://YOUR-SERVER-IP:8000/docs |

### Network Architecture (Deployed)

```
Hospital LAN
    │
    │  http://SERVER-IP   (port 80)
    ▼
nginx (static files + reverse proxy)
    ├── / → frontend/dist/index.html  (React app)
    └── /api/ → 127.0.0.1:8000       (FastAPI)
                    │
                    ▼
              Python backend
              (storage/data/*.json  on server disk)
```

---

## Usage Guide

### Mortality Analysis

1. Navigate to **Mortality → Upload**
2. Select quarter and year
3. Enter the total number of admitted patients this quarter
4. Upload the mortality Excel file (`.xlsx` or `.xls`)
5. Click **Process** — the dashboard appears automatically
6. Navigate to **Dashboard** to view charts and KPIs
7. Navigate to **Reports** → click **Generate Word Report** → download the `.docx` file

### Medication Error

1. Navigate to **Medication Error → Upload**
2. Select quarter and year, upload Excel file
3. View the **Dashboard** for error breakdowns and trends
4. Navigate to **Reports** → click **Generate Report** → download

### VAP Infection Control

1. Navigate to **VAP → Upload**
2. Select quarter and year
3. Enter the ventilator days for each floor (ICU, CCU, CSU, Ped, ICN, ITU, Neonatal)
4. Upload the infection control Excel file
5. Click **Process** — data saved to history + raw cases saved to VAP_current.json
6. View the **Dashboard** for floor gauges, heatmap, and trend chart
7. Navigate to **Reports** → select the quarter → click **Generate Report** → download

### CLABSI Infection Control

1. Navigate to **CLABSI → Upload**
2. Select quarter and year, enter catheter days per floor, upload Excel
3. View the **Dashboard** for rate gauges and germ distribution
4. Navigate to **Reports** → click **Generate Report** → download

### CAUTI Infection Control

1. Navigate to **CAUTI → Upload**
2. Select quarter and year, enter urinary catheter days per floor, upload Excel
3. View the **Dashboard** for rate gauges and germ distribution
4. Navigate to **Reports** → click **Generate Report** → download

### Admin Panel

1. Navigate to `http://localhost:3000/admin`
2. Log in with the admin credentials (default: `admin` / `admin123`)
3. **To update targets:** Edit the target values for any module in the **Target Values** section, then click **Save Targets**. Changes apply immediately to all dashboards.
4. **To change credentials:** Fill in the **New Username**, **New Password**, and **Confirm Password** fields in the **Change Credentials** section, then click **Update Credentials**. You will be logged out automatically and must sign in with the new credentials.

> For production deployments, change the default credentials on first login.

---

## Version

**3.0.0** — Five-module platform: Mortality Analysis · Medication Error Reporting · VAP · CLABSI · CAUTI Infection Control

- Shared Infection Control engine (`InfectionControlStatistics`, `InfectionControlDocxGenerator`, `InfectionControlChartGenerator`) serving CLABSI, CAUTI, and VAP
- Raw case storage pattern (`*_current.json`) for all three IC modules — enables dynamic per-floor case tables in reports
- `age_display` field (`53Y` / `3M` / `10D`) in VAP and IC processors
- Arabic RTL Word reports with correct BiDi rendering (run-level `<w:rtl/>` for mixed Arabic/Latin text)
- AI analysis with automatic GPU/CPU fallback and post-report memory unloading
