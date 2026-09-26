import type { ArchiveFolder, ArchiveItem } from '../types/archive'

/**
 * The archive used to live in its own iframe (`public/archive.html`) and kept its
 * own store under `friday-archive-data`. Now that it is a React view it reads the
 * app's archive repository, so this module carries the old content across once.
 *
 * It is deliberately conservative: it only ever runs when the app's archive still
 * holds the untouched seed data (see initialState), so it can never overwrite
 * folders the user has actually worked on.
 */
const LEGACY_STORAGE_KEY = 'friday-archive-data'

interface LegacyDoc {
  t?: string
  d?: string
}

interface LegacyPayload {
  folderDocs?: LegacyDoc[][]
  folderNames?: string[]
  items?: string[]
  times?: string[]
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const RELATIVE_WORDS: Record<string, number> = {
  'just now': 0,
  yesterday: DAY,
  'last week': 7 * DAY,
  'last month': 30 * DAY,
}

const RELATIVE_PATTERNS: Array<{ pattern: RegExp; unit: number }> = [
  { pattern: /^(\d+)\s*minutes? ago$/, unit: MINUTE },
  { pattern: /^(\d+)\s*hours? ago$/, unit: HOUR },
  { pattern: /^(\d+)\s*days? ago$/, unit: DAY },
  { pattern: /^(\d+)\s*weeks? ago$/, unit: 7 * DAY },
  { pattern: /^(\d+)\s*months? ago$/, unit: 30 * DAY },
]

/** "Updated 2 days ago" -> 2 days in milliseconds. */
function parseLegacyStamp(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const normalized = value.replace(/^updated\s+/i, '').trim().toLowerCase()
  if (normalized in RELATIVE_WORDS) return RELATIVE_WORDS[normalized]
  for (const { pattern, unit } of RELATIVE_PATTERNS) {
    const match = normalized.match(pattern)
    if (match) return Number(match[1] ?? 0) * unit
  }
  return fallback
}

function slugify(name: string, index: number, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `folder-${index + 1}`
  let id = base
  let suffix = 2
  while (taken.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  taken.add(id)
  return id
}

/**
 * Returns the legacy folders converted to the app's model, or null when there is
 * nothing usable to migrate.
 */
export function readLegacyArchive(now: number = Date.now()): ArchiveFolder[] | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: LegacyPayload
  try {
    parsed = JSON.parse(raw) as LegacyPayload
  } catch {
    return null
  }

  const names = parsed.folderNames
  if (!Array.isArray(names) || names.length === 0) return null
  if (!names.every((name) => typeof name === 'string' && name.trim().length > 0)) return null

  const docs = Array.isArray(parsed.folderDocs) ? parsed.folderDocs : []
  const folderStamps = Array.isArray(parsed.times) ? parsed.times : []

  const taken = new Set<string>()
  const folders = names.map((rawName, index) => {
    const name = rawName.trim()
    const id = slugify(name, index, taken)
    const folderOffset = parseLegacyStamp(folderStamps[index], 0)

    const listed = Array.isArray(docs[index]) ? docs[index] : []
    const items: ArchiveItem[] = listed
      .filter((doc) => doc && typeof doc.t === 'string' && doc.t.trim().length > 0)
      .map((doc, itemIndex) => ({
        id: `${id}-item-${itemIndex + 1}`,
        title: doc.t!.trim(),
        note: '',
        createdAt: new Date(now - parseLegacyStamp(doc.d, folderOffset)).toISOString(),
      }))

    const newestItem = items.reduce((max, entry) => Math.max(max, Date.parse(entry.createdAt) || 0), 0)

    return {
      id,
      name,
      category: name,
      createdAt: new Date(now - folderOffset).toISOString(),
      updatedAt: new Date(Math.max(newestItem, now - folderOffset)).toISOString(),
      items,
    } satisfies ArchiveFolder
  })

  return folders.length > 0 ? folders : null
}
