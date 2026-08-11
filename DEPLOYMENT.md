# Deployment — Online Staging (Docker Desktop, LAN-reachable)

This covers running the Healthcare Reporting System via Docker Compose on this
laptop (RAH Lab's "Online Staging" step), reachable by other devices on the
same LAN. This is **not** the offline Debian production deployment — see
`release/documentation/INSTALL_OFFLINE.md` for that, once an offline host
exists.

There is no database. All application state is flat JSON + uploaded Excel
files under two `storage/` directories (see "Where data lives" below). This
is a deliberate, approved architecture decision — do not add a database.

## Start / stop

```bash
# first time: copy the env template and adjust ports if needed
cp .env.example .env

docker compose up -d --build   # build images and start
docker compose ps              # check status
docker compose logs -f         # follow logs (Ctrl+C to stop watching)
docker compose down            # stop and remove containers (data survives — see below)
```

Default ports: frontend `8080`, backend `8001` (change via `.env`, but see
the warning in `.env.example` about the backend port being hardcoded into
the frontend's fallback logic).

## Accessing it

- From this laptop: `http://localhost:8080`
- From another device on the same LAN: `http://<this-laptop-LAN-IP>:8080`
  (find the IP with `ipconfig`, look for the Wi-Fi/Ethernet adapter's IPv4
  address)

Default admin login is `admin` / `admin123` (auto-created on first backend
startup). **Change this immediately** via the Admin panel after first login
— it's a well-known default.

## Where data lives

Everything that matters is under two directories, both bind-mounted into
the containers so rebuilding images never touches them:

- `./storage/` (repo root) — mounted to `/storage` in the backend container
- `./python-service/storage/` — mounted to `/app/storage` in the backend
  container

(Both exist because the application code itself resolves paths
inconsistently — some modules use `storage/...` relative to the app's
working directory, others use `../storage/...`. This is pre-existing
behavior, not something this deployment changes.)

This holds: uploaded Excel files, generated charts, generated DOCX reports,
quarterly history JSON per module, and `storage/config/{admin.json,
targets.json}` (admin credentials and KPI targets).

## Backup

There's no database to dump — just archive both storage directories:

```bash
tar -czf healthcare-backup-$(date +%Y%m%d-%H%M%S).tar.gz storage python-service/storage
```

Store the archive somewhere off this laptop (network share, external drive).

## Restore

```bash
docker compose down
tar -xzf healthcare-backup-<timestamp>.tar.gz
docker compose up -d
```

## Updating

```bash
git pull                       # or however new code arrives
docker compose up -d --build   # rebuilds images, same volumes — data survives
```

Backend session tokens live in memory only (not persisted), so anyone
logged into the admin panel will need to log in again after a backend
restart or update. This does not affect the underlying data.

## Known limitations (not fixed here, flagging only)

- Mortality's `history_manager.py` prunes detailed per-quarter JSON older
  than 8 quarters (2 years) on every new quarter save — only the high-level
  summary is kept indefinitely. Worth revisiting if longer detailed history
  retention becomes a requirement.
- Arabic glyph rendering in generated charts depends on `fonts-dejavu-core`
  inside the Linux container; verify visually after first deployment since
  the app previously only ran on Windows with its own font set.
