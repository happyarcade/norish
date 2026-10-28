#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DOCKER_DIR}/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-${DOCKER_DIR}/.env.production}"
backup_dir="${1:-}"
confirmation="${2:-}"

if [[ -z "${backup_dir}" || "${confirmation}" != "--yes" ]]; then
  echo "Usage: $0 /path/to/norish-backup --yes" >&2
  echo "This replaces the current Norish database and uploaded media." >&2
  exit 2
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi

for required_file in database.dump uploads.tar.gz manifest.txt SHA256SUMS; do
  if [[ ! -f "${backup_dir}/${required_file}" ]]; then
    echo "Backup is missing ${required_file}." >&2
    exit 1
  fi
done

(
  cd "${backup_dir}"
  sha256sum --check SHA256SUMS
)

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

if ! "${compose[@]}" ps --status running --services | grep -qx db; then
  echo "The production database service is not running." >&2
  exit 1
fi

echo "Stopping Norish before restore..."
"${compose[@]}" stop -t 75 norish >/dev/null 2>&1 || true

echo "Replacing the PostgreSQL database..."
"${compose[@]}" exec -T db sh -c \
  'dropdb --force --if-exists --username="$POSTGRES_USER" "$POSTGRES_DB" && createdb --username="$POSTGRES_USER" "$POSTGRES_DB"'

"${compose[@]}" exec -T db sh -c \
  'exec pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --exit-on-error --no-owner --no-acl' \
  <"${backup_dir}/database.dump"

echo "Replacing uploaded recipe media..."
"${compose[@]}" run --rm --no-deps -T --entrypoint sh norish -c \
  'find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && exec tar -C /app/uploads -xzf -' \
  <"${backup_dir}/uploads.tar.gz"

echo "Starting Norish..."
"${compose[@]}" up -d --no-deps norish >/dev/null

container_id="$("${compose[@]}" ps -q norish)"
for _ in $(seq 1 60); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
  if [[ "${status}" == "healthy" ]]; then
    echo "Restore complete and Norish is healthy."
    exit 0
  fi
  if [[ "${status}" == "unhealthy" || "${status}" == "exited" ]]; then
    break
  fi
  sleep 2
done

echo "Restore completed, but Norish did not become healthy. Inspect the logs:" >&2
echo "  docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} logs --tail=200 norish" >&2
exit 1
