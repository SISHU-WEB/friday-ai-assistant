export type ArchiveCategoryType = 'Projects' | 'Learning' | 'Travel' | 'Health' | 'Ideas' | 'Media' | 'Life' | 'Other' | string

export interface ArchiveItem {
  id: string
  title: string
  note: string
  createdAt: string
  updatedAt?: string
  userId?: string
  isLongTerm?: boolean
  tags?: string[]
  folderId?: string
}

export interface ArchiveFolder {
  id: string
  name: string
  category: ArchiveCategoryType
  createdAt: string
  updatedAt?: string
  userId?: string
  items: ArchiveItem[]
  /**
   * How many items the folder holds. `items` is the newest slice that the folder
   * list previews, so this can be larger; it falls back to the loaded count.
   */
  itemCount?: number
  color?: string
  icon?: string
}

export type ArchiveCategory = ArchiveFolder

export interface NewArchiveItemData {
  title: string
  note?: string
  folderId?: string
  category?: ArchiveCategoryType
  isLongTerm?: boolean
}

export interface NewArchiveFolderData {
  name: string
  category: ArchiveCategoryType
  color?: string
  icon?: string
}
