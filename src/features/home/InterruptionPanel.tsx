import { useEffect, useState } from 'react'
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition'
import { useI18n } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/i18n'
import styles from './InterruptionPanel.module.css'

export interface InterruptionResult {
  reason: string
  estimatedReturnMinutes: number
}

interface InterruptionPanelProps {
  onComplete: (result: InterruptionResult) => void
  onCancel: () => void
}

const RETURN_OPTIONS = [15, 30, 45, 60, 90, 120]

const errorKeys: Record<string, TranslationKey> = {
  'not-allowed': 'voiceErrNotAllowed',
  'no-speech': 'voiceErrNoSpeech',
  'audio-capture': 'voiceErrAudioCapture',
  network: 'voiceErrNetwork',
  unsupported: 'voiceErrUnsupported',
  unknown: 'voiceErrUnknown',
}

export function InterruptionPanel({ onComplete, onCancel }: InterruptionPanelProps) {
  const { t, language } = useI18n()
  const { transcript, listening, supported, error, start, stop } = useVoiceRecognition()
  const [manualText, setManualText] = useState('')
  const [returnMinutes, setReturnMinutes] = useState(30)
  const [customMinutes, setCustomMinutes] = useState('')
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

  const displayReason = (transcript || manualText).trim()
  const finalMinutes = customMinutes ? parseInt(customMinutes, 10) : returnMinutes

  const confirm = () => {
    if (!displayReason || !finalMinutes || finalMinutes <= 0) return
    onComplete({ reason: displayReason, estimatedReturnMinutes: finalMinutes })
  }

  const errorMessage = error ? t(errorKeys[error] ?? 'voiceErrUnknown') : null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="int-title">
      <div className={styles.card}>
        {supported ? (
          <div className={`${styles.mic} ${listening ? styles.listening : ''}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v1a7 7 0 01-14 0v-1H3v1a9 9 0 008 8.94V23h2v-3.06A9 9 0 0021 11v-1h-2z" />
            </svg>
          </div>
        ) : null}
        {listening ? (
          <div className={styles.waveform} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : null}

        <h2 id="int-title" className={styles.title}>
          {t('voiceInterruptTitle')}
        </h2>
        <p className={styles.hint}>
          {t('voiceInterruptHint')}
        </p>

        {transcript ? (
          <p className={styles.transcript} aria-live="polite">
            {transcript}
          </p>
        ) : null}

        <textarea
          className={styles.manualInput}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder={t('voiceInterruptPlaceholder')}
          rows={2}
        />

        <div className={styles.divider} />

        <label className={styles.label}>
          {t('backInApprox')}
        </label>
        <div className={styles.options}>
          {RETURN_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={!customMinutes && returnMinutes === m ? styles.optionActive : styles.option}
              onClick={() => {
                setReturnMinutes(m)
                setCustomMinutes('')
              }}
              aria-pressed={!customMinutes && returnMinutes === m}
            >
              {m < 60 ? `${m}${t('minutes')}` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`}
            </button>
          ))}
        </div>
        <label className={styles.customRow}>
          <span>{t('customMinutes')}</span>
          <input
            type="number"
            min={1}
            max={480}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className={styles.customInput}
            placeholder="..."
          />
        </label>

        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>
            {t('cancel')}
          </button>
          {supported && !listening ? (
            <button className={styles.retryBtn} type="button" onClick={() => start(lang)}>
              {t('retry')}
            </button>
          ) : null}
          {listening ? (
            <button className={styles.retryBtn} type="button" onClick={stop}>
              {t('stop')}
            </button>
          ) : null}
          <button
            className={styles.confirmBtn}
            type="button"
            disabled={!displayReason || finalMinutes <= 0}
            onClick={confirm}
          >
            {t('confirmReplan')}
          </button>
        </div>
      </div>
    </div>
  )
}
