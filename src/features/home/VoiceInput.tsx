import { useEffect, useState } from 'react'
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition'
import { useI18n } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/i18n'
import type { Task } from '../../types/task'
import styles from './VoiceInput.module.css'

interface VoiceInputProps {
  selectedDate: string
  purpose?: 'task' | 'interruption'
  onSubmit?: (task: Task) => void
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

export function VoiceInput({ selectedDate, purpose = 'task', onSubmit, onInterruptionComplete, onCancel }: VoiceInputProps) {
  const { t, language } = useI18n()
  const { transcript, listening, supported, error, start, stop } = useVoiceRecognition()
  const [manualText, setManualText] = useState('')

  const lang = language === 'zh' ? 'zh-CN' : 'en-US'

  useEffect(() => {
    if (supported) start(lang)
    return () => stop()
  }, [start, stop, supported, lang])

  // Close on Escape so keyboard users are not trapped in the dialog (U-5).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const displayText = transcript || manualText

  const confirm = () => {
    const text = displayText.trim()
    if (!text) return
    if (purpose === 'interruption') {
      onInterruptionComplete?.(text)
      return
    }
    onSubmit?.({
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
  }

  return (
    <div className={styles.voiceOverlay} role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <div className={styles.voiceCard}>
        {supported ? (
          <>
            <div className={`${styles.mic} ${listening ? styles.listening : ''}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v1a7 7 0 01-14 0v-1H3v1a9 9 0 008 8.94V23h2v-3.06A9 9 0 0021 11v-1h-2z" />
              </svg>
            </div>
            {listening ? (
              <div className={styles.waveform} aria-hidden="true">
                {[0,1,2,3,4,5,6].map(i => (
                  <span key={i} style={{ animationDelay: (i * 120) + 'ms' }} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <h2 id="voice-title">{listening ? t('listening') : displayText ? t('voiceReady') : t('voiceInput')}</h2>
        <p className={styles.hint}>
          {purpose === 'task' ? t('voiceTaskHint') : t('voiceInterruptHint')}
        </p>
        {transcript ? (
          <p className={styles.transcript} aria-live="polite">{transcript}</p>
        ) : null}
        <textarea
          className={styles.manualInput}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder={purpose === 'task' ? t('voiceTaskPlaceholder') : t('voiceInterruptPlaceholder')}
          rows={2}
        />
        {error ? <p className={styles.error} role="alert">{t(errorKeys[error] ?? 'voiceErrUnknown')}</p> : null}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>{t('cancel')}</button>
          {supported && !listening ? (
            <button className={styles.retryBtn} type="button" onClick={() => start(lang)}>{t('retry')}</button>
          ) : null}
          {listening ? (
            <button className={styles.retryBtn} type="button" onClick={stop}>{t('stop')}</button>
          ) : null}
          <button className={styles.confirmBtn} type="button" disabled={!displayText.trim()} onClick={confirm}>
            {purpose === 'task' ? t('addTask') : t('pauseReplan')}
          </button>
        </div>
      </div>
    </div>
  )
}
