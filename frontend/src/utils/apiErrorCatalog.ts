export const API_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email o password non corretti. Controlla i dati e riprova.',
  LICENSE_EXPIRED: 'La tua licenza è scaduta. Rinnovala per tornare ad accedere.',
  TOKEN_MISSING: 'Sessione non attiva. Effettua di nuovo l\'accesso.',
  TOKEN_INVALID: 'Sessione scaduta. Effettua di nuovo l\'accesso.',
  RATE_LIMITED: 'Troppe richieste in poco tempo. Attendi qualche istante e riprova.',
  LOGIN_RATE_LIMITED: 'Troppi tentativi di accesso. Attendi un minuto prima di riprovare.',
  REGISTRATION_RATE_LIMITED: 'Hai fatto troppe richieste di registrazione. Riprova tra qualche minuto.',
  REGISTRATION_VERIFY_RATE_LIMITED: 'Troppi tentativi di conferma. Riprova tra qualche minuto.',
  INVITE_CODE_RATE_LIMITED: 'Troppi tentativi di verifica del codice invito. Riprova tra qualche minuto.',
  EVENT_BOOKING_ACCESS_RATE_LIMITED: 'Troppi tentativi di accesso alla prenotazione. Riprova tra qualche minuto.',
  EVENT_BOOKING_REQUEST_RATE_LIMITED: 'Troppi tentativi di invio richiesta. Riprova tra qualche minuto.',
  EVENT_BOOKING_CREATE_RATE_LIMITED: 'Troppi tentativi di prenotazione. Riprova tra qualche minuto.',
  PLAYBACK_RATE_LIMITED: 'Troppe richieste di riproduzione. Attendi un momento e riprova.',
  TERMS_ACCEPTANCE_REQUIRED: 'Devi accettare i termini e le condizioni per continuare.',
  TERMS_VERSION_OUTDATED: 'I termini e le condizioni sono stati aggiornati. Aprili di nuovo e conferma l\'accettazione.',
  CONSENT_PAYLOAD_INCOMPLETE: 'Completa la scelta dei consensi per continuare.',
  REQUIRED_CONSENT_REJECTED: 'È necessario accettare i consensi obbligatori per continuare.',
}

export const API_STATUS_FALLBACKS: Record<number, string> = {
  400: 'Dati non validi. Controlla i campi e riprova.',
  401: 'Sessione scaduta. Effettua di nuovo l\'accesso.',
  403: 'Non hai i permessi per eseguire questa operazione.',
  404: 'Contenuto non trovato.',
  408: 'La richiesta è scaduta. Riprova.',
  409: 'Operazione non possibile nello stato attuale. Aggiorna la pagina e riprova.',
  413: 'Il file è troppo grande.',
  415: 'Formato non supportato.',
  422: 'Dati non validi. Controlla i campi evidenziati.',
  429: 'Troppe richieste. Attendi qualche istante e riprova.',
  500: 'Si è verificato un errore sul server. Riprova più tardi.',
  502: 'Il server non risponde. Riprova più tardi.',
  503: 'Servizio temporaneamente non disponibile. Riprova più tardi.',
  504: 'Il server ha impiegato troppo tempo a rispondere. Riprova.',
}

export const API_NETWORK_ERROR_MESSAGE = 'Problema di connessione. Controlla la tua rete e riprova.'

export const API_GENERIC_ERROR_MESSAGE = 'Si è verificato un errore imprevisto. Riprova.'
