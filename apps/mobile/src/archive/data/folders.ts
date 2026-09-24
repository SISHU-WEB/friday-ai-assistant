export type ArchiveItem = {
  id: string
  title: string
  createdAt: string
}

export type ArchiveFolder = {
  id: string
  title: string
  description: string
  /** Figma mock baseline count; real saved items add on top of it. */
  seedCount: number
  /** Shown until the user saves their own item. */
  seedUpdatedLabel: string
  items: ArchiveItem[]
}

type Seed = [id: string, title: string, description: string, seedCount: number, seedUpdatedLabel: string]

const seeds: Seed[] = [
  ['travel', 'Travel', 'Plans, places and memories from journeys near and far.', 12, 'Updated 5 days ago'],
  ['learning', 'Learning', 'Courses, notes and ideas worth returning to.', 18, 'Updated yesterday'],
  ['projects', 'Projects', 'Ongoing work, creative plans and important milestones.', 8, 'Updated today'],
  ['compliance', 'Compliance', 'Regulatory documents, audit reports and compliance records for easy reference.', 24, 'Updated 2 days ago'],
  ['media', 'Media', 'Films, articles and other things to watch or read later.', 16, 'Updated 3 days ago'],
  ['ideas', 'Ideas', 'Small thoughts and sparks for future possibilities.', 31, 'Updated today'],
  ['notes', 'Notes', 'Quick references and details to keep close at hand.', 9, 'Updated last week'],
]

export const seedArchiveFolders: ArchiveFolder[] = seeds.map(([id, title, description, seedCount, seedUpdatedLabel]) => ({
  id,
  title,
  description,
  seedCount,
  seedUpdatedLabel,
  items: [],
}))

export const INITIAL_FOLDER_INDEX = 3
