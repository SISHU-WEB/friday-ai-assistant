import type { Task } from '../types/task'

export interface ScheduleRequest {
  rawInput: string
  date: string
  existingTasks: Task[]
  currentTime?: string
  isPremium?: boolean
}

export interface ScheduledTask {
  title: string
  description?: string
  startTime: string
  endTime: string
  category: string
  priority: 'high' | 'medium' | 'low'
  isFlexible?: boolean
  tags?: string[]
}

export interface ScheduleResponse {
  tasks: ScheduledTask[]
  summary: string
  suggestions?: string[]
}

export interface InterruptionRequest {
  interruptedTask: Task
  interruptionReason: string
  estimatedReturnMinutes: number
  remainingTasks: Task[]
  currentTime: string
  date: string
}

export interface ArchiveClassifyRequest {
  title: string
  note?: string
  existingCategories: string[]
}

export interface ArchiveClassifyResponse {
  category: string
  suggestedTitle?: string
  summary?: string
  isLongTerm?: boolean
}

export function getApiKey(): string | null {
  return localStorage.getItem('friday-openai-key')
}

export function getModel(): string {
  const custom = localStorage.getItem('friday-ai-model')
  if (custom) return custom
  const baseUrl = localStorage.getItem('friday-ai-base-url') || ''
  if (baseUrl.includes('deepseek')) return 'deepseek-chat'
  return 'gpt-4o-mini'
}

export function getBaseUrl(): string {
  const custom = localStorage.getItem('friday-ai-base-url')
  if (custom) return custom.replace(/\/$/, '')
  return 'https://api.deepseek.com/v1'
}

export function isAIConfigured(): boolean {
  return !!getApiKey()
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * Calls the server-side proxy when deployed (Vercel Function /api/ai-proxy,
 * S-1) so the key stays in env vars; falls back to a direct provider call
 * with a locally configured key when no proxy is available.
 */
async function callAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  const requestBody = {
    model: getModel(),
    messages,
    temperature: 0.6,
    response_format: { type: 'json_object' },
  }

  try {
    const proxyResponse = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    if (proxyResponse.ok) {
      const data = (await proxyResponse.json()) as ChatCompletionResponse
      const content = data.choices?.[0]?.message?.content
      if (content) return content
    }
  } catch {
    // No proxy in this environment (local dev / native app) — fall through.
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('No API key configured')
    return null
  }

  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      console.error('AI call failed:', response.status)
      return null
    }

    const data = (await response.json()) as ChatCompletionResponse
    const content = data.choices?.[0]?.message?.content
    return content || null
  } catch (err) {
    console.error('AI call error:', err)
    return null
  }
}

const SCHEDULE_SYSTEM_PROMPT = `You are Friday, an intelligent AI planning assistant. The user provides schedule input via natural language or voice. Your job:

1. Parse the input and extract all tasks/activities
2. Automatically classify each task into categories: Work, Study, Life, Health, Social, Entertainment, Other
3. Assign realistic time blocks: deep work 60-90min, meetings 30-60min, meals 30-45min, breaks 10-15min, exercise 30-60min
4. Schedule within 08:00 - 22:00, leave 5-10min buffer between tasks
5. Support flexible time (isFlexible=true) for tasks without strict timing
6. Assign priority based on urgency/importance cues
7. Extract additional tags (e.g. ["urgent", "remote", "client"])

Return ONLY valid JSON:
{
  "tasks": [{
    "title": "short task name",
    "description": "optional detailed description",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "category": "Work|Study|Life|Health|Social|Entertainment|Other",
    "priority": "high|medium|low",
    "isFlexible": false,
    "tags": ["tag1"]
  }],
  "summary": "Brief Chinese/English summary matching user language",
  "suggestions": ["optional helpful tips"]
}`

export async function aiScheduleTasks(request: ScheduleRequest): Promise<ScheduleResponse | null> {
  const userPrompt = `Date: ${request.date}
Current time: ${request.currentTime || new Date().toTimeString().slice(0, 5)}
Existing tasks: ${JSON.stringify(request.existingTasks)}
User input: "${request.rawInput}"

Generate a smart schedule. Return JSON only.`

  const raw = await callAI(SCHEDULE_SYSTEM_PROMPT, userPrompt)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ScheduleResponse
  } catch {
    return null
  }
}

