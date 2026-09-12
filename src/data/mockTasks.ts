import type { Task } from '../types/task'

export const mockTasks: Task[] = [
  { id: 'ai-study', title: 'AI Study', date: '2026-05-26', startTime: '06:00', endTime: '06:45', status: 'running', createdAt: '2026-05-20T09:00:00.000Z', time: '6:00 – 6:45', description: 'Draft homepage wireframe', category: 'High Focus', type: 'scheduled' },
  { id: 'photo-edit', title: 'Photo Edit', date: '2026-05-26', startTime: '07:00', endTime: '07:45', status: 'scheduled', createdAt: '2026-05-20T09:05:00.000Z', time: '7:00 – 7:45', description: 'Refine spring campaign selects', category: 'Creative', type: 'scheduled' },
  { id: 'reading', title: 'Reading', date: '2026-05-26', startTime: '08:00', endTime: '08:45', status: 'scheduled', createdAt: '2026-05-20T09:10:00.000Z', time: '8:00 – 8:45', description: 'Read two chapters', category: 'Learning', type: 'scheduled' },
  { id: 'workout', title: 'Workout', date: '2026-05-26', startTime: '09:00', endTime: '09:45', status: 'scheduled', createdAt: '2026-05-20T09:15:00.000Z', time: '9:00 – 9:45', description: 'Mobility and strength circuit', category: 'Health', type: 'scheduled' },
]
