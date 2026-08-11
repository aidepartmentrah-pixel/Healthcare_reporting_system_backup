# Linux Commands Reference

Quick reference for operators unfamiliar with Linux. All commands assume
Debian and a Bash shell.

## Navigating

| Command | Purpose |
|---|---|
| `pwd` | Show current directory |
| `ls -la` | List files, including hidden ones |
| `cd /opt/healthcare-reporting` | Change directory |

## Docker

| Command | Purpose |
|---|---|
| `docker ps` | List running containers |
| `docker ps -a` | List all containers, including stopped |
| `docker images` | List loaded images |
| `docker logs healthcare-backend` | Show backend logs |
| `docker logs -f healthcare-backend` | Follow backend logs live (Ctrl+C to stop) |
| `docker logs healthcare-frontend` | Show frontend logs |
| `docker compose ps` | Show status of services in the current compose project |
| `docker compose down` | Stop and remove containers (data in volumes is kept) |
| `docker compose up -d` | Start containers in the background |
| `docker system df` | Show disk space used by Docker |

Run compose commands from inside the install directory (where
`docker-compose.offline.yml` and `.env` live), or use the wrapper scripts
in `release/scripts/` which handle this for you.

## Checking network/IP

| Command | Purpose |
|---|---|
| `ip addr show` | List network interfaces and IP addresses |
| `curl http://localhost:8001/health` | Check backend is responding locally |
| `curl http://localhost:8080/` | Check frontend is responding locally |

## Disk and files

| Command | Purpose |
|---|---|
| `df -h` | Show free disk space |
| `du -sh /opt/healthcare-reporting/storage` | Show size of the storage folder |
| `tar -tzf backup.tar.gz` | List contents of a backup archive without extracting |

## Permissions

| Command | Purpose |
|---|---|
| `chmod +x script.sh` | Make a script executable |
| `sudo` prefix | Run a command as administrator (needed for some Docker/system operations depending on server setup) |

## Editing files

`nano` is the simplest editor for beginners:

```bash
nano /opt/healthcare-reporting/.env
```

Ctrl+O then Enter to save, Ctrl+X to exit.
