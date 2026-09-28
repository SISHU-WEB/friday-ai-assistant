import { useEffect, useRef, useState } from 'react'
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition'
import { useServerVoiceRecognition } from '../../hooks/useServerVoiceRecognition'
import { useI18n } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/i18n'
import type { Task } from '../../types/task'
import { getServerSession, parseVoiceCommand, ServerApiError, type VoiceIntent } from '../../lib/serverApi'
import { executeVoiceIntent } from '../../lib/voiceExecutor'
import styles from './VoiceInput.module.css'

interface VoiceInputProps {
  selectedDate: string
  purpose?: 'task' | 'interruption'
  tasks?: Task[]
  onSubmit?: (task: Task) => void
  onUpdateTask?: (task: Task) => void
  onDeleteTask?: (id: string) => void
  onInterruptionComplete?: (transcript: string) => void
  onCancel: () => void
}

const errorKeys: Record<string, TranslationKey> = {
  'not-allowed': 'voiceErrNotAllowed',
  'no-speech': 'voiceErrNoSpeech',
  'audio-capture': 'voiceErrAudioCapture',
  network: 'voiceErrNetwork',
  unsupported: 'voiceErrUnsupported',
  unknown: 'voiceErrUnknown',
}

type Mode = 'server' | 'local'

function intentSummary(intent: VoiceIntent, t: (k: TranslationKey, v?: Record<string, string | number>) => string): string {
  switch (intent.type) {
    case 'create_task':
      return `＋ ${intent.params.title}${intent.params.startTime ? ` · ${intent.params.startTime}` : ''}`
    case 'update_task':
      return `✎ ${intent.params.taskTitle}`
    case 'delete_task':
      return `🗑 ${intent.params.taskTitle}`
    case 'create_event':
      return `📅 ${intent.params.title}`
    case 'query_schedule':
      return `? ${intent.params.date ?? ''}`
    default:
      return t('voiceServerUnknown')
  }
}

