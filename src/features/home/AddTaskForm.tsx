import { useState, type FormEvent } from 'react'
import penIcon from '../../assets/pen.svg'
import aiIcon from '../../assets/focus-indicator.svg'
import type { Task, TaskType } from '../../types/task'
import { aiScheduleTasks, isAIConfigured } from '../../lib/ai'
import { subscriptionManager } from '../../lib/stripe'
import { categoryLabel, taskTypeLabel, useI18n } from '../../lib/i18n'
import styles from './AddTaskForm.module.css'

interface AddTaskFormProps {
  onSubmit: (task: Task) => void
  onSubmitBatch?: (tasks: Task[]) => void
  selectedDate: string
  existingTasks?: Task[]
  onDirtyChange: (dirty: boolean) => void
}

const taskTypes: TaskType[] = ['longTerm', 'scheduled', 'flexible']

function taskTitleFromDesc(description: string) {
  const trimmed = description.trim()
  const words = trimmed.split(/\s+/)
  return words.length <= 6 ? trimmed : `${words.slice(0, 6).join(' ')}…`
}

const categories = ['Work', 'Study', 'Life', 'Health', 'Social', 'Entertainment', 'Other']

export function AddTaskForm({ onSubmit, onSubmitBatch, selectedDate, existingTasks = [], onDirtyChange }: AddTaskFormProps) {
  const { t, language } = useI18n()
  const [type, setType] = useState<TaskType>('scheduled')
  const [description, setDescription] = useState('')
  const [timeMethod, setTimeMethod] = useState<'type' | 'ai'>('ai')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [category, setCategory] = useState('Work')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string>('')
  const [useAi, setUseAi] = useState(true)
  const canUseAI = isAIConfigured()

  const currentTimeStr = new Date().toTimeString().slice(0, 5)

  const runAISchedule = async (textOverride?: string) => {
    const text = (textOverride ?? description).trim()
    if (!text) return
    if (!canUseAI) return
    setAiLoading(true)
    setAiSuggestion('')
    try {
      const result = await aiScheduleTasks({
        rawInput: text,
        date: selectedDate,
        existingTasks,
        currentTime: currentTimeStr,
        isPremium: subscriptionManager.isPremium(),
      })
      if (result && result.tasks.length > 0) {
        setAiSuggestion(result.summary || t('aiReady'))
        if (result.tasks.length === 1) {
          const aiTask = result.tasks[0]
          setStartTime(aiTask.startTime)
          setEndTime(aiTask.endTime)
          setCategory(aiTask.category || 'Other')
          setPriority(aiTask.priority || 'medium')
          setType(aiTask.isFlexible ? 'flexible' : 'scheduled')
        } else if (onSubmitBatch) {
          const now = new Date().toISOString()
          const batch: Task[] = result.tasks.map((aiTask, i) => ({
            id: `ai-${Date.now()}-${i}`,
            title: aiTask.title,
            date: selectedDate,
            startTime: aiTask.startTime,
            endTime: aiTask.endTime,
            status: 'scheduled',
            type: aiTask.isFlexible ? 'flexible' : 'scheduled',
            createdAt: now,
            description: aiTask.description || aiTask.title,
            category: aiTask.category || 'Other',
            priority: aiTask.priority,
            tags: aiTask.tags,
            isFlexible: aiTask.isFlexible,
            time: `${aiTask.startTime} – ${aiTask.endTime}`,
          }))
          setAiLoading(false)
          onSubmitBatch(batch)
          return
        }
      } else {
        setAiSuggestion(t('aiParseFail'))
      }
    } catch {
      setAiSuggestion(t('aiUnavailable'))
    } finally {
      setAiLoading(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!description.trim()) return
    const categoryToUse = category || (type === 'longTerm' ? 'Long-term' : type === 'flexible' ? 'Flexible' : 'Scheduled')
    onSubmit({
      id: `task-${Date.now()}`,
      title: taskTitleFromDesc(description),
      date: selectedDate,
      startTime: type === 'scheduled' ? startTime : null,
      endTime: type === 'scheduled' ? endTime : null,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      description: description.trim(),
      category: categoryToUse,
      type,
      priority,
      isFlexible: type === 'flexible',
      time: type === 'scheduled' ? `${startTime} – ${endTime}` : undefined,
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-label={t('addTaskAria')}>
      <fieldset>
        <legend>{t('taskType')}</legend>
        <div className={styles.segmented}>
          {taskTypes.map((option) => (
            <button
              key={option}
              className={type === option ? styles.selected : ''}
              type="button"
              aria-pressed={type === option}
              onClick={() => setType(option)}
            >
              {taskTypeLabel(option, language)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.fieldLabel} htmlFor="task-description">
        {t('taskDescription')}
      </label>
      <div className={styles.descriptionField}>
        <img src={penIcon} alt="" aria-hidden="true" />
        <input
          id="task-description"
          autoFocus
          value={description}
          onChange={(event) => {
            const val = event.target.value
            setDescription(val)
            onDirtyChange(Boolean(val.trim()))
            setAiSuggestion('')
          }}
          onBlur={() => {
            if (useAi && description.trim() && !aiLoading) {
              runAISchedule()
            }
          }}
          placeholder={t('taskPlaceholder')}
          autoComplete="off"
        />
        {canUseAI ? (
          <button
            type="button"
            className={`${styles.aiButton} ${aiLoading ? styles.aiLoading : ''}`}
            onClick={() => runAISchedule()}
            title={t('aiSmartParse')}
            aria-label={t('aiParse')}
          >
            <img src={aiIcon} alt="" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {canUseAI && (
        <label className={styles.aiToggleRow}>
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
          />
          <span>{t('aiAutoParse')}</span>
        </label>
      )}

      {aiSuggestion ? (
        <p className={styles.aiSuggestion} aria-live="polite">
          <span className={styles.aiDot} />
          {aiSuggestion}
        </p>
      ) : null}
      {aiLoading ? (
        <p className={styles.aiLoadingText}>
          <span className={styles.aiSpinner} />
          {t('aiPlanning')}
        </p>
      ) : null}

      <fieldset>
        <legend>{t('category')}</legend>
        <div className={styles.segmented}>
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? styles.selected : ''}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {categoryLabel(c, language)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('priority')}</legend>
        <div className={styles.segmented}>
          {(['high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              className={`${priority === p ? styles.selected : ''} ${styles[p] ?? ''}`}
              type="button"
              onClick={() => setPriority(p)}
              aria-pressed={priority === p}
            >
              {t(p === 'high' ? 'high' : p === 'medium' ? 'med' : 'low')}
            </button>
          ))}
        </div>
      </fieldset>

      {type === 'scheduled' ? (
        <fieldset className={styles.timeSection}>
          <legend>{t('time')}</legend>
          <div className={styles.methodSelector}>
            <button
              className={timeMethod === 'type' ? styles.selected : ''}
              type="button"
              aria-pressed={timeMethod === 'type'}
              onClick={() => setTimeMethod('type')}
            >
              {t('typeInput')}
            </button>
            {canUseAI ? (
              <button
                className={timeMethod === 'ai' ? styles.selected : ''}
                type="button"
                aria-pressed={timeMethod === 'ai'}
                onClick={() => {
                  setTimeMethod('ai')
                  if (description.trim()) runAISchedule()
                }}
              >
                AI
              </button>
            ) : null}
          </div>
          <div className={styles.timeInputs}>
            <label>
              {t('start')}
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
            <span>→</span>
            <label>
              {t('end')}
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
      ) : (
        <p className={styles.noTime}>
          {type === 'flexible' ? t('flexibleHint') : t('longTermHint')}
        </p>
      )}

      <button className={styles.confirm} type="submit" disabled={!description.trim() || aiLoading}>
        {aiLoading ? t('planning') : t('addTask')}
      </button>
    </form>
  )
}
