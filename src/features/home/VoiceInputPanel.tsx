import micIcon from '../../assets/mic.svg'
import styles from './VoiceInputPanel.module.css'

interface VoiceInputPanelProps {
  variant: 'compact' | 'full'
}

const barHeights = [10, 20, 30, 17, 35, 24, 12, 28, 18, 25, 13, 31, 20, 9, 26, 16, 33, 22, 12, 28]
// varied durations -> organic, live-audio feel instead of a uniform metronome
const barDurations = [620, 480, 710, 540, 660, 430, 760, 590, 510, 690, 470, 640, 560, 720, 520, 610, 450, 680, 530, 590]

export function VoiceInputPanel({ variant }: VoiceInputPanelProps) {
  const full = variant === 'full'
  const count = full ? 20 : 10

  return (
    <section className={`${styles.panel} ${full ? styles.full : styles.compact}`} aria-label={full ? 'Interruption voice input' : 'Add task voice input'}>
      <div className={styles.label}>
        <img src={micIcon} alt="" aria-hidden="true" />
        <strong>Listening…</strong>
        {full ? <span>Describe interruption</span> : <span>Add a new task</span>}
      </div>
      <div className={styles.waveform} aria-hidden="true">
        {barHeights.slice(0, count).map((height, index) => (
          <i
            key={index}
            style={{
              height,
              animationDelay: `${index * -70}ms`,
              animationDuration: `${barDurations[index % barDurations.length]}ms`,
            }}
          />
        ))}
      </div>
      {full ? <p className={styles.mockText}>“I need to go downstairs for about 40 minutes.”</p> : null}
    </section>
  )
}
