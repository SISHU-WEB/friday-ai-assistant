export interface ArchiveItem {
  id: string
  title: string
  note: string
  createdAt: string
}

export interface ArchiveFolder {
  id: string
  name: string
  category: string
  createdAt: string
  items: ArchiveItem[]
}

export type ArchiveCategory = ArchiveFolder
