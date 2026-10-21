#!/usr/bin/env bash
# Redeploy the production stack: backup, pull both repositories, rebuild, start, verify.
#
#   ./update.sh                     backup, pull, rebuild and restart everything that changed
#   ./update.sh slicer-engine       only the backend (after a backend-only merge)
#   ./update.sh pod-frontend        only the frontend
#   ./update.sh --no-backup ...     skip the backup (frontend-only changes need no database backup)
#
# Run as the deploy user (sudo rights are needed for the backup). Exits non-zero when the
# backend fails to start or a smoke check fails, so a broken deploy is never silent.
set -euo pipefail

cd "$(dirname "$0")"
FRONTEND_REPO=$(cd .. && pwd)
BACKEND_REPO=$(cd ../../cad-slicer-engine && pwd)
SITE=${SITE_ADDRESS:-3dburg.ch}

backup=true
services=()
for arg in "$@"; do
    case "$arg" in
        --no-backup) backup=false ;;
        -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
        *) services+=("$arg") ;;
    esac
done

step() { printf '\n== %s ==\n' "$1"; }

if $backup; then
    step "backup"
    sudo ./backup.sh | tail -1
fi

step "pull"
git -C "$BACKEND_REPO" pull --ff-only
git -C "$FRONTEND_REPO" pull --ff-only
echo "backend   $(git -C "$BACKEND_REPO" log --oneline -1)"
echo "frontend  $(git -C "$FRONTEND_REPO" log --oneline -1)"

step "build and start"
docker compose up -d --build --remove-orphans "${services[@]}"
# The Caddyfile is bind-mounted as a single file: when git replaces it the container keeps the
# old inode, so neither a reload nor a restart sees the change. Recreating the container does
# (about a second; the certificates live on a volume and are kept).
docker compose up -d --force-recreate caddy

step "waiting for the backend"
for _ in $(seq 1 36); do
    status=$(docker compose ps --format '{{.Service}} {{.Status}}' | grep '^slicer-engine ' || true)
    case "$status" in
        *healthy*) break ;;
        *unhealthy*|*Exited*|*Restarting*) break ;;
    esac
    sleep 5
done
docker compose ps --format '{{.Service}}  {{.Status}}'

step "migration and startup"
docker compose logs --tail 400 slicer-engine \
    | grep -E 'Migrating schema|Successfully (applied|validated)|Started CadSlicerEngineApplication|APPLICATION FAILED' \
    | tail -4 || true
if ! docker compose ps --format '{{.Service}} {{.Status}}' | grep -q '^slicer-engine .*healthy'; then
    echo "backend is not healthy; last log lines:" >&2
    docker compose logs --tail 40 slicer-engine >&2
    exit 1
fi

step "smoke"
failed=0
for path in / /upload /api/orders/settings /api/quotes/options; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE$path")
    printf '%s  %s\n' "$code" "$path"
    [ "$code" = "200" ] || failed=1
done
[ "$failed" = "0" ] || { echo "smoke check failed" >&2; exit 1; }

echo
echo "deployed: backend $(git -C "$BACKEND_REPO" rev-parse --short HEAD), frontend $(git -C "$FRONTEND_REPO" rev-parse --short HEAD)"
