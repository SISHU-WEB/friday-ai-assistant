import penIcon from '../../assets/pen.svg'
import type { HomeMode } from '../../app/appReducer'
import { useLongPress } from '../../hooks/useLongPress'
import { useI18n } from '../../lib/i18n'
import styles from './BottomControls.module.css'

interface BottomControlsProps {
  mode: HomeMode
  onAddTask: () => void
  onAddTaskLongPress: () => void
  onPause: () => void
  onPauseLongPress: () => void
}

export function BottomControls({ mode, onAddTask, onAddTaskLongPress, onPause, onPauseLongPress }: BottomControlsProps) {
  const { t, language } = useI18n()
  const addTaskPress = useLongPress({ onPress: onAddTask, onLongPress: onAddTaskLongPress })
  const pausePress = useLongPress({ onPress: onPause, onLongPress: onPauseLongPress })

  if (mode === 'addTaskText' || mode === 'addTaskVoice' || mode === 'pauseVoiceInput' || mode === 'taskDetail' || mode === 'taskEditing' || mode === 'dailySchedule') return null

  if (mode === 'replanning') {
    return (
      <div className={styles.dock}>
        <div className={styles.replanning} role="status"><i /><span>{t('replanning')}</span></div>
      </div>
    )
  }

  const paused = mode === 'paused'
  const holdHint = language === 'zh' ? '长按 ＋ 语音创建 · 长按 ⏸ 记录打断' : 'Hold + for voice · Hold ⏸ to log an interruption'

  return (
    <div className={styles.dock}>
      <p className={styles.hint} aria-hidden="true">{holdHint}</p>
      <button className={`${styles.addTask} ${addTaskPress.isHolding ? styles.holding : ''}`} type="button" aria-label={paused ? t('addTask') : `${t('addTask')} — ${holdHint}`} {...addTaskPress.bind}>
        <img src={penIcon} alt="" aria-hidden="true" />
        <span>{t('addTask')}</span>
      </button>
      <div className={styles.pauseGroup}>
        {paused ? <span className={styles.pausedLabel}>{t('paused')}</span> : null}
        <button
          className={`${styles.pause} ${paused ? styles.resume : ''} ${pausePress.isHolding ? styles.holding : ''}`}
          type="button"
          aria-label={paused ? "Resume — I'm back" : 'Pause current task. Hold to describe an interruption'}
          {...pausePress.bind}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
