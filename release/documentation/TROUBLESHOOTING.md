# Troubleshooting

## `docker: command not found`

Docker Engine isn't installed on this server. This release package assumes
Docker is already set up (per RAH Lab's Offline Debian Server Kit). Install
that first.

## `install_offline.sh` fails at "Waiting for backend health check"

Check the backend logs:

```bash
docker logs healthcare-backend
```

Common causes:
- **Port already in use**: something else on the server is already using
  port 8001 (or whatever `BACKEND_PORT` is set to). Change `BACKEND_PORT`
  in `.env` and re-run `docker compose up -d` from the install directory.
- **Storage permission error**: the container can't write to the mounted
  storage folders. Check ownership/permissions on the `STORAGE_ROOT` path
  shown in `.env`.

## Frontend loads but shows a blank page / can't reach the API

1. Confirm the backend is actually healthy:
   `curl http://localhost:8001/health` (run this ON the server).
2. From another machine, confirm you can reach both ports:
   `curl http://<server-IP>:8080/` and `curl http://<server-IP>:8001/health`.
   If the frontend port works but the backend port doesn't, check firewall
   rules on the offline server — both ports need to be reachable from the
   client machines, not just the frontend port.
3. Open the browser's developer console (F12) on the failing page and look
   for the failed request URL. It should be
   `http://<server-IP>:8001/api/...`. If it's pointing at the wrong host or
   port, check `release/compose/docker-compose.offline.yml`'s `BACKEND_PORT`
   matches what `frontend/public/config.json`'s fallback expects (port
   8001) — see the note in that compose file before changing it.

## "Invalid username or password" on login

Default credentials are `admin` / `admin123`. If they were already changed
by a previous operator and you don't know the new ones, there is no
password-reset command — the credentials live in
`storage/app-storage/config/admin.json` (PBKDF2-hashed, not recoverable by
reading the file). Recovery options:
- Ask whoever last changed it.
- Restore a backup taken before the change (loses any data changes since
  that backup — see `BACKUP_RESTORE.md`).
- As a last resort, stop the stack, delete
  `storage/app-storage/config/admin.json`, and restart — the backend
  recreates it with the default `admin`/`admin123` on next startup.

## A container keeps restarting

```bash
docker compose ps
docker logs <container-name>
```

Look at the last error in the logs. If it's a Python traceback, capture it
and treat it as an application bug report — Docker infrastructure isn't
the cause once containers build and start; a crash loop after that point
usually means an application-level issue (e.g. corrupted JSON in
storage) rather than something the release package controls.

## Need to see everything happening

```bash
release/scripts/show_logs.sh /opt/healthcare-reporting
```

Follows both containers' logs live. Ctrl+C to stop watching (containers
keep running).

## Nothing works and you need to start over

1. `release/scripts/backup_storage.sh` first, always — even if the app
   seems badly broken, the data underneath may still be intact.
2. `release/scripts/stop_stack.sh`
3. Re-run `release/scripts/install_offline.sh` — it's safe to re-run; it
   won't overwrite an existing `.env`, and it recreates containers cleanly.
