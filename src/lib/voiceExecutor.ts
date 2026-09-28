import type { Task, TaskStatus, TaskCategory } from '../types/task'
import type { VoiceIntent } from './serverApi'

export interface ExecuteResult {
  action: 'created' | 'updated' | 'deleted' | 'queried' | 'none'
  task?: Task
  message?: string
}

export interface ExecuteContext {
  tasks: Task[]
  selectedDate: string
  onAddTask: (task: Task) => void
  onUpdateTask: (task: Task) => void
  onDeleteTask: (id: string) => void
  showToast: (msg: string) => void
}

const PRIORITY_MAP: Record<string, Task['priority']> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
}

const CATEGORY_MAP: Record<string, TaskCategory> = {
  Work: 'Work',
  Study: 'Study',
  Life: 'Life',
  Health: 'Health',
  Social: 'Social',
  Entertainment: 'Entertainment',
  Other: 'Other',
}

function findTaskByTitle(tasks: Task[], title: string): Task | undefined {
  const lower = title.toLowerCase()
  return tasks.find((t) => t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase()))
}

function taskToDateTime(task: Task): string {
  const d = task.date
  const t = task.startTime ?? '00:00'
  return `${d}T${t}:00`
}

export function executeVoiceIntent(intent: VoiceIntent, ctx: ExecuteContext): ExecuteResult {
  const { tasks, selectedDate, onAddTask, onUpdateTask, onDeleteTask } = ctx

  switch (intent.type) {
    case 'create_task': {
      const p = intent.params
      const task: Task = {
        id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: p.title,
        date: p.date ?? selectedDate,
        startTime: p.startTime ?? null,
        endTime: p.endTime ?? null,
        status: 'scheduled',
        type: 'flexible',
        createdAt: new Date().toISOString(),
        description: p.notes ?? '',
        category: CATEGORY_MAP[p.category ?? 'Other'] ?? 'Other',
        priority: PRIORITY_MAP[p.priority ?? 'medium'] ?? 'medium',
      }
      onAddTask(task)
      return { action: 'created', task }
    }

    case 'update_task': {
      const p = intent.params
      const target = findTaskByTitle(tasks, p.taskTitle)
      if (!target) return { action: 'none', message: `找不到任务"${p.taskTitle}"` }
      const updated: Task = {
        ...target,
        title: p.changes.title ?? target.title,
        date: p.changes.date ?? target.date,
        startTime: p.changes.startTime ?? target.startTime,
        endTime: p.changes.endTime ?? target.endTime,
        priority: p.changes.priority ? PRIORITY_MAP[p.changes.priority] : target.priority,
        status: (p.changes.status as TaskStatus) ?? target.status,
      }
      onUpdateTask(updated)
      return { action: 'updated', task: updated }
    }

    case 'delete_task': {
      const p = intent.params
      const target = findTaskByTitle(tasks, p.taskTitle)
      if (!target) return { action: 'none', message: `找不到任务"${p.taskTitle}"` }
      onDeleteTask(target.id)
      return { action: 'deleted', task: target }
    }

    case 'create_event': {
      const p = intent.params
      // Map to a task-like calendar event
      const startDate = p.startAt.slice(0, 10)
      const startTime = p.startAt.length >= 16 ? p.startAt.slice(11, 16) : null
      const endTime = p.endAt.length >= 16 ? p.endAt.slice(11, 16) : null
      const task: Task = {
        id: `voice-event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: p.title,
        date: startDate,
        startTime,
        endTime,
        status: 'scheduled',
        type: 'scheduled',
        createdAt: new Date().toISOString(),
        description: p.description ?? p.location ?? '',
        category: 'Other',
        priority: 'medium',
      }
      onAddTask(task)
      return { action: 'created', task }
    }

    case 'query_schedule': {
      const p = intent.params
      const date = p.date ?? selectedDate
      const dayTasks = tasks.filter((t) => t.date === date)
      if (dayTasks.length === 0) {
        return { action: 'queried', message: `${date} 没有任务安排。` }
      }
      const lines = dayTasks
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
        .map((t) => `${t.startTime ?? '--:--'} ${t.title}${t.status === 'completed' ? ' (已完成)' : ''}`)
      return { action: 'queried', message: `${date} 的任务：\n${lines.join('\n')}` }
    }

    case 'unknown':
    default:
      return { action: 'none', message: intent.params?.reason ?? '无法理解指令' }
  }
}
