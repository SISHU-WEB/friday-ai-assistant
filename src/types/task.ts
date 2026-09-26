export type TaskType = 'longTerm' | 'scheduled' | 'flexible'
export type TaskStatus = 'active' | 'scheduled' | 'running' | 'paused' | 'completed' | 'archived' | 'interrupted'
export type TaskCategory = 'Work' | 'Study' | 'Life' | 'Health' | 'Social' | 'Entertainment' | 'Other' | 'Voice' | 'Long-term' | 'Scheduled' | 'Flexible'

export interface Task {
  id: string
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  status: TaskStatus
  type: TaskType
  createdAt: string
  updatedAt?: string
  time?: string
  description: string
  category: string
  priority?: 'high' | 'medium' | 'low'
  tags?: string[]
  isFlexible?: boolean
  userId?: string
  interruptionReason?: string
  interruptedAt?: string
  estimatedReturnMinutes?: number
  originalStartTime?: string | null
  originalEndTime?: string | null
}
