import type { AppState } from './appReducer'
import { mockTasks } from '../data/mockTasks'
import { archiveFolders } from '../data/mockArchive'
import { archiveRepository, taskRepository } from '../data/repositories'
import { readLegacyArchive } from '../data/legacyArchiveMigration'
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
      // Carry the optional fields through instead of dropping them on every load.
      updatedAt: folder.updatedAt,
      userId: folder.userId,
      itemCount: folder.itemCount,
      color: folder.color,
      icon: folder.icon,
      items: (folder.items ?? []).map((archiveItem, itemIndex) => {
        const oldItem = archiveItem as ArchiveItem & { meta?: string }
        return {
          id: archiveItem.id ?? `${folder.id}-item-${itemIndex}`,
          title: archiveItem.title,
          note: archiveItem.note ?? oldItem.meta ?? '',
          createdAt: archiveItem.createdAt ?? createdAt,
          updatedAt: archiveItem.updatedAt,
          userId: archiveItem.userId,
          isLongTerm: archiveItem.isLongTerm,
          tags: archiveItem.tags,
          folderId: archiveItem.folderId,
        }
      }),
    }
  })
}

/** The five-folder demo set the archive shipped with before it was ported. */
const PREVIOUS_SEED: Array<{ id: string; name: string }> = [
  { id: 'projects', name: 'Projects' },
  { id: 'travel', name: 'Travel' },
  { id: 'ideas', name: 'Ideas' },
  { id: 'learning', name: 'Learning' },
  { id: 'media', name: 'Media' },
]

/**
 * True while the store holds nothing but the starting content. Ids, names and
 * document titles decide it - timestamps are not user edits, and `itemCount` is
 * derived data that older stores did not carry.
 */
function isUntouchedSeed(stored: ArchiveFolder[]): boolean {
  if (stored.length !== archiveFolders.length) return false
  return stored.every((folder, index) => {
    const seed = archiveFolders[index]
    if (folder.id !== seed.id || folder.name !== seed.name) return false
    if (folder.items.length !== seed.items.length) return false
    return folder.items.every((item, itemIndex) => item.title === seed.items[itemIndex].title)
  })
}

/** Full comparison, used only to avoid a redundant write on every start. */
function matchesSeedExactly(stored: ArchiveFolder[]): boolean {
  if (!isUntouchedSeed(stored)) return false
  return stored.every((folder, index) => (folder.itemCount ?? null) === (archiveFolders[index].itemCount ?? null))
}

function isPreviousSeed(stored: ArchiveFolder[]): boolean {
  if (stored.length !== PREVIOUS_SEED.length) return false
  return stored.every((folder, index) => {
    const seed = PREVIOUS_SEED[index]
    return folder.id === seed.id && folder.name === seed.name && folder.items.length <= 2
  })
}

/**
 * Which folders the archive opens on.
 *
 * Two carry-overs can apply the first time the ported screen runs:
 *   - the archive used to keep its own store inside its iframe; that content is
 *     adopted when the app has nothing of its own yet;
 *   - a store still holding demo content is rewritten with the real starting
 *     content, so the screen opens on the same picture as before.
 *
 * Anything the user has actually created, renamed or removed fails both tests and
 * is left exactly as it is.
 */
function resolveArchiveFolders(): ArchiveFolder[] {
  const stored = archiveRepository.load(archiveFolders)

  if (!isUntouchedSeed(stored) && !isPreviousSeed(stored)) return stored

  const legacy = readLegacyArchive()
  if (legacy) {
    archiveRepository.save(legacy)
    return legacy
  }

  if (!matchesSeedExactly(stored)) archiveRepository.save(archiveFolders)
  return archiveFolders
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
    lastDeletedTask: null,
    deletedTasks: [],
    tasks,
    archiveFolders: normalizeArchiveFolders(resolveArchiveFolders()),
    selectedTaskId: null,
    taskReturnMode: 'running',
  }
}
