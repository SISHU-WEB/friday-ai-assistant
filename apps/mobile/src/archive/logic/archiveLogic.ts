import type { ArchiveFolder, ArchiveItem } from '../data/folders'

export function createArchiveItem(title: string): ArchiveItem {
  return {
    id: `item-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    title: title.trim(),
    createdAt: new Date().toISOString(),
  }
}

export function addItemToFolder(folders: ArchiveFolder[], folderId: string, item: ArchiveItem): ArchiveFolder[] {
  return folders.map((folder) =>
    folder.id === folderId ? { ...folder, items: [item, ...folder.items] } : folder,
  )
}

export function folderItemCount(folder: ArchiveFolder): number {
  return folder.seedCount + folder.items.length
}

export function describeRelative(date: Date): string {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'Updated just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Updated ${days} day${days === 1 ? '' : 's'} ago`
  return 'Updated earlier'
}

export function folderUpdatedLabel(folder: ArchiveFolder): string {
  if (folder.items.length === 0) return folder.seedUpdatedLabel
  const latest = new Date(Math.max(...folder.items.map((item) => new Date(item.createdAt).getTime())))
  return describeRelative(latest)
}
