#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_DIR="${SCRIPT_DIR}"
ENV_FILE="${COMPOSE_DIR}/.env"
ENV_EXAMPLE_FILE="${COMPOSE_DIR}/.env.example"
DATA_DIR="${COMPOSE_DIR}/data"
POSTGRES_DATA_DIR="${COMPOSE_DIR}/data/postgres"
AUDIOS_DATA_DIR="${COMPOSE_DIR}/data/audio"
HLS_DATA_DIR="${COMPOSE_DIR}/data/hls"
IMAGES_DATA_DIR="${COMPOSE_DIR}/data/images"

KEEP_DATA=true
RESET_DATA=false
AUTO_YES=false
API_PORT=3003
DEPLOY_BRANCH=""
HEALTHCHECK_ATTEMPTS=90
POSTGRES_UID=70
POSTGRES_GID=70
APP_UID=1001
APP_GID=1001

compose() {
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" "$@"
}

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--keep-data] [--reset-data] [--yes] [--branch <name>] [--help]

Options:
  --keep-data   Preserva database e storage, esegue un aggiornamento conservativo (default)
  --reset-data  Reinstallazione completa: distrugge database, storage e volumi Docker
  --yes         Salta la conferma interattiva
  --branch      Branch git da deployare (default: DEPLOY_BRANCH da .env oppure branch locale corrente)
  --help        Mostra questo messaggio

Behavior:
  Default:
    - aggiorna il repository con git pull --ff-only origin <branch-target>
    - preserva database e storage
    - ricostruisce e riavvia lo stack

  Con --reset-data:
    - aggiorna il repository con git pull --ff-only origin <branch-target>
    - ferma e rimuove lo stack Docker (incluse immagini locali)
    - rimuove volumi Docker e directory dati bind-mounted (data/postgres, data/audio, ...)
    - fa backup del .env attuale e lo sovrascrive con .env.example
    - ricrea tutto da zero e rilancia il deploy
EOF
}

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] Errore: %s\n' "$*" >&2
  exit 1
}

show_recent_logs() {
  log "Ultimi log di api, frontend-ssr e postgres"
  compose logs --tail=120 api frontend-ssr postgres || true
}

show_runtime_status() {
  log "Stato container"
  compose ps || true
}

on_error() {
  local exit_code=$?
  local line_no="${1:-unknown}"
  log "Deploy fallito (exit ${exit_code}, linea ${line_no})"
  show_runtime_status
  show_recent_logs
  exit "${exit_code}"
}

trap 'on_error $LINENO' ERR

confirm() {
  local prompt="$1"

  if [[ "${AUTO_YES}" == "true" ]]; then
    log "Conferma automatica abilitata con --yes"
    return 0
  fi

  read -r -p "${prompt} [y/N] " answer
  case "${answer}" in
    y|Y|yes|YES) return 0 ;;
    *) die "Operazione annullata" ;;
  esac
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Comando richiesto non trovato: $1"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keep-data)
        KEEP_DATA=true
        RESET_DATA=false
        ;;
      --reset-data)
        RESET_DATA=true
        KEEP_DATA=false
        ;;
      --yes)
        AUTO_YES=true
        ;;
      --branch)
        shift
        [[ $# -gt 0 ]] || die "Valore mancante per --branch"
        DEPLOY_BRANCH="$1"
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        usage
        die "Opzione non riconosciuta: $1"
        ;;
    esac
    shift
  done
}

check_prerequisites() {
  require_command git
  require_command docker
  require_command curl

  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 non disponibile"
  [[ -f "${COMPOSE_DIR}/docker-compose.yml" ]] || die "docker-compose.yml non trovato in ${COMPOSE_DIR}"
  [[ -d "${REPO_ROOT}/.git" ]] || die "Repository git non trovato in ${REPO_ROOT}"
}

ensure_env_file() {
  if [[ -f "${ENV_FILE}" ]]; then
    return 0
  fi

  [[ -f "${ENV_EXAMPLE_FILE}" ]] || die "File ${ENV_EXAMPLE_FILE} non trovato"
  cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
  log "Creato ${ENV_FILE} a partire da .env.example"
  log "Verifica i valori sensibili prima di usare lo script in produzione reale"
}

load_env_file() {
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
  API_PORT="${API_PORT:-3003}"
  HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-90}"

  if [[ -z "${DEPLOY_BRANCH}" ]]; then
    DEPLOY_BRANCH="${DEPLOY_BRANCH:-${CURRENT_BRANCH:-}}"
  fi

  if [[ -z "${DEPLOY_BRANCH}" ]]; then
    DEPLOY_BRANCH="$(git -C "${REPO_ROOT}" branch --show-current)"
  fi
}


