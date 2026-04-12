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

compose() {
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" "$@"
}

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--keep-data] [--reset-data] [--yes] [--help]

Options:
  --keep-data   Preserva database e storage, esegue un aggiornamento conservativo (default)
  --reset-data  Reinstallazione completa: distrugge database, storage e volumi Docker
  --yes         Salta la conferma interattiva
  --help        Mostra questo messaggio

Behavior:
  Default:
    - aggiorna il repository con git pull --ff-only origin main
    - preserva database e storage
    - ricostruisce e riavvia lo stack

  Con --reset-data:
    - aggiorna il repository con git pull --ff-only origin main
    - ferma e rimuove lo stack Docker
    - rimuove anche volumi Docker e directory dati bind-mounted
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
  log "Ultimi log di api e postgres"
  compose logs --tail=120 api postgres || true
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
  log "Repository: ${REPO_ROOT}"
  log "Compose dir: ${COMPOSE_DIR}"
  log "File env: ${ENV_FILE}"
  log "Commit locale: $(git -C "${REPO_ROOT}" rev-parse --short HEAD) $(git -C "${REPO_ROOT}" log -1 --pretty=%s)"

  if [[ "${KEEP_DATA}" == "true" ]]; then
    log "Modalita': aggiornamento conservativo con preservazione dati"
  else
    log "Modalita': reinstallazione completa con distruzione dati e volumi"
  fi
}

update_repository() {
  log "Aggiornamento repository da origin/main"
  git -C "${REPO_ROOT}" pull --ff-only origin main
  log "Commit attivo: $(git -C "${REPO_ROOT}" rev-parse --short HEAD) $(git -C "${REPO_ROOT}" log -1 --pretty=%s)"
}

create_data_directories() {
  log "Creazione directory dati"
  mkdir -p "${POSTGRES_DATA_DIR}" "${AUDIOS_DATA_DIR}" "${HLS_DATA_DIR}" "${IMAGES_DATA_DIR}"
}

destroy_stack_and_data() {
  log "Arresto e rimozione stack Docker"
  compose down --volumes --remove-orphans --rmi local

  log "Rimozione directory dati bind-mounted"
  rm -rf "${DATA_DIR}"

  create_data_directories
}

deploy_stack() {
  log "Build immagini aggiornate"
  compose build --pull

  log "Avvio stack"
  compose up -d --remove-orphans
}

wait_for_http_status() {
  local url="$1"
  local description="$2"
  shift 2
  local expected_codes=("$@")
  local attempt status

  for attempt in $(seq 1 30); do
    status="$(curl --silent --output /dev/null --write-out '%{http_code}' "${url}" || true)"

    for expected in "${expected_codes[@]}"; do
      if [[ "${status}" == "${expected}" ]]; then
        log "${description} OK (${status})"
        return 0
      fi
    done

    sleep 2
  done

  die "${description} non raggiungibile su ${url} (ultimo status: ${status:-000})"
}

show_post_deploy_status() {
  show_runtime_status
  wait_for_http_status "http://127.0.0.1:${API_PORT}/api/health" "Health check API" 200
  wait_for_http_status "http://127.0.0.1:${API_PORT}/" "Frontend root" 200
  wait_for_http_status "http://127.0.0.1:${API_PORT}/admin/" "Admin root" 200

  log "Deploy completato"
}

main() {
  parse_args "$@"
  check_prerequisites
  ensure_env_file
  load_env_file
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

  deploy_stack
  show_post_deploy_status
}

main "$@"
