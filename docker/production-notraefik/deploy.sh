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

KEEP_DATA=false
AUTO_YES=false

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--keep-data] [--yes] [--help]

Options:
  --keep-data   Preserva database e storage, esegue un aggiornamento conservativo
  --yes         Salta la conferma interattiva
  --help        Mostra questo messaggio

Behavior:
  Default senza --keep-data:
    - aggiorna il repository con git pull --ff-only origin main
    - ferma e rimuove lo stack Docker
    - rimuove anche volumi Docker e directory dati bind-mounted
    - ricrea tutto da zero e rilancia il deploy

  Con --keep-data:
    - aggiorna il repository con git pull --ff-only origin main
    - preserva database e storage
    - ricostruisce e riavvia lo stack
EOF
}

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] Errore: %s\n' "$*" >&2
  exit 1
}

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

print_mode_summary() {
  log "Repository: ${REPO_ROOT}"
  log "Compose dir: ${COMPOSE_DIR}"
  log "File env: ${ENV_FILE}"

  if [[ "${KEEP_DATA}" == "true" ]]; then
    log "Modalita': aggiornamento conservativo con preservazione dati"
  else
    log "Modalita': reinstallazione completa con distruzione dati e volumi"
  fi
}

update_repository() {
  log "Aggiornamento repository da origin/main"
  git -C "${REPO_ROOT}" pull --ff-only origin main
}

create_data_directories() {
  log "Creazione directory dati"
  mkdir -p "${POSTGRES_DATA_DIR}" "${AUDIOS_DATA_DIR}" "${HLS_DATA_DIR}" "${IMAGES_DATA_DIR}"
}

destroy_stack_and_data() {
  log "Arresto e rimozione stack Docker"
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" down --volumes --remove-orphans --rmi local

  log "Rimozione directory dati bind-mounted"
  rm -rf "${DATA_DIR}"

  create_data_directories
}

deploy_stack() {
  log "Build immagini aggiornate"
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" build --pull

  log "Avvio stack"
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" up -d
}

show_post_deploy_status() {
  log "Stato container"
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" ps

  log "Health check locale"
  curl --fail --silent --show-error "http://localhost:3003/api/health" || die "Health check locale fallito"

  log "Deploy completato"
}

main() {
  parse_args "$@"
  check_prerequisites
  ensure_env_file
  print_mode_summary

  if [[ "${KEEP_DATA}" == "true" ]]; then
    confirm "Procedere con il deploy preservando i dati?"
  else
    confirm "Procedere con il deploy completo distruggendo database, storage e volumi?"
  fi

  update_repository

  if [[ "${KEEP_DATA}" == "true" ]]; then
    create_data_directories
  else
    destroy_stack_and_data
  fi

  deploy_stack
  show_post_deploy_status
}

main "$@"
