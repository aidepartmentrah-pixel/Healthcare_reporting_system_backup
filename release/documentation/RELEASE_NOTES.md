# Release Notes

## Version 1.0.2

Frontend External Dependency Audit: the frontend loaded the Cairo and Inter
web fonts from Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`)
at runtime via a CSS `@import`. This was the only external Internet
dependency found in the frontend (no CDN scripts, icon libraries, analytics,
or other remotely-loaded assets were present). Replaced with the
`@fontsource/cairo` and `@fontsource/inter` npm packages so both fonts are
bundled into the production build and served as local static assets — same
fonts, same weights (400/500/600/700/800/900), no visual change. Verified by
inspecting the production build output for external URL references and by
running the built image on a Docker network with no internet route
(`--internal`), confirming the app serves fully (HTML, CSS, JS, fonts, logo)
with zero reachable external domains. The backend image is unchanged and
was re-tagged to `1.0.2` only to keep the shared `RELEASE_VERSION` in sync
with the frontend.

## Version 1.0.1

Fixed a false-negative frontend healthcheck: the container's healthcheck
used `wget http://localhost/`, but inside the Alpine-based frontend image
`localhost` resolves to `::1` (IPv6) via `/etc/hosts`, while nginx only
listens on IPv4 (`listen 80;`). The healthcheck therefore reported
`unhealthy` even though the site was fully reachable and working over the
actual published port. Changed the healthcheck to target `127.0.0.1`
directly. No functional/user-facing behavior changed — this only affects
`docker compose ps` / Portainer status display accuracy.

## Version 1.0.0

**Database engine:** None — file-based JSON storage under `storage/`, plus
Excel uploads processed with pandas. Approved exception to RAH Lab's
Microsoft SQL Server standard; there is no database to declare beyond this.

**Components in this release:**

| Component | Version |
|---|---|
| Backend image (`rah-healthcare-backend`) | 1.0.0 |
| Frontend image (`rah-healthcare-frontend`) | 1.0.0 |
| Database migration | N/A — no database |
| Release package | 1.0.0 |

**What's included:**
- Mortality, Medication Error, VAP, CLABSI, and CAUTI reporting modules
- Admin panel with login (default `admin`/`admin123` — must be changed
  after install)
- Excel upload → statistics → DOCX report generation, including Arabic-text
  charts (verified rendering correctly under Debian/Linux with
  `fonts-dejavu-core`)
- LAN-accessible frontend via dynamic host detection (no rebuild needed if
  the server's IP changes)

**Known issues (not fixed in this release, tracked for future work):**
- Mortality's quarterly history manager (`history_manager.py`) prunes
  detailed per-quarter data older than 8 quarters (2 years) on every new
  quarter save. Only the high-level summary is retained indefinitely for
  older quarters — the detailed breakdown (age groups, departments, WHO
  categories, individual records) is deleted. Revisit if longer detailed
  retention becomes a requirement.
- Optional AI-assisted analysis features (`ENABLE_AI`) require
  `llama-cpp-python` and a local model, neither of which are installed by
  default. These features gracefully fall back to static analysis when
  unavailable — this is expected, not a bug.

**Upgrade notes:** N/A for 1.0.0 (first release).
