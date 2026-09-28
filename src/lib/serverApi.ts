/**
 * Client for the self-hosted Friday server (Fastify backend in /server).
 * Handles JWT session storage, transparent access-token refresh, and the
 * ASR (Whisper transcription + DeepSeek intent parsing) endpoints.
 */

export interface ServerUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

export interface ServerTokens {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: string
}

export interface ServerSession {
  user: ServerUser
  tokens: ServerTokens
}

const SESSION_KEY = 'friday-server-session'
const URL_KEY = 'friday-server-url'

export const DEFAULT_SERVER_URL = 'http://localhost:8787'

export function getServerUrl(): string {
  return (localStorage.getItem(URL_KEY) || DEFAULT_SERVER_URL).replace(/\/+$/, '')
}

export function setServerUrl(url: string): void {
  localStorage.setItem(URL_KEY, url.trim())
}

export function getServerSession(): ServerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as ServerSession) : null
  } catch {
    return null
  }
}

export function setServerSession(session: ServerSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ServerApiError'
  }
}

async function parseError(res: Response): Promise<ServerApiError> {
  let code = 'ERROR'
  let message = `Request failed (${res.status})`
  let details: unknown
  try {
    const body = await res.json()
    if (body?.error) {
      code = body.error.code ?? code
      message = body.error.message ?? message
      details = body.error.details
    }
  } catch {
    // body wasn't JSON — keep defaults
  }
  return new ServerApiError(res.status, code, message, details)
}

async function rawFetch(path: string, init: RequestInit, accessToken?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(`${getServerUrl()}${path}`, { ...init, headers })
}

/** Fetch with Bearer auth; on 401 refreshes the access token once, then retries. */
export async function serverFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const session = getServerSession()
  if (!session) throw new ServerApiError(401, 'NOT_SIGNED_IN', 'Not signed in to the Friday server')

  let res = await rawFetch(path, init, session.tokens.accessToken)
  if (res.status === 401 && retry) {
    const refreshed = await refreshSession().catch(() => null)
    if (refreshed) {
      res = await rawFetch(path, init, refreshed.tokens.accessToken)
    }
  }
  if (!res.ok) throw await parseError(res)
  return res
}

export async function serverRegister(email: string, password: string, name?: string): Promise<ServerSession> {
  const res = await rawFetch('/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) throw await parseError(res)
  const session = (await res.json()) as ServerSession
  setServerSession(session)
  return session
}

export async function serverLogin(email: string, password: string): Promise<ServerSession> {
  const res = await rawFetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw await parseError(res)
  const session = (await res.json()) as ServerSession
  setServerSession(session)
  return session
}

export async function refreshSession(): Promise<ServerSession | null> {
  const session = getServerSession()
  if (!session) return null
  const res = await rawFetch('/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
  })
  if (!res.ok) {
    // Refresh token rejected (revoked/expired/reuse) — drop the session.
    setServerSession(null)
    return null
  }
  const next = (await res.json()) as ServerSession
  setServerSession(next)
  return next
}

export async function serverLogout(): Promise<void> {
  const session = getServerSession()
  if (session) {
    await rawFetch('/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    }).catch(() => {})
  }
  setServerSession(null)
}

/** Probe server reachability without requiring auth. */
export async function serverHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getServerUrl()}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// ASR
// ---------------------------------------------------------------------------

export interface TranscribeResult {
  text: string
  language: string
  confidence: number
  audioDurationSeconds: number
  durationMs: number
}

export async function transcribeAudio(audio: Blob, languageHint?: string): Promise<TranscribeResult> {
  const form = new FormData()
  const ext = audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'm4a' : 'webm'
  form.append('file', audio, `recording.${ext}`)
  const qs = languageHint ? `?language=${encodeURIComponent(languageHint)}` : ''
  const res = await serverFetch(`/v1/asr/transcribe${qs}`, { method: 'POST', body: form })
  return (await res.json()) as TranscribeResult
}

export type VoiceIntent =
  | { type: 'create_task'; params: { title: string; date?: string; startTime?: string; endTime?: string; category?: string; priority?: 'high' | 'medium' | 'low'; notes?: string } }
  | { type: 'update_task'; params: { taskTitle: string; changes: { title?: string; startTime?: string; endTime?: string; date?: string; priority?: 'high' | 'medium' | 'low'; status?: 'scheduled' | 'active' | 'completed' | 'paused' } } }
  | { type: 'delete_task'; params: { taskTitle: string } }
  | { type: 'create_event'; params: { title: string; startAt: string; endAt: string; location?: string; description?: string; allDay?: boolean; provider?: string } }
  | { type: 'query_schedule'; params: { date?: string } }
  | { type: 'unknown'; params: { reason?: string } }

export interface CommandResult {
  intent: VoiceIntent
  durationMs: number
}

export async function parseVoiceCommand(
  text: string,
  opts: { timezone?: string; now?: string; existingTasks?: string[] } = {},
): Promise<CommandResult> {
  const res = await serverFetch('/v1/asr/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      timezone: opts.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      now: opts.now ?? new Date().toISOString(),
      context: opts.existingTasks?.length ? { existingTasks: opts.existingTasks } : undefined,
    }),
  })
  return (await res.json()) as CommandResult
}
