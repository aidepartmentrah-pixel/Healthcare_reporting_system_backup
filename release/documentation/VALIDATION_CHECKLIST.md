# Validation Checklist

Use this after every install or update, on the offline server. No
database-related items appear here — there is no database in this
application.

## Infrastructure

- [ ] `docker compose ps` shows both `backend` and `frontend` as
      `running`/`healthy`
- [ ] `curl http://localhost:<BACKEND_PORT>/health` returns
      `{"status":"healthy",...}`
- [ ] `curl http://localhost:<FRONTEND_PORT>/` returns HTTP 200
- [ ] Storage directories exist and are writable:
      `STORAGE_ROOT/app-storage/`, `STORAGE_ROOT/root-storage/`
- [ ] From a second machine on the same (offline) network, the frontend
      URL loads

## Application

- [ ] Login succeeds with the current admin credentials
- [ ] Default credentials were changed (not still `admin`/`admin123`,
      unless this is a fresh install about to have that done now)
- [ ] At least one module's Excel upload completes without error
- [ ] Report generation (DOCX) succeeds and downloads correctly
- [ ] Generated charts display Arabic text correctly (no missing-glyph
      boxes)
- [ ] Previously existing quarterly history is visible (for updates —
      confirms data survived)

## Resilience

- [ ] `docker compose restart backend` — service comes back healthy,
      previously uploaded data still visible
- [ ] Full stack stop/start (`stop_stack.sh` then `start_stack.sh`) —
      same result
- [ ] A fresh `backup_storage.sh` run produces a non-empty archive

## Documentation / process

- [ ] This deployment is recorded in the Release Register (project name,
      version, date, installed by, rollback available: yes)
- [ ] The backup archive from just before this install/update is stored
      off-server
