import { useEffect, useState } from 'react'
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition'
import { useI18n } from '../../lib/i18n'
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

  const errorMessages: Record<string, string> = {
    'not-allowed': '麦克风权限被拒绝，请在设置中允许访问。',
    'no-speech': '未检测到语音，请重试。',
    'audio-capture': '设备无可用麦克风。',
    network: '语音识别需要网络连接。',
    unsupported: '当前浏览器不支持语音识别，请直接输入。',
    unknown: '语音输入出现问题，请重试。',
  }

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
          {language === 'zh' ? '记录打断原因' : 'Log the interruption'}
        </h2>
        <p className={styles.hint}>
          {language === 'zh'
            ? '简单说明一下，或直接输入下方文字'
            : 'Briefly describe, or type below'}
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
          placeholder={language === 'zh' ? '例如：接了个同事电话讨论项目...' : 'e.g. Took a call from a colleague...'}
          rows={2}
        />

        <div className={styles.divider} />

        <label className={styles.label}>
          {language === 'zh' ? '预计回归时间' : 'Back in approximately'}
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
          <span>{language === 'zh' ? '自定义（分钟）' : 'Custom (min)'}</span>
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

        {error ? <p className={styles.error} role="alert">{errorMessages[error] || errorMessages.unknown}</p> : null}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>
            {t('cancel')}
          </button>
          {supported && !listening ? (
            <button className={styles.retryBtn} type="button" onClick={() => start(lang)}>
              {language === 'zh' ? '重录' : 'Retry'}
            </button>
          ) : null}
          {listening ? (
            <button className={styles.retryBtn} type="button" onClick={stop}>
              {language === 'zh' ? '停止' : 'Stop'}
            </button>
          ) : null}
          <button
            className={styles.confirmBtn}
            type="button"
            disabled={!displayReason || finalMinutes <= 0}
            onClick={confirm}
          >
            {language === 'zh' ? '确认并重排' : 'Confirm & replan'}
          </button>
        </div>
      </div>
    </div>
  )
}