export function VoiceInput({ selectedDate, purpose = 'task', tasks = [], onSubmit, onUpdateTask, onDeleteTask, onInterruptionComplete, onCancel }: VoiceInputProps) {
  const { t, language } = useI18n()
  const local = useVoiceRecognition()
  const server = useServerVoiceRecognition()
  const [manualText, setManualText] = useState('')
  const [mode, setMode] = useState<Mode>(() => (getServerSession() ? 'server' : 'local'))
  const [pendingIntent, setPendingIntent] = useState<VoiceIntent | null>(null)
  const [intentSource, setIntentSource] = useState('')
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsingText, setParsingText] = useState(false)
  const serverErrHandled = useRef(false)

  const lang = language === 'zh' ? 'zh-CN' : 'en-US'
  const serverAvailable = !!getServerSession()

  // Kick off recognition for the active mode.
  useEffect(() => {
    serverErrHandled.current = false
    setPendingIntent(null)
    setResultMessage(null)
    setParseError(null)
    if (mode === 'server' && serverAvailable) {
      void server.start({
        languageHint: language === 'zh' ? 'zh' : 'en',
        existingTasks: tasks.filter((x) => x.date === selectedDate).map((x) => x.title),
      })
    } else if (mode === 'local' && local.supported) {
      local.start(lang)
    }
    return () => {
      server.reset()
      local.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // If the server reports ASR/NLU not configured, fall back to local once.
  useEffect(() => {
    if (mode === 'server' && server.phase === 'error' && server.error === 'SERVER_NOT_CONFIGURED' && !serverErrHandled.current) {
      serverErrHandled.current = true
      setMode('local')
    }
  }, [mode, server.phase, server.error])

  // When server parsing finishes, surface the intent for confirmation.
  useEffect(() => {
    if (mode === 'server' && server.phase === 'done' && server.intent) {
      if (server.intent.type === 'query_schedule') {
        // Read-only intents run immediately and show the result inline.
        const res = executeVoiceIntent(server.intent, execCtx())
        setResultMessage(res.message ?? null)
      } else {
        setPendingIntent(server.intent)
        setIntentSource(server.transcript)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.phase, server.intent])

  // Close on Escape so keyboard users are not trapped in the dialog (U-5).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const execCtx = () => ({
    tasks,
    selectedDate,
    onAddTask: (task: Task) => onSubmit?.(task),
    onUpdateTask: (task: Task) => onUpdateTask?.(task),
    onDeleteTask: (id: string) => onDeleteTask?.(id),
    showToast: () => {},
  })

  const displayText =
    mode === 'server' ? server.transcript || manualText : local.transcript || manualText

  const listening = mode === 'server' ? server.phase === 'recording' : local.listening
  const busy =
    parsingText || server.phase === 'uploading' || server.phase === 'transcribing' || server.phase === 'parsing'

  const parseManualText = async (text: string): Promise<VoiceIntent | null> => {
    setParsingText(true)
    setParseError(null)
    try {
      const { intent } = await parseVoiceCommand(text, {
        existingTasks: tasks.filter((x) => x.date === selectedDate).map((x) => x.title),
      })
      return intent
    } catch (e) {
      const err = e as ServerApiError
      if (err.code === 'NLU_NOT_CONFIGURED' || err.code === 'NOT_SIGNED_IN') {
        setMode('local')
        return null
      }
      setParseError(err.message || t('voiceServerError'))
      return null
    } finally {
      setParsingText(false)
    }
  }

  const confirm = async () => {
    const text = displayText.trim()
    if (purpose === 'interruption') {
      if (text) onInterruptionComplete?.(text)
      return
    }

    // Server mode, intent already parsed from recorded audio → execute it.
    if (pendingIntent) {
      const res = executeVoiceIntent(pendingIntent, execCtx())
      if (res.action === 'none') {
        setResultMessage(res.message ?? t('voiceServerUnknown'))
        setPendingIntent(null)
        return
      }
      onCancel()
      return
    }

    if (!text) return

    // Server mode with typed text → parse then ask for confirmation.
    if (mode === 'server' && serverAvailable) {
      const intent = await parseManualText(text)
      if (!intent) return
      if (intent.type === 'query_schedule') {
        const res = executeVoiceIntent(intent, execCtx())
        setResultMessage(res.message ?? null)
      } else if (intent.type === 'unknown') {
        // Fall back to the plain-task behaviour so typing always works.
        onSubmit?.(plainTask(text))
      } else {
        setPendingIntent(intent)
        setIntentSource(text)
      }
      return
    }

    // Local mode → plain task (unchanged legacy behaviour).
    onSubmit?.(plainTask(text))
  }

  const plainTask = (text: string): Task => ({
    id: `voice-${Date.now()}`,
    title: text.slice(0, 48),
    date: selectedDate,
    startTime: null,
    endTime: null,
    status: 'scheduled',
    type: 'flexible',
    createdAt: new Date().toISOString(),
    description: text,
    category: 'Voice',
  })

  const phaseLabelKey: Record<string, TranslationKey> = {
    uploading: 'voiceServerUploading',
    transcribing: 'voiceServerTranscribing',
    parsing: 'voiceServerParsing',
    done: 'voiceServerDone',
  }

  const title = listening
    ? t(mode === 'server' ? 'voiceServerListening' : 'listening')
    : busy
    ? t(phaseLabelKey[server.phase] ?? 'voiceServerParsing')
    : pendingIntent
    ? intentSummary(pendingIntent, t)
    : displayText
    ? t('voiceReady')
    : t('voiceInput')

  const serverErrorText =
    mode === 'server' && server.phase === 'error' && server.error && server.error !== 'SERVER_NOT_CONFIGURED'
      ? server.error
      : null

  return (
    <div className={styles.voiceOverlay} role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <div className={styles.voiceCard}>
        <div className={`${styles.mic} ${listening ? styles.listening : ''}`}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v1a7 7 0 01-14 0v-1H3v1a9 9 0 008 8.94V23h2v-3.06A9 9 0 0021 11v-1h-2z" />
          </svg>
        </div>
        {listening ? (
          <div className={styles.waveform} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} style={{ animationDelay: i * 120 + 'ms' }} />
            ))}
          </div>
        ) : null}
        {serverAvailable && purpose === 'task' ? (
          <div className={styles.modeSwitch} role="group" aria-label={t('voiceServerMode')}>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'server' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('server')}
            >
              {t('voiceServerMode')}
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'local' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('local')}
            >
              {t('voiceLocalMode')}
            </button>
          </div>
        ) : null}
        <h2 id="voice-title">{title}</h2>
        <p className={styles.hint}>{purpose === 'task' ? t('voiceTaskHint') : t('voiceInterruptHint')}</p>
        {resultMessage ? (
          <p className={styles.transcript} aria-live="polite" style={{ whiteSpace: 'pre-line' }}>
            {resultMessage}
          </p>
        ) : pendingIntent ? (
          <p className={styles.transcript} aria-live="polite">
            {intentSource}
          </p>
        ) : (mode === 'server' ? server.transcript : local.transcript) ? (
          <p className={styles.transcript} aria-live="polite">
            {mode === 'server' ? server.transcript : local.transcript}
          </p>
        ) : null}
        <textarea
          className={styles.manualInput}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder={purpose === 'task' ? t('voiceTaskPlaceholder') : t('voiceInterruptPlaceholder')}
          rows={2}
        />
        {mode === 'local' && local.error ? (
          <p className={styles.error} role="alert">
            {t(errorKeys[local.error] ?? 'voiceErrUnknown')}
          </p>
        ) : null}
        {serverErrorText ? (
          <p className={styles.error} role="alert">
            {serverErrorText}
          </p>
        ) : null}
        {parseError ? (
          <p className={styles.error} role="alert">
            {parseError}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>
            {t('cancel')}
          </button>
          {listening ? (
            <button
              className={styles.retryBtn}
              type="button"
              onClick={() => (mode === 'server' ? server.stop() : local.stop())}
            >
              {t('stop')}
            </button>
          ) : !busy && !pendingIntent ? (
            <button
              className={styles.retryBtn}
              type="button"
              onClick={() => {
                setPendingIntent(null)
                setResultMessage(null)
                setParseError(null)
                if (mode === 'server') {
                  void server.start({
                    languageHint: language === 'zh' ? 'zh' : 'en',
                    existingTasks: tasks.filter((x) => x.date === selectedDate).map((x) => x.title),
                  })
                } else {
                  local.start(lang)
                }
              }}
            >
              {t('retry')}
            </button>
          ) : null}
          <button
            className={styles.confirmBtn}
            type="button"
            disabled={busy || (!pendingIntent && !displayText.trim())}
            onClick={confirm}
          >
            {purpose === 'task' ? (pendingIntent ? t('voiceExecute') : t('addTask')) : t('pauseReplan')}
          </button>
        </div>
      </div>
    </div>
  )
}
