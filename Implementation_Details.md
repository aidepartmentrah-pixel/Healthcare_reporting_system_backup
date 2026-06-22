# Server Implementation Details

Last updated: 2026-05-21  
Server IP: 170.70.32.34

---

## Two Separate Projects Running on This Server

### 1. Patient Feedback (Complaints System) — DO NOT TOUCH

| Component | Type | Port | Path |
|-----------|------|------|------|
| Frontend | IIS "Default Web Site" | **80** | `C:\inetpub\wwwroot` |
| Backend | Windows Service "PatientFeedbackAPI" | **8000** | `C:\Users\Administrator\Documents\GitHub\Patient_Feedback` |

- Access URL: `http://170.70.32.34/`
- This system was set up first. It runs as a Windows service managed by NSSM.
- **Do not restart, modify, or redeploy this unless intentionally working on it.**

---

### 2. Healthcare Reporting System — Active Development

| Component | Type | Port | Path |
|-----------|------|------|------|
| Frontend | IIS "HealthcareReporting" | **8080** | `C:\Users\Administrator\Documents\GitHub\Healthcare_reporting_system_backup\frontend\dist` |
| Backend | Windows Service "HealthcareBackend" | **8001** | `C:\Users\Administrator\Documents\GitHub\Healthcare_reporting_system_backup\python-service` |

- Access URL: `http://170.70.32.34:8080/`
- Backend is FastAPI (Python), managed by NSSM as a Windows service.
- Frontend is a React app built with Vite. IIS serves the **built** `dist/` folder.
- API URL is configured in: `frontend/public/config.json` (no rebuild needed to change IP).

---

## How to Update the Healthcare Reporting System After Code Changes

### Update the backend (Python changes):
```powershell
Restart-Service -Name "HealthcareBackend"
```

### Update the frontend (React/JS changes):
```powershell
cd "C:\Users\Administrator\Documents\GitHub\Healthcare_reporting_system_backup\frontend"
node_modules\.bin\vite.cmd build
```
IIS picks up the new build automatically — no IIS restart needed.

### Update both (after a git pull or merge):
```powershell
Restart-Service -Name "HealthcareBackend"
cd "C:\Users\Administrator\Documents\GitHub\Healthcare_reporting_system_backup\frontend"
node_modules\.bin\vite.cmd build
```

---

## How to Sync New Changes from the Original Repo (Upstream)

The Healthcare Reporting system was forked from:
`https://github.com/MalakAlKazem/Healthcare_reporting_system_backup`

To pull in new changes from the original:
```powershell
cd "C:\Users\Administrator\Documents\GitHub\Healthcare_reporting_system_backup"
git fetch upstream
git merge upstream/master
# Resolve any conflicts, then:
Restart-Service -Name "HealthcareBackend"
cd frontend
node_modules\.bin\vite.cmd build
```

---

## Port Summary

| Port | Service | Project |
|------|---------|---------|
| 80   | IIS (Default Web Site) | Patient Feedback frontend |
| 8000 | PatientFeedbackAPI (NSSM service) | Patient Feedback backend |
| 8080 | IIS (HealthcareReporting site) | Healthcare Reporting frontend |
| 8001 | HealthcareBackend (NSSM service) | Healthcare Reporting backend |
