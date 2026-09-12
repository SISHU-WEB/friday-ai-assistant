import penIcon from '../../assets/pen.svg'
import type { HomeMode } from '../../app/appReducer'
import { useLongPress } from '../../hooks/useLongPress'
import { VoiceInputPanel } from './VoiceInputPanel'
import styles from './BottomControls.module.css'

interface BottomControlsProps {
  mode: HomeMode
  onAddTask: () => void
  onAddTaskLongPress: () => void
  onPause: () => void
  onPauseLongPress: () => void
}

export function BottomControls({ mode, onAddTask, onAddTaskLongPress, onPause, onPauseLongPress }: BottomControlsProps) {
  const addTaskPress = useLongPress({ onPress: onAddTask, onLongPress: onAddTaskLongPress })
  const pausePress = useLongPress({ onPress: onPause, onLongPress: onPauseLongPress })

  if (mode === 'addTaskText' || mode === 'taskDetail' || mode === 'taskEditing' || mode === 'dailySchedule') return null

  if (mode === 'pauseVoiceInput') {
    return <div className={styles.dock}><VoiceInputPanel variant="full" /></div>
  }

  if (mode === 'replanning') {
    return (
      <div className={styles.dock}>
        <div className={styles.replanning} role="status"><i /><span>Replanning your day…</span></div>
      </div>
    )
  }

  const paused = mode === 'paused'

  return (
    <div className={styles.dock}>
      {mode === 'addTaskVoice' ? (
        <VoiceInputPanel variant="compact" />
      ) : (
        <button className={`${styles.addTask} ${addTaskPress.isHolding ? styles.holding : ''}`} type="button" aria-label="Add Task. Hold for voice input" {...addTaskPress.bind}>
          <img src={penIcon} alt="" aria-hidden="true" />
          <span>Add Task</span>
        </button>
      )}
      <div className={styles.pauseGroup}>
        {paused ? <span className={styles.pausedLabel}>Paused</span> : null}
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
