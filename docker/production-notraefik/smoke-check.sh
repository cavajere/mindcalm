#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

API_PORT="${API_PORT:-3003}"
FRONTEND_RENDER_MODE="${FRONTEND_RENDER_MODE:-ssr}"
BASE_URL="http://127.0.0.1:${API_PORT}"

check() {
  local url="$1"
  local expected="$2"
  local label="$3"

  local status
  status="$(curl --silent --show-error --connect-timeout 2 --max-time 8 --output /dev/null --write-out '%{http_code}' "${url}" || true)"

  if [[ "${status}" == "${expected}" ]]; then
    printf '[smoke] OK    %-30s -> %s\n' "${label}" "${status}"
    return 0
  fi

  printf '[smoke] FAIL  %-30s -> expected %s got %s (%s)\n' "${label}" "${expected}" "${status:-000}" "${url}" >&2
  return 1
}

printf '[smoke] Base URL: %s\n' "${BASE_URL}"
printf '[smoke] Frontend mode: %s\n' "${FRONTEND_RENDER_MODE}"

check "${BASE_URL}/api/health" "200" "api health"
check "${BASE_URL}/admin/login" "200" "admin login"

if [[ "${FRONTEND_RENDER_MODE}" == "ssr" ]]; then
  check "${BASE_URL}/" "200" "frontend root (ssr)"
  check "${BASE_URL}/robots.txt" "200" "robots"
  check "${BASE_URL}/sitemap.xml" "200" "sitemap"
else
  check "${BASE_URL}/" "200" "frontend root (spa)"
fi

printf '[smoke] Done.\n'
