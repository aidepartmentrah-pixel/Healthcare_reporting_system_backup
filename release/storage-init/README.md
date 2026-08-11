This folder is intentionally empty in the release package.

`install_offline.sh` creates the real storage directories on the offline
server at install time. The application itself auto-creates its config
files (admin credentials, KPI targets) on first startup — nothing here
should ever contain real data; if you find real hospital data in this
folder, it does not belong in version control.
