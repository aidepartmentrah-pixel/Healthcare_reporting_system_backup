# Installing the Healthcare Reporting System — Offline Debian Server

This guide is for an IT operator with limited Linux/Docker experience,
installing the system for the first time on an offline Debian server (no
internet access). Every command below is exact — copy and paste it.

There is **no database** for this application. All data is stored as files
under a `storage/` folder that this guide creates for you. There is no SQL
Server, PostgreSQL, or any other database to install.

## Before you start

You need:
- The `release/` folder from this package, copied onto the offline server
  (via the hospital's approved DVD/USB transfer procedure).
- Docker Engine already installed on the server (per RAH Lab's Offline
  Debian Server Kit — see that kit's own install guide if Docker itself is
  missing).
- A terminal on the offline server, in the folder containing `release/`.

## Step 1 — Check Docker is present

```bash
docker --version
docker compose version
```

Expected: both commands print a version number. If either fails, Docker
Engine or the Compose plugin isn't installed — stop here and install those
first (see the Offline Debian Server Kit documentation).

## Step 2 — Run the installer

```bash
cd release/scripts
./install_offline.sh
```

This installs to `/opt/healthcare-reporting` by default. To install
somewhere else:

```bash
./install_offline.sh /path/you/want
```

The script will:
1. Load the backend and frontend Docker images from the tar files.
2. Copy the compose file and a `.env` configuration file into the install
   location.
3. Create the persistent storage folders.
4. Start both containers.
5. Wait for the backend to report healthy.
6. Print the URL and default login.

Expected final output:

```
==================================================================
 Installation complete.

 Open: http://<this-server-IP>:8080
 Default login: admin / admin123
 CHANGE THIS PASSWORD IMMEDIATELY via the Admin panel.
==================================================================
```

## Step 3 — Find the server's IP address

```bash
ip addr show | grep "inet "
```

Look for the address on the hospital's internal network interface (not
`127.0.0.1`). Use that IP in a browser from any other machine on the same
offline network: `http://<that-IP>:8080`.

## Step 4 — First login and password change

1. Open the URL above in a browser.
2. Log in with `admin` / `admin123`.
3. Go to the Admin panel and set a new username/password immediately.

## Step 5 — Verify

```bash
cd release/scripts
./verify_installation.sh
```

Expected: `All checks passed.`

If anything fails, see `TROUBLESHOOTING.md`.

## What just happened, technically

- Two containers are now running: `healthcare-backend` and
  `healthcare-frontend`.
- All application data (uploads, generated charts/reports, quarterly
  history, admin credentials, KPI targets) lives under
  `/opt/healthcare-reporting/storage/` (or wherever you installed to) — not
  inside the containers. Rebuilding or replacing the containers later never
  touches this data.
- There is no database service running and none is needed.