validate_frontend_mode_config() {
  case "${FRONTEND_RENDER_MODE:-ssr}" in
    ssr|spa) ;;
    *) die "FRONTEND_RENDER_MODE non valido: ${FRONTEND_RENDER_MODE}. Valori ammessi: ssr | spa" ;;
  esac

  if [[ "${FRONTEND_RENDER_MODE:-ssr}" == "ssr" ]]; then
    [[ -n "${PUBLIC_SITE_URL:-}" ]] || die "PUBLIC_SITE_URL e' obbligatorio quando FRONTEND_RENDER_MODE=ssr"
  fi
}

check_git_worktree() {
  local tracked_changes
  tracked_changes="$(git -C "${REPO_ROOT}" status --porcelain --untracked-files=no)"

  if [[ -n "${tracked_changes}" ]]; then
    printf '%s\n' "${tracked_changes}" >&2
    die "Repository con modifiche locali tracciate: pulisci o committa prima del deploy"
  fi
}

print_mode_summary() {
  local current_branch
  current_branch="$(git -C "${REPO_ROOT}" branch --show-current)"

  log "Repository: ${REPO_ROOT}"
  log "Compose dir: ${COMPOSE_DIR}"
  log "File env: ${ENV_FILE}"
  log "Branch locale corrente: ${current_branch:-detached}"
  log "Branch target deploy: ${DEPLOY_BRANCH}"
  log "Commit locale: $(git -C "${REPO_ROOT}" rev-parse --short HEAD) $(git -C "${REPO_ROOT}" log -1 --pretty=%s)"
  log "Frontend mode: ${FRONTEND_RENDER_MODE:-ssr}"
  if [[ "${FRONTEND_RENDER_MODE:-ssr}" == "ssr" ]]; then
    log "Public site URL: ${PUBLIC_SITE_URL}"
  fi

  if [[ "${KEEP_DATA}" == "true" ]]; then
    log "Modalita': aggiornamento conservativo con preservazione dati"
  else
    log "Modalita': reinstallazione completa con distruzione dati e volumi"
  fi
}

ensure_deploy_branch() {
  [[ -n "${DEPLOY_BRANCH}" ]] || die "Branch di deploy non determinabile. Imposta DEPLOY_BRANCH nel .env o usa --branch <nome>."

  git -C "${REPO_ROOT}" fetch --prune origin

  if ! git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/remotes/origin/${DEPLOY_BRANCH}"; then
    die "Il branch remoto origin/${DEPLOY_BRANCH} non esiste"
  fi

  local current_branch
  current_branch="$(git -C "${REPO_ROOT}" branch --show-current)"

  if [[ "${current_branch}" == "${DEPLOY_BRANCH}" ]]; then
    return 0
  fi

  log "Switch branch locale: ${current_branch:-detached} -> ${DEPLOY_BRANCH}"

  if git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${DEPLOY_BRANCH}"; then
    git -C "${REPO_ROOT}" checkout "${DEPLOY_BRANCH}"
  else
    git -C "${REPO_ROOT}" checkout -b "${DEPLOY_BRANCH}" --track "origin/${DEPLOY_BRANCH}"
  fi
}

update_repository() {
  ensure_deploy_branch
  log "Aggiornamento repository da origin/${DEPLOY_BRANCH}"
  git -C "${REPO_ROOT}" pull --ff-only origin "${DEPLOY_BRANCH}"
  log "Commit attivo: $(git -C "${REPO_ROOT}" rev-parse --short HEAD) $(git -C "${REPO_ROOT}" log -1 --pretty=%s)"
}

