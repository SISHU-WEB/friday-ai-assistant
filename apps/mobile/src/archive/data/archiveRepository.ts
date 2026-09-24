import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ArchiveFolder, ArchiveItem } from './folders'
import { seedArchiveFolders } from './folders'

const STORAGE_KEY = 'friday.archive.v1'

const isItem = (value: unknown): value is ArchiveItem => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string'
  )
}

const isStoredFolder = (value: unknown): value is { id: string; items: ArchiveItem[] } => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'string' && Array.isArray(candidate.items) && candidate.items.every(isItem)
}

export async function loadArchiveFolders(): Promise<ArchiveFolder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return seedArchiveFolders
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isStoredFolder)) return seedArchiveFolders

    // Re-seed descriptions/counts so the folder set can evolve without wiping saved items.
    return seedArchiveFolders.map((seed) => {
      const stored = parsed.find((entry) => entry.id === seed.id)
      return stored ? { ...seed, items: stored.items } : seed
    })
  } catch {
    return seedArchiveFolders
  }
}

export async function saveArchiveFolders(folders: ArchiveFolder[]): Promise<void> {
  try {
    const payload = folders.map(({ id, items }) => ({ id, items }))
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage unavailable: the app keeps working in memory.
  }
}
