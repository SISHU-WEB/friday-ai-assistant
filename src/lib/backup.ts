import type { Task } from '../types/task'
import type { ArchiveFolder, ArchiveItem } from '../types/archive'

export interface BackupData {
  tasks: Task[]
  deletedTasks: Task[]
  archiveFolders: ArchiveFolder[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

function isValidTask(value: unknown): value is Task {
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

function isValidArchiveItem(value: unknown): value is ArchiveItem {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.title === 'string'
}

function isValidArchiveFolder(value: unknown): value is ArchiveFolder {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (typeof value.name === 'string' || typeof value.title === 'string') &&
    Array.isArray(value.items) &&
    (value.items as unknown[]).every(isValidArchiveItem)
  )
}

/**
 * Parse and validate a backup file. Bad entries are dropped instead of
 * rejecting the whole file; returns null when nothing usable remains (F-9/S-4).
 */
export function parseBackup(text: string): BackupData | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (parsed.version !== 1) return null

  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.filter(isValidTask) : []
  const deletedTasks = Array.isArray(parsed.deletedTasks) ? parsed.deletedTasks.filter(isValidTask) : []
  const archiveFolders = Array.isArray(parsed.archiveFolders)
    ? parsed.archiveFolders.filter(isValidArchiveFolder)
    : []

  if (tasks.length === 0 && deletedTasks.length === 0 && archiveFolders.length === 0) return null

  const ids = new Set(tasks.map((t) => t.id))
  return {
    tasks,
    deletedTasks: deletedTasks.filter((t) => !ids.has(t.id)),
    archiveFolders,
  }
}
