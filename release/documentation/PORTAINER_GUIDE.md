# Managing the Stack Through Portainer (Optional)

If the offline server has Portainer CE installed (per RAH Lab's Offline
Debian Server Kit), you can manage this application through its web UI
instead of the command line. The command-line scripts in `release/scripts/`
still work either way — Portainer is an additional option, not a
replacement.

## Prerequisite

Images must already be loaded once via the command line:

```bash
cd release/scripts
./load_images.sh
```

Portainer does not load `.tar` files itself — that step always needs
`docker load`, which the script above does for you.

## Opening Portainer

Open a browser to `https://<offline-server-IP>:9443` and log in with your
Portainer admin credentials.

## Creating the stack

1. In the left menu, go to **Stacks** → **Add stack**.
2. Name it `healthcare-reporting`.
3. Under **Build method**, choose **Web editor**.
4. Open `release/compose/docker-compose.offline.yml` in a text editor on
   the server, copy its full contents, and paste them into the web editor.
5. Scroll to **Environment variables** and add the values from
   `release/compose/.env.offline.template` (adjust `STORAGE_ROOT`,
   `BACKEND_PORT`, `FRONTEND_PORT` as needed for this server).
6. Click **Deploy the stack**.

## Verifying it's running

Go to **Stacks** → `healthcare-reporting`. Both `backend` and `frontend`
should show a green/running status. Click a container name to view its
logs directly in the browser.

## Updating the stack

When a new release arrives:
1. Load the new images: `./release/scripts/load_images.sh` (from the new
   release folder).
2. In Portainer, open the `healthcare-reporting` stack, update the web
   editor contents with the new `docker-compose.offline.yml` if it
   changed, and click **Update the stack** — check **Re-pull image and
   redeploy** is *not* needed (images are loaded locally, not pulled).

## Stopping / restarting

Use the **Stop** / **Start** / **Restart** buttons on the stack page. This
is equivalent to `stop_stack.sh` / `start_stack.sh`.

## Confirming there's no database to check

Unlike RAH Lab's SQL Server-based projects, there is no database container
in this stack — only `backend` and `frontend`. If you're used to checking
for a `sqlserver` service here, there isn't one; that's expected for this
application.
