import type { ArchiveFolder } from '../../types/archive'
import type { Task } from '../../types/task'
import { LocalStorageCollectionRepository } from './LocalStorageCollectionRepository'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

const isTask = (value: unknown): value is Task => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.date === 'string' &&
    (typeof value.startTime === 'string' || value.startTime === null) &&
    (typeof value.endTime === 'string' || value.endTime === null) &&
    typeof value.status === 'string' &&
    typeof value.type === 'string'
  )
}

const isArchiveFolder = (value: unknown): value is ArchiveFolder => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (typeof value.name === 'string' || typeof value.title === 'string') &&
    typeof value.category === 'string' &&
    Array.isArray(value.items)
  )
}

export const taskRepository = new LocalStorageCollectionRepository<Task>('friday.tasks.v1', isTask)
export const archiveRepository = new LocalStorageCollectionRepository<ArchiveFolder>('friday.archive.v1', isArchiveFolder)
