import type { ArchiveFolder } from '../../types/archive'
import type { Language } from '../../lib/i18n'

/**
 * Folder descriptions from the original archive composition. The archive folder
 * model has no description field, so the copy is resolved by name at render time
 * and anything user-created falls back to the same sentence the original used for
 * newly created folders.
 */
const FOLDER_DESCRIPTIONS: Record<Language, Record<string, string>> = {
  en: {
    Travel: 'Trip plans, booking confirmations and travel itineraries.',
    Learning: 'Courses, notes, bookmarks and learning progress.',
    Projects: 'Active projects, milestones and deliverables.',
    Compliance: 'Regulatory documents, audit reports and compliance records for easy reference.',
    Media: 'Photos, videos, screenshots and creative assets.',
    Ideas: 'Brainstorm, ideas, references and inspiration.',
    Notes: 'Quick notes, memos and short thoughts.',
  },
  zh: {
    Travel: '旅行计划、预订确认单与行程安排。',
    Learning: '课程、笔记、书签与学习进度。',
    Projects: '进行中的项目、里程碑与交付物。',
    Compliance: '合规文件、审计报告与监管记录，便于随时查阅。',
    Media: '照片、视频、截图与创意素材。',
    Ideas: '头脑风暴、灵感、参考与启发。',
    Notes: '快速备忘、便签与简短想法。',
  },
}

const DEFAULT_DESCRIPTION: Record<Language, string> = {
  en: 'A new folder for your documents.',
  zh: '用于存放文档的新文件夹。',
}

export function folderDescription(folder: ArchiveFolder, lang: Language = 'en'): string {
  return FOLDER_DESCRIPTIONS[lang][folder.name] ?? DEFAULT_DESCRIPTION[lang]
}

/** Newest activity anywhere in the folder, as epoch ms (0 when nothing is dated). */
function folderActivityTime(folder: ArchiveFolder): number {
  let newest = 0
  const consider = (value: string | undefined) => {
    if (!value) return
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed) && parsed > newest) newest = parsed
  }
  consider(folder.updatedAt)
  consider(folder.createdAt)
  for (const item of folder.items) {
    consider(item.updatedAt)
    consider(item.createdAt)
  }
  return newest
}

export function relativeTime(iso: string, now: number = Date.now(), lang: Language = 'en'): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return lang === 'zh' ? '刚刚' : 'just now'

  const minutes = Math.max(0, now - parsed) / 60000
  if (lang === 'zh') {
    if (minutes < 2) return '刚刚'
    if (minutes < 60) return `${Math.floor(minutes)} 分钟前`
    const hours = minutes / 60
    if (hours < 2) return '1 小时前'
    if (hours < 24) return `${Math.floor(hours)} 小时前`
    const days = hours / 24
    if (days < 2) return '昨天'
    if (days < 7) return `${Math.floor(days)} 天前`
    const weeks = days / 7
    if (weeks < 2) return '1 周前'
    if (weeks < 4) return `${Math.floor(weeks)} 周前`
    const months = days / 30
    if (months < 2) return '上个月'
    if (months < 12) return `${Math.floor(months)} 个月前`
    return '很久以前'
  }

  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${Math.floor(minutes)} minutes ago`

  const hours = minutes / 60
  if (hours < 2) return '1 hour ago'
  if (hours < 24) return `${Math.floor(hours)} hours ago`

  const days = hours / 24
  if (days < 2) return 'yesterday'
  if (days < 7) return `${Math.floor(days)} days ago`

  const weeks = days / 7
  if (weeks < 2) return '1 week ago'
  if (weeks < 4) return `${Math.floor(weeks)} weeks ago`

  const months = days / 30
  if (months < 2) return 'last month'
  if (months < 12) return `${Math.floor(months)} months ago`
  return 'a long time ago'
}

export function folderUpdatedLabel(folder: ArchiveFolder, lang: Language = 'en'): string {
  const stamp = folderActivityTime(folder)
  if (!stamp) return lang === 'zh' ? '刚刚创建' : 'Created just now'
  const label = relativeTime(new Date(stamp).toISOString(), Date.now(), lang)
  return lang === 'zh' ? `更新于${label}` : `Updated ${label}`
}

/** Total items in the folder, falling back to the documents actually loaded. */
export function folderItemCount(folder: ArchiveFolder): number {
  return folder.itemCount ?? folder.items.length
}

export function itemCountLabel(count: number, lang: Language = 'en'): string {
  return lang === 'zh' ? `${count} 项` : `${count} item${count === 1 ? '' : 's'}`
}

/**
 * Time shown under a document. The newest document carries the folder's own
 * "Updated …" wording, older ones are just the timestamp.
 */
export function documentTimeLabel(createdAt: string, updatedAt: string | undefined, isNewest: boolean, lang: Language = 'en'): string {
  const label = relativeTime(updatedAt || createdAt, Date.now(), lang)
  if (!isNewest) return label
  return lang === 'zh' ? `更新于${label}` : `Updated ${label}`
}

/** Ids must stay stable across renders and survive a rename-free round trip. */
export function uniqueFolderId(name: string, existing: ArchiveFolder[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'folder'
  const taken = new Set(existing.map((folder) => folder.id))
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
