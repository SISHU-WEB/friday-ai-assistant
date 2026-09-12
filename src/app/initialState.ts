import type { AppState } from './appReducer'
import { mockTasks } from '../data/mockTasks'
import { archiveFolders } from '../data/mockArchive'
import { archiveRepository, taskRepository } from '../data/repositories'
import type { ArchiveFolder, ArchiveItem } from '../types/archive'

function normalizeArchiveFolders(folders: ArchiveFolder[]): ArchiveFolder[] {
  return folders.map((folder, folderIndex) => {
    const legacy = folder as ArchiveFolder & { title?: string }
    const createdAt = folder.createdAt ?? new Date(Date.now() + folderIndex).toISOString()
    return {
      id: folder.id,
      name: folder.name ?? legacy.title ?? 'Untitled Folder',
      category: folder.category,
      createdAt,
      items: (folder.items ?? []).map((archiveItem, itemIndex) => {
        const oldItem = archiveItem as ArchiveItem & { meta?: string }
        return {
          id: archiveItem.id ?? `${folder.id}-item-${itemIndex}`,
          title: archiveItem.title,
          note: archiveItem.note ?? oldItem.meta ?? '',
          createdAt: archiveItem.createdAt ?? createdAt,
        }
      }),
    }
  })
}

export function createInitialState(): AppState {
  const tasks = taskRepository.load(mockTasks).map((task) => ({
    ...task,
    createdAt: task.createdAt ?? new Date().toISOString(),
  }))
  return {
    view: 'home',
    homeMode: 'running',
    activeTaskIndex: 0,
    selectedDate: tasks[0]?.date ?? '2026-05-26',
    activeArchiveFolder: 'projects',
    tasks,
    archiveFolders: normalizeArchiveFolders(archiveRepository.load(archiveFolders)),
    selectedTaskId: null,
    taskReturnMode: 'running',
  }
}
