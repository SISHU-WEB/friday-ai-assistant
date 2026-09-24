import { useEffect, useState } from 'react'
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition'
import { useI18n } from '../../lib/i18n'
import type { Task } from '../../types/task'
import styles from './VoiceInput.module.css'

interface VoiceInputProps {
  selectedDate: string
  purpose?: 'task' | 'interruption'
  onSubmit?: (task: Task) => void
  onInterruptionComplete?: (transcript: string) => void
  onCancel: () => void
}

const errorMessages = {
  'not-allowed': 'Microphone access is blocked. Allow it in browser settings, then try again.',
  'no-speech': 'No speech was detected. Tap retry and speak again.',
  'audio-capture': 'No microphone is available on this device.',
  network: 'Voice recognition needs a network connection in this browser.',
  unsupported: 'Voice recognition is not supported in this browser. Type below instead.',
  unknown: 'Voice input stopped unexpectedly. Please try again.',
} as const

export function VoiceInput({ selectedDate, purpose = 'task', onSubmit, onInterruptionComplete, onCancel }: VoiceInputProps) {
  const { t, language } = useI18n()
  const { transcript, listening, supported, error, start, stop } = useVoiceRecognition()
  const [manualText, setManualText] = useState('')

  const lang = language === 'zh' ? 'zh-CN' : 'en-US'

  useEffect(() => {
    if (supported) start(lang)
    return () => stop()
  }, [start, stop, supported, lang])

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
        <h2 id="voice-title">{listening ? t('listening') : displayText ? 'Ready' : t('voiceInput')}</h2>
        <p className={styles.hint}>
          {purpose === 'task'
            ? (language === 'zh' ? '告诉 Friday 你想做什么，或直接输入' : 'Tell Friday what you want to do, or type below')
            : (language === 'zh' ? '简单描述一下，或直接输入' : 'Briefly describe, or type below')}
        </p>
        {transcript ? (
          <p className={styles.transcript} aria-live="polite">{transcript}</p>
        ) : null}
        <textarea
          className={styles.manualInput}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder={language === 'zh' ? '输入你的任务...' : 'Type your task...'}
          rows={2}
        />
        {error ? <p className={styles.error} role="alert">{errorMessages[error]}</p> : null}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>{t('cancel')}</button>
          {supported && !listening ? (
            <button className={styles.retryBtn} type="button" onClick={() => start(lang)}>{language === 'zh' ? '重试' : 'Retry'}</button>
          ) : null}
          {listening ? (
            <button className={styles.retryBtn} type="button" onClick={stop}>{language === 'zh' ? '停止' : 'Stop'}</button>
          ) : null}
          <button className={styles.confirmBtn} type="button" disabled={!displayText.trim()} onClick={confirm}>
            {purpose === 'task' ? t('addTask') : (language === 'zh' ? '暂停并重排' : 'Pause & replan')}
          </button>
        </div>
      </div>
    </div>
  )
}