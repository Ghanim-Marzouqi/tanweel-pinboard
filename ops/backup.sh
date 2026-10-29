#!/usr/bin/env bash
# Briefly stop the single writer so SQL and attachment files form one snapshot.
set -euo pipefail
umask 077
ROOT=${PINBOARD_ROOT:-/srv/tanweel-pinboard}
DEST=${PINBOARD_BACKUPS:-/var/backups/tanweel-pinboard}
COMPOSE="$ROOT/current/ops/compose.sh"
mkdir -p "$DEST"
exec 9>"$ROOT/backup.lock"
flock -n 9 || { echo 'Another backup is running' >&2; exit 1; }
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
PART="$DEST/.partial-$STAMP"
mkdir "$PART"
RESTART=0
cleanup() {
  result=$?
  if [[ $RESTART == 1 ]]; then "$COMPOSE" start app || result=1; fi
  if [[ $result != 0 ]]; then echo "Backup failed; partial files retained at $PART" >&2; fi
  exit "$result"
}
trap cleanup EXIT
[[ -n $("$COMPOSE" ps --status running -q app) ]] || { echo 'App is not running; refusing scheduled backup' >&2; exit 1; }
RESTART=1
"$COMPOSE" stop -t 60 app
"$COMPOSE" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$PART/database.dump"
# A root process can read all files; the archive preserves numeric ownership.
"$COMPOSE" run --rm --no-deps -T --user 0 --entrypoint tar app -C /app/storage -czf - . > "$PART/uploads.tar.gz"
"$COMPOSE" run --rm --no-deps -T --user 0 --entrypoint sh app -c 'cd /app/storage && find . -type f -exec sha256sum {} \; | sort' > "$PART/uploads.sha256"
cp "$ROOT/.env" "$PART/runtime.env"
cp "$ROOT/current/docker-compose.yml" "$ROOT/current/docker-compose.production.yml" "$PART/"
cp "$ROOT/current/RELEASE" "$PART/RELEASE"
tar -C "$ROOT/current" -czf "$PART/source.tar.gz" .
"$COMPOSE" exec -T db sh -c 'pg_restore --list' < "$PART/database.dump" > "$PART/database.contents"
tar -tzf "$PART/uploads.tar.gz" > "$PART/uploads.contents"
(cd "$PART" && sha256sum database.dump uploads.tar.gz uploads.sha256 runtime.env source.tar.gz RELEASE > SHA256SUMS)
"$COMPOSE" start --wait --wait-timeout 120 app
RESTART=0
mv "$PART" "$DEST/$STAMP"
# Only complete, date-named backups are subject to retention.
find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -mtime +13 -exec rm -rf -- {} +
echo "Backup complete: $DEST/$STAMP"