const REPLAN_SYSTEM_PROMPT = `You are Friday, an AI planning assistant handling interruptions. The user was interrupted mid-task. Your job:

1. Account for the interruption duration (estimatedReturnMinutes)
2. Move the interrupted task forward to an available slot
3. Reschedule all remaining tasks accordingly, preserving priorities
4. Consider cutting short low-priority tasks if time is tight
5. Be empathetic and practical

Return ONLY valid JSON:
{
  "tasks": [{ "title": "...", "description": "...", "startTime": "HH:MM", "endTime": "HH:MM", "category": "...", "priority": "high|medium|low", "isFlexible": false }],
  "summary": "Brief explanation of rescheduling in user's language"
}`

export async function aiReplanInterruption(request: InterruptionRequest): Promise<ScheduleResponse | null> {
  const userPrompt = `Date: ${request.date}
Current time: ${request.currentTime}
Interrupted task: ${JSON.stringify(request.interruptedTask)}
Interruption reason: "${request.interruptionReason}"
Estimated return in: ${request.estimatedReturnMinutes} minutes
Remaining tasks today: ${JSON.stringify(request.remainingTasks)}

Reschedule the rest of the day. Return JSON only.`

  const raw = await callAI(REPLAN_SYSTEM_PROMPT, userPrompt)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ScheduleResponse
  } catch {
    return null
  }
}

const ADJUST_SYSTEM_PROMPT = `You are Friday, an AI planning assistant. The user wants to adjust their existing schedule. Your job:

1. Apply the user's requested changes
2. Re-optimize remaining time blocks
3. Avoid conflicts, keep buffers
4. Preserve priorities unless user says otherwise

Return ONLY valid JSON:
{
  "tasks": [...],
  "summary": "brief explanation of changes"
}`

export async function aiAdjustSchedule(
  date: string,
  existingTasks: Task[],
  userChangeRequest: string,
  currentTime?: string
): Promise<ScheduleResponse | null> {
  const userPrompt = `Date: ${date}
Current time: ${currentTime || new Date().toTimeString().slice(0, 5)}
Existing tasks: ${JSON.stringify(existingTasks)}
User's adjustment request: "${userChangeRequest}"

Apply changes and produce new full-day schedule. Return JSON only.`

  const raw = await callAI(ADJUST_SYSTEM_PROMPT, userPrompt)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ScheduleResponse
  } catch {
    return null
  }
}

const ARCHIVE_SYSTEM_PROMPT = `You are Friday, an AI organizer for the Archive module. The user wants to archive an item for long-term storage. Your job:

1. Classify it into one of these categories, or suggest a NEW category name if none fit:
   - Projects (active work, milestones)
   - Learning (courses, notes, bookmarks)
   - Travel (trips, itineraries, bookings)
   - Health (fitness plans, medical, habits)
   - Ideas (brainstorms, inspirations)
   - Media (photos, videos, creative assets)
   - Life (personal, hobbies, long-term goals)
   - Other
2. If user content hints at long-term planning (weeks/months), set isLongTerm=true
3. Optionally refine the title to be cleaner
4. Provide a 1-sentence summary

Return ONLY valid JSON:
{
  "category": "Projects|Learning|Travel|Health|Ideas|Media|Life|Other|CustomName",
  "suggestedTitle": "cleaner title",
  "summary": "1-sentence description",
  "isLongTerm": true
}`

export async function aiClassifyArchive(
  request: ArchiveClassifyRequest
): Promise<ArchiveClassifyResponse | null> {
  const userPrompt = `Existing categories: ${JSON.stringify(request.existingCategories)}
Item title: "${request.title}"
Item note/body: "${request.note || ''}"

Classify this archive item. Return JSON only.`

  const raw = await callAI(ARCHIVE_SYSTEM_PROMPT, userPrompt)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ArchiveClassifyResponse
  } catch {
    return null
  }
}