create_data_directories() {
  log "Creazione directory dati"
  mkdir -p "${POSTGRES_DATA_DIR}" "${AUDIOS_DATA_DIR}" "${HLS_DATA_DIR}" "${IMAGES_DATA_DIR}"
}

apply_permissions() {
  log "Imposto permessi script e .env"
  chmod +x "${COMPOSE_DIR}/deploy.sh" 2>/dev/null || true
  [[ -f "${COMPOSE_DIR}/seed.sh" ]] && chmod +x "${COMPOSE_DIR}/seed.sh" 2>/dev/null || true
  [[ -f "${ENV_FILE}" ]] && chmod 600 "${ENV_FILE}" 2>/dev/null || true

  log "Imposto ownership directory dati (postgres ${POSTGRES_UID}:${POSTGRES_GID}, appuser ${APP_UID}:${APP_GID})"
  docker run --rm -v "${DATA_DIR}:/data" alpine sh -c "
    chown -R ${POSTGRES_UID}:${POSTGRES_GID} /data/postgres 2>/dev/null || true
    chmod 700 /data/postgres 2>/dev/null || true
    chown -R ${APP_UID}:${APP_GID} /data/audio /data/hls /data/images 2>/dev/null || true
    chmod 755 /data/audio /data/hls /data/images 2>/dev/null || true
  " >/dev/null
}

destroy_stack_and_data() {
  log "Arresto e rimozione stack Docker"
  compose down --volumes --remove-orphans --rmi local

  if [[ -d "${DATA_DIR}" ]]; then
    log "Rimozione directory dati bind-mounted (via container privilegiato)"
    docker run --rm -v "${DATA_DIR}:/target" alpine sh -c 'rm -rf /target/* /target/.[!.]* /target/..?* 2>/dev/null || true'
    rmdir "${DATA_DIR}" 2>/dev/null || rm -rf "${DATA_DIR}" 2>/dev/null || true
  fi

  reset_env_file

  create_data_directories
}

reset_env_file() {
  [[ -f "${ENV_EXAMPLE_FILE}" ]] || die "File ${ENV_EXAMPLE_FILE} non trovato"

  if [[ -f "${ENV_FILE}" ]]; then
    local backup
    backup="${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
    cp "${ENV_FILE}" "${backup}"
    log "Backup .env precedente in ${backup}"
  fi

  cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
  log "Ricreato ${ENV_FILE} da .env.example"

  # Ricarica le variabili perche il nuovo .env puo differire dal precedente
  load_env_file
}

deploy_stack() {
  log "Build immagini aggiornate"
  compose build --pull

  log "Avvio stack"
  compose up -d --remove-orphans
}


show_frontend_ssr_diagnostics() {
  local frontend_container_id
  frontend_container_id="$(compose ps -q frontend-ssr 2>/dev/null || true)"

  log "Diagnostica frontend-ssr"
  compose ps frontend-ssr || true

  if [[ -z "${frontend_container_id}" ]]; then
    log "Container frontend-ssr non trovato"
    return 0
  fi

  log "Health status Docker (frontend-ssr)"
  docker inspect --format '{{json .State.Health}}' "${frontend_container_id}" || true

  log "Verifica HTTP interna frontend-ssr"
  docker exec "${frontend_container_id}" sh -lc 'node -e "require(\"http\").get(\"http://127.0.0.1:3000/healthz\", (r) => { console.log(r.statusCode); process.exit(r.statusCode === 200 ? 0 : 1) }).on(\"error\", (err) => { console.error(err.message); process.exit(1) })"' || true

  log "Ultimi log frontend-ssr"
  compose logs --tail=150 frontend-ssr || true
}

verify_ssr_upstream_from_api() {
  local api_container_id
  api_container_id="$(compose ps -q api 2>/dev/null || true)"

  if [[ -z "${api_container_id}" ]]; then
    log "Container API non trovato per verifica upstream SSR"
    return 1
  fi

  log "Verifica reachability SSR upstream da API container"
  docker exec "${api_container_id}" sh -lc 'node -e "require(\"http\").get(\"http://frontend-ssr:3000/healthz\", (r) => { console.log(r.statusCode); process.exit(r.statusCode === 200 ? 0 : 1) }).on(\"error\", (err) => { console.error(err.message); process.exit(1) })"'
}

