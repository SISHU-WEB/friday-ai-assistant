import { useState, type FormEvent } from 'react'
import penIcon from '../../assets/pen.svg'
import aiIcon from '../../assets/focus-indicator.svg'
import type { Task, TaskType } from '../../types/task'
import { aiScheduleTasks, isAIConfigured } from '../../lib/ai'
import { subscriptionManager } from '../../lib/stripe'
import { useI18n } from '../../lib/i18n'
import styles from './AddTaskForm.module.css'

interface AddTaskFormProps {
  onSubmit: (task: Task) => void
  onSubmitBatch?: (tasks: Task[]) => void
  selectedDate: string
  existingTasks?: Task[]
  onDirtyChange: (dirty: boolean) => void
}

const taskTypes: Array<{ value: TaskType; label: string }> = [
  { value: 'longTerm', label: 'Long-term' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'flexible', label: 'Flexible' },
]

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
        setAiSuggestion(result.summary || (language === 'zh' ? 'AI 已为您智能规划' : 'AI schedule ready'))
        if (result.tasks.length === 1) {
          const t = result.tasks[0]
          setStartTime(t.startTime)
          setEndTime(t.endTime)
          setCategory(t.category || 'Other')
          setPriority(t.priority || 'medium')
          setType(t.isFlexible ? 'flexible' : 'scheduled')
        } else if (onSubmitBatch) {
          const now = new Date().toISOString()
          const batch: Task[] = result.tasks.map((t, i) => ({
            id: `ai-${Date.now()}-${i}`,
            title: t.title,
            date: selectedDate,
            startTime: t.startTime,
            endTime: t.endTime,
            status: 'scheduled',
            type: t.isFlexible ? 'flexible' : 'scheduled',
            createdAt: now,
            description: t.description || t.title,
            category: t.category || 'Other',
            priority: t.priority,
            tags: t.tags,
            isFlexible: t.isFlexible,
            time: `${t.startTime} – ${t.endTime}`,
          }))
          setAiLoading(false)
          onSubmitBatch(batch)
          return
        }
      } else {
        setAiSuggestion(language === 'zh' ? 'AI 未能解析，请手动设置时间' : 'AI could not parse; set time manually')
      }
    } catch {
      setAiSuggestion(language === 'zh' ? 'AI 暂时不可用，请手动安排' : 'AI unavailable; schedule manually')
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
    <form className={styles.form} onSubmit={submit} aria-label="Add a task">
      <fieldset>
        <legend>{language === 'zh' ? '任务类型' : 'Task type'}</legend>
        <div className={styles.segmented}>
          {taskTypes.map((option) => (
            <button
              key={option.value}
              className={type === option.value ? styles.selected : ''}
              type="button"
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.fieldLabel} htmlFor="task-description">
        {language === 'zh' ? '任务描述' : 'Task description'}
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
          placeholder={language === 'zh' ? '写周报、健身、和朋友吃晚饭...' : 'Write report, gym, dinner with Alex...'}
          autoComplete="off"
        />
        {canUseAI ? (
          <button
            type="button"
            className={`${styles.aiButton} ${aiLoading ? styles.aiLoading : ''}`}
            onClick={() => runAISchedule()}
            title={language === 'zh' ? '用 AI 智能解析' : 'AI smart parse'}
            aria-label="AI parse"
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
          <span>{language === 'zh' ? '自动使用 AI 解析时间与分类' : 'Auto parse time & category with AI'}</span>
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
          {language === 'zh' ? 'AI 正在规划中...' : 'AI is planning...'}
        </p>
      ) : null}

      <fieldset>
        <legend>{language === 'zh' ? '分类' : 'Category'}</legend>
        <div className={styles.segmented}>
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? styles.selected : ''}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{language === 'zh' ? '优先级' : 'Priority'}</legend>
        <div className={styles.segmented}>
          {(['high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              className={`${priority === p ? styles.selected : ''} ${styles[p] ?? ''}`}
              type="button"
              onClick={() => setPriority(p)}
              aria-pressed={priority === p}
            >
              {p === 'high' ? (language === 'zh' ? '高' : 'High') : p === 'medium' ? (language === 'zh' ? '中' : 'Med') : (language === 'zh' ? '低' : 'Low')}
            </button>
          ))}
        </div>
      </fieldset>

      {type === 'scheduled' ? (
        <fieldset className={styles.timeSection}>
          <legend>{language === 'zh' ? '时间' : 'Time'}</legend>
          <div className={styles.methodSelector}>
            <button
              className={timeMethod === 'type' ? styles.selected : ''}
              type="button"
              aria-pressed={timeMethod === 'type'}
              onClick={() => setTimeMethod('type')}
            >
              {language === 'zh' ? '输入' : 'Type'}
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
              {language === 'zh' ? '开始' : 'Start'}
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
            <span>→</span>
            <label>
              {language === 'zh' ? '结束' : 'End'}
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
          {type === 'flexible'
            ? (language === 'zh' ? '弹性时间，无固定时段' : 'No fixed time — flexible')
            : (language === 'zh' ? '长期计划，按节奏推进' : 'Keep moving at your own pace')}
        </p>
      )}

      <button className={styles.confirm} type="submit" disabled={!description.trim() || aiLoading}>
        {aiLoading ? (language === 'zh' ? '规划中...' : 'Planning...') : (language === 'zh' ? '添加任务' : t('addTask'))}
      </button>
    </form>
  )
}
