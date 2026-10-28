#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="$(cd -- "${DOCKER_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DOCKER_DIR}/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-${DOCKER_DIR}/.env.production}"
BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_DIR}/backups}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required." >&2
  exit 1
}

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

if ! "${compose[@]}" ps --status running --services | grep -qx db; then
  echo "The production database service is not running." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${BACKUP_ROOT}/norish-${timestamp}"
work_dir="${BACKUP_ROOT}/.norish-${timestamp}.incomplete"
app_was_running=false

mkdir -p "${BACKUP_ROOT}"
chmod 700 "${BACKUP_ROOT}"
rm -rf -- "${work_dir}"
mkdir -p "${work_dir}"

if "${compose[@]}" ps --status running --services | grep -qx norish; then
  app_was_running=true
fi

restart_app() {
  if [[ "${app_was_running}" == "true" ]]; then
    "${compose[@]}" up -d --no-deps norish >/dev/null
  fi
}

cleanup() {
  local status=$?
  rm -rf -- "${work_dir}"
  restart_app
  exit "${status}"
}

trap cleanup EXIT INT TERM

if [[ "${app_was_running}" == "true" ]]; then
  echo "Stopping Norish briefly for a consistent backup..."
  "${compose[@]}" stop -t 75 norish >/dev/null
fi

echo "Backing up PostgreSQL..."
"${compose[@]}" exec -T db sh -c \
  'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --compress=6 --no-owner --no-acl' \
  >"${work_dir}/database.dump"

echo "Backing up uploaded recipe media..."
"${compose[@]}" run --rm --no-deps -T --entrypoint sh norish -c \
  'exec tar -C /app/uploads -czf - .' \
  >"${work_dir}/uploads.tar.gz"

cat >"${work_dir}/manifest.txt" <<EOF
created_utc=${timestamp}
compose_project=${COMPOSE_PROJECT_NAME:-norish}
database_format=postgres_custom
uploads_format=tar_gzip
EOF

(
  cd "${work_dir}"
  sha256sum database.dump uploads.tar.gz manifest.txt >SHA256SUMS
)

mv -- "${work_dir}" "${backup_dir}"
work_dir=""
trap - EXIT INT TERM
restart_app

echo "Backup complete: ${backup_dir}"
echo "Keep docker/.env.production or at least MASTER_KEY with this backup."
