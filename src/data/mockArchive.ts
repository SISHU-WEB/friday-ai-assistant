import type { ArchiveFolder } from '../types/archive'

const seededAt = '2026-05-26T08:00:00.000Z'

const item = (id: string, title: string, note: string) => ({ id, title, note, createdAt: seededAt })

export const archiveFolders: ArchiveFolder[] = [
  { id: 'projects', name: 'Projects', category: 'Projects', createdAt: seededAt, items: [item('project-friday', 'Friday App', 'Mobile-first personal focus system'), item('project-photo', 'Photography Tool', 'Learning assistant for photographers')] },
  { id: 'travel', name: 'Travel', category: 'Travel', createdAt: seededAt, items: [item('travel-kyoto', 'Kyoto autumn', 'November planning notes'), item('travel-iceland', 'Iceland road trip', 'Route ideas and saved places')] },
  { id: 'ideas', name: 'Ideas', category: 'Ideas', createdAt: seededAt, items: [item('idea-journal', 'Ambient journal', 'A quieter way to capture a day'), item('idea-photo', 'Photo essay', 'A visual story about ordinary rituals')] },
  { id: 'learning', name: 'Learning', category: 'Learning', createdAt: seededAt, items: [item('learning-react', 'React patterns', 'Components, state and data flow'), item('learning-japanese', 'Japanese practice', 'Daily vocabulary and listening')] },
  { id: 'media', name: 'Media', category: 'Media', createdAt: seededAt, items: [item('media-calm', 'Designing Calm', 'Article · 12 min'), item('media-days', 'Perfect Days', 'Film · saved for later')] },
]
