# Backup and Restore

There is no database, so there is nothing to "dump." Backup and restore
both operate on one thing: the `storage/` directory tree that holds every
piece of application data (uploads, generated charts/reports, quarterly
history JSON, admin credentials, KPI targets).

## What gets backed up

Two sub-folders under the configured `STORAGE_ROOT` (see `.env` in the
install directory):
- `app-storage/` — config (admin credentials, KPI targets), quarterly
  history data, most charts/reports/temp files
- `root-storage/` — uploads and a few chart/temp paths

`backup_storage.sh` archives both together in one `.tar.gz`.

## Taking a backup

```bash
cd release/scripts
./backup_storage.sh
```

Or, for a non-default install location:

```bash
./backup_storage.sh /path/to/install
```

Output: `<deploy_dir>/backups/healthcare-storage-backup-<timestamp>.tar.gz`

**Copy this file off the server** (network share, external drive) — a
backup that lives only on the same disk as the live system doesn't protect
against disk failure.

Recommended schedule: before every update (the updater does this
automatically), and on a regular interval (e.g. weekly) via cron:

```bash
# Example crontab entry — weekly backup at 2am Sunday
0 2 * * 0 /opt/healthcare-reporting/release/scripts/backup_storage.sh
```

## Restoring a backup

This **stops the application and replaces all current data** with the
backup's contents. Only do this if you're sure.

```bash
cd release/scripts
./restore_storage.sh /path/to/healthcare-storage-backup-<timestamp>.tar.gz
```

The script asks for a typed `YES` confirmation before touching anything.

After restore, verify:

```bash
./verify_installation.sh
```

And confirm in the browser that the expected historical data is present.
