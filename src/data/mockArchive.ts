import type { ArchiveFolder, ArchiveItem } from '../types/archive'

/**
 * The archive's starting content.
 *
 * These are the same seven folders, twenty-nine documents, item counts and
 * relative timestamps the archive screen originally carried inside
 * `public/archive.html`, so the ported screen opens on exactly the picture it had
 * before. Ages are expressed relative to the moment the app starts, which is what
 * the original relative labels ("Updated yesterday", "5 hours ago") described.
 */
const now = Date.now()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const ago = (offset: number) => new Date(now - offset).toISOString()

interface SeedFolder {
  name: string
  /** Total items in the folder (the folder list is a preview of the newest ones). */
  count: number
  /** Age of the folder's most recent change. */
  age: number
  docs: Array<[title: string, age: number]>
}

const seed: SeedFolder[] = [
  {
    name: 'Travel',
    count: 12,
    age: DAY,
    docs: [
      ['Tokyo Trip Plan', DAY],
      ['Flight bookings', 2 * DAY],
      ['Hotel reservations', 3 * DAY],
      ['Packing list', 5 * DAY],
    ],
  },
  {
    name: 'Learning',
    count: 8,
    age: 3 * DAY,
    docs: [
      ['React Course Notes', 3 * DAY],
      ['CSS Deep Dive', 7 * DAY],
      ['Algorithm book notes', 14 * DAY],
      ['Study Plan Q4', 30 * DAY],
    ],
  },
  {
    name: 'Projects',
    count: 15,
    age: 7 * DAY,
    docs: [
      ['Website Redesign', 7 * DAY],
      ['API v2 Spec', 14 * DAY],
      ['Launch checklist', 21 * DAY],
      ['User research', 30 * DAY],
      ['Sprint retro', 30 * DAY],
    ],
  },
  {
    name: 'Compliance',
    count: 24,
    age: 2 * DAY,
    docs: [
      ['GDPR Audit Report', 2 * DAY],
      ['Data Retention Policy', 7 * DAY],
      ['SOC2 Controls', 14 * DAY],
      ['Vendor Risk Assessment', 21 * DAY],
      ['Incident Log Q3', 30 * DAY],
      ['Compliance Checklist', 30 * DAY],
    ],
  },
  {
    name: 'Media',
    count: 31,
    age: 5 * HOUR,
    docs: [
      ['Product Photos', 5 * HOUR],
      ['Brand Assets', 7 * DAY],
      ['Video Edits', 14 * DAY],
      ['Screenshots Archive', 30 * DAY],
    ],
  },
  {
    name: 'Ideas',
    count: 9,
    age: 7 * DAY,
    docs: [
      ['Startup Ideas', 7 * DAY],
      ['App Concepts', 14 * DAY],
      ['Inspiration Board', 21 * DAY],
    ],
  },
  {
    name: 'Notes',
    count: 5,
    age: 0,
    docs: [
      ['Quick Note', 0],
      ['Meeting Notes', DAY],
      ['To-do list', 3 * DAY],
    ],
  },
]

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export const archiveFolders: ArchiveFolder[] = seed.map((folder) => {
  const id = slug(folder.name)
  const items: ArchiveItem[] = folder.docs.map(([title, age], index) => ({
    id: `${id}-doc-${index + 1}`,
    title,
    note: '',
    createdAt: ago(age),
  }))

  return {
    id,
    name: folder.name,
    category: folder.name,
    createdAt: ago(folder.age),
    updatedAt: ago(folder.age),
    itemCount: folder.count,
    items,
  }
})
