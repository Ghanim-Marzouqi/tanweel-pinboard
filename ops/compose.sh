#!/usr/bin/env bash
set -euo pipefail
ROOT=${PINBOARD_ROOT:-/srv/tanweel-pinboard}
exec docker compose --project-name tanweel-pinboard --env-file "$ROOT/.env" \
  -f "$ROOT/current/docker-compose.yml" -f "$ROOT/current/docker-compose.production.yml" "$@"
