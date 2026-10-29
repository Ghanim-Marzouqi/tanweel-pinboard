#!/usr/bin/env bash
# Restore into disposable volumes on a network-isolated PostgreSQL container.
# Never starts an application worker and never touches production volumes.
set -euo pipefail
umask 077
BACKUP=${1:?Usage: restore-test.sh /var/backups/tanweel-pinboard/TIMESTAMP}
BACKUP=$(realpath "$BACKUP")
(cd "$BACKUP" && sha256sum -c SHA256SUMS)
TAG="pinboard-restore-test-$(date +%s)-$$"
DB="$TAG-db"
UPLOADS="$TAG-uploads"
cleanup() {
 result=$?
 docker rm -f "$DB" >/dev/null 2>&1 || true
 docker volume rm "$DB" "$UPLOADS" >/dev/null 2>&1 || true
 exit "$result"
}
trap cleanup EXIT
docker volume create "$DB" >/dev/null
docker volume create "$UPLOADS" >/dev/null
PASSWORD=$(openssl rand -hex 24)
docker run -d --name "$DB" --network none --log-driver local \
 -e POSTGRES_PASSWORD="$PASSWORD" -e POSTGRES_DB=pinboard_restore_test \
 -v "$DB:/var/lib/postgresql" postgres:18-alpine >/dev/null
for attempt in $(seq 1 60); do
 if docker exec "$DB" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$DB" pg_isready -U postgres >/dev/null
docker exec -i "$DB" pg_restore --exit-on-error --no-owner --no-acl -U postgres -d pinboard_restore_test < "$BACKUP/database.dump"
docker run --rm --network none --log-driver local -v "$UPLOADS:/restore" -v "$BACKUP:/backup:ro" \
 --entrypoint sh postgres:18-alpine -c 'set -e; tar -xzf /backup/uploads.tar.gz -C /restore; cd /restore; if test -s /backup/uploads.sha256; then sha256sum -c /backup/uploads.sha256; fi'
# Check every stored attachment exists, its size, and the application can write.
docker exec "$DB" psql -U postgres -d pinboard_restore_test -At -F '|' \
 -c 'SELECT "storageKey", "sizeBytes" FROM task_attachments' > "$BACKUP/restore-attachments.txt"
docker run --rm --network none --log-driver local -v "$UPLOADS:/restore" -v "$BACKUP:/backup:ro" \
 --entrypoint sh postgres:18-alpine -c '
 while IFS="|" read -r key size; do
  test -n "$key" || continue
  test "$(stat -c %s "/restore/$key")" = "$size" || exit 1
 done < /backup/restore-attachments.txt'
docker run --rm --network none --log-driver local --user 1001:1001 -v "$UPLOADS:/restore" \
 --entrypoint sh postgres:18-alpine -c 'touch /restore/.restore-write-test && rm /restore/.restore-write-test'
docker exec "$DB" psql -U postgres -d pinboard_restore_test -c \
 "SELECT 'users' AS kind,count(*) FROM users UNION ALL SELECT 'projects',count(*) FROM projects UNION ALL SELECT 'tasks',count(*) FROM tasks UNION ALL SELECT 'attachments',count(*) FROM task_attachments;"
echo "Restore verified in isolated disposable volumes: $BACKUP"
