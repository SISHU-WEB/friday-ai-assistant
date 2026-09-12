export type TaskType = 'longTerm' | 'scheduled' | 'flexible'
export type TaskStatus = 'active' | 'scheduled' | 'running' | 'paused' | 'completed' | 'archived'

export interface Task {
  id: string
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  status: TaskStatus
  type: TaskType
  createdAt: string
  time?: string
  description: string
  category: string
}
