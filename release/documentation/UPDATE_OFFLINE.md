# Updating an Existing Offline Installation

Use this when a new release package arrives to update an already-installed
system. Existing data is preserved automatically — there is no database
migration step because there is no database.

## Before you start

- Copy the **new** `release/` folder onto the offline server (a different
  location than the old one, e.g. `release_1.1.0/`).
- Know where the existing installation lives (default:
  `/opt/healthcare-reporting`).

## Step 1 — Run the updater from the NEW release folder

```bash
cd release_1.1.0/scripts
./update_offline.sh
```

Or, if the existing installation is somewhere other than the default:

```bash
./update_offline.sh /path/to/existing/install
```

This will, in order:
1. Load the new backend/frontend images.
2. **Automatically back up storage first** (via `backup_storage.sh`) —
   see the printed backup file path, in case you need to roll back.
3. Replace the compose file with the new version.
4. Recreate the containers using the new images. Storage volumes are not
   touched, so uploaded files, history, and admin credentials survive.
5. Wait for the backend health check and report success or failure.

## Step 2 — Verify

```bash
./verify_installation.sh /path/to/existing/install
```

Confirm in the browser that previously entered data (quarterly history,
uploaded reports) is still visible.

## Rolling back if the update fails

The updater backs up storage before making changes, and the previous
release's image tar files still exist in the old release folder.

1. Stop the stack: `./stop_stack.sh /path/to/existing/install`
2. From the **old** release folder, reload the old images:
   `./scripts/load_images.sh`
3. Restore the compose file: copy the old release's
   `compose/docker-compose.offline.yml` back into the install directory.
4. If storage was also corrupted (rare — only structural code changes can
   cause this, since there's no schema to break): restore the backup with
   `restore_storage.sh <backup-file>` from the old release folder.
5. Start the stack again: `./start_stack.sh /path/to/existing/install`
6. Record what happened and why in your release register.