show_api_diagnostics() {
  local api_container_id
  api_container_id="$(compose ps -q api 2>/dev/null || true)"

  log "Diagnostica API"
  compose ps api || true

  if [[ -z "${api_container_id}" ]]; then
    log "Container API non trovato"
    return 0
  fi

  log "Health status Docker"
  docker inspect --format '{{json .State.Health}}' "${api_container_id}" || true

  log "Verifica HTTP interna al container"
  docker exec "${api_container_id}" sh -lc \
    "node -e \"require('http').get('http://127.0.0.1:3000/api/health', (r) => { console.log(r.statusCode); process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', (err) => { console.error(err.message); process.exit(1) })\"" || true

  log "Ultimi log API"
  compose logs --tail=150 api || true
}

wait_for_http_status() {
  local url="$1"
  local description="$2"
  shift 2
  local expected_codes=("$@")
  local attempt status

  for attempt in $(seq 1 "${HEALTHCHECK_ATTEMPTS}"); do
    status="$(curl --silent --show-error --connect-timeout 2 --max-time 5 --output /dev/null --write-out '%{http_code}' "${url}" || true)"

    for expected in "${expected_codes[@]}"; do
      if [[ "${status}" == "${expected}" ]]; then
        log "${description} OK (${status})"
        return 0
      fi
    done

    if (( attempt == 1 || attempt % 10 == 0 )); then
      log "${description} in attesa su ${url} (tentativo ${attempt}/${HEALTHCHECK_ATTEMPTS}, ultimo status: ${status:-000})"
    fi

    sleep 2
  done

  if [[ "${description}" == "Health check API" ]]; then
    show_api_diagnostics
  fi

  if [[ "${description}" == "Health check frontend-ssr" ]]; then
    show_frontend_ssr_diagnostics
  fi

  die "${description} non raggiungibile su ${url} (ultimo status: ${status:-000})"
}

show_post_deploy_status() {
  show_runtime_status
  wait_for_http_status "http://127.0.0.1:${API_PORT}/api/health" "Health check API" 200

  if [[ "${FRONTEND_RENDER_MODE:-ssr}" == "ssr" ]]; then
    wait_for_http_status "http://127.0.0.1:${API_PORT}/" "Frontend root (SSR proxy)" 200
    wait_for_http_status "http://127.0.0.1:${API_PORT}/robots.txt" "Robots SSR" 200
    wait_for_http_status "http://127.0.0.1:${API_PORT}/sitemap.xml" "Sitemap SSR" 200
    verify_ssr_upstream_from_api || show_frontend_ssr_diagnostics
  else
    wait_for_http_status "http://127.0.0.1:${API_PORT}/" "Frontend root (SPA fallback)" 200
  fi

  wait_for_http_status "http://127.0.0.1:${API_PORT}/admin/" "Admin root" 200 302
  wait_for_http_status "http://127.0.0.1:${API_PORT}/admin/login" "Admin login" 200

  if [[ -x "${COMPOSE_DIR}/smoke-check.sh" ]]; then
    log "Eseguo smoke-check post deploy"
    "${COMPOSE_DIR}/smoke-check.sh"
  fi

  log "Deploy completato"
}

main() {
  parse_args "$@"
  check_prerequisites
  ensure_env_file
  load_env_file
  validate_frontend_mode_config
  check_git_worktree
  print_mode_summary

  if [[ "${RESET_DATA}" == "true" ]]; then
    confirm "Procedere con il deploy completo distruggendo database, storage e volumi?"
  else
    confirm "Procedere con il deploy preservando i dati?"
  fi

  update_repository

  if [[ "${RESET_DATA}" == "true" ]]; then
    destroy_stack_and_data
  else
    create_data_directories
  fi

  apply_permissions

  deploy_stack
  show_post_deploy_status
}

main "$@"
