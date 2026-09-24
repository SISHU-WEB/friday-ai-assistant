import type { Task } from '../types/task'

interface ScheduleRequest {
  rawInput: string
  date: string
  existingTasks: Task[]
  currentTime?: string
}

interface ScheduledTask {
  title: string
  description?: string
  startTime: string
  endTime: string
  category?: string
  priority?: 'high' | 'medium' | 'low'
}

interface ScheduleResponse {
  tasks: ScheduledTask[]
  summary: string
}

function getApiKey(): string | null {
  return localStorage.getItem('friday-openai-key')
}

function getModel(): string {
  return localStorage.getItem('friday-ai-model') || 'gpt-4o-mini'
}

function getBaseUrl(): string {
  const custom = localStorage.getItem('friday-ai-base-url')
  if (custom) return custom.replace(/\/$/, '')
  return 'https://api.openai.com/v1'
}

export async function aiScheduleTasks(request: ScheduleRequest): Promise<ScheduleResponse | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('No OpenAI API key configured')
    return null
  }

  const systemPrompt = `You are Friday, an AI planning assistant. The user tells you what they need to do today in natural language. Your job is to break it down into scheduled tasks with reasonable time blocks.

Rules:
- Output ONLY valid JSON, no markdown
- Each task needs: title, startTime (HH:MM), endTime (HH:MM), category, priority
- Schedule realistic blocks: deep work 90min, shallow work 30-45min, breaks 15min
- Leave buffer time between tasks
- Don't schedule before 8am or after 10pm
- Return format: { "tasks": [...], "summary": "brief plan summary in user's language" }`

  const userPrompt = `Today: ${request.date}
Existing tasks: ${JSON.stringify(request.existingTasks)}
User says: "${request.rawInput}"

Generate a schedule. Return JSON only.`

  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.error('AI schedule failed:', response.status)
      return null
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content
    if (!content) return null

    return JSON.parse(content) as ScheduleResponse
  } catch (err) {
    console.error('AI schedule error:', err)
    return null
  }
}

export async function aiReplan(request: {
  interruptedTask: Task
  interruption: string
  remainingTasks: Task[]
  currentTime: string
}): Promise<ScheduleResponse | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const systemPrompt = `You are Friday, an AI planning assistant. A user was working on a task when an interruption happened. Your job is to reschedule the rest of the day intelligently.

Rules:
- Output ONLY valid JSON, no markdown
- Move the interrupted task to a better time
- Adjust all remaining tasks accordingly
- Leave buffer for the interruption itself
- Return format: { "tasks": [...], "summary": "brief explanation in user's language" }`

  const userPrompt = `Current time: ${request.currentTime}
Interrupted task: ${JSON.stringify(request.interruptedTask)}
Interruption: "${request.interruption}"
Remaining tasks: ${JSON.stringify(request.remainingTasks)}

Reschedule the day. Return JSON only.`

  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0]?.message?.content
    if (!content) return null
    return JSON.parse(content) as ScheduleResponse
  } catch (err) {
    console.error('AI replan error:', err)
    return null
  }
}

export function isAIConfigured(): boolean {
  return !!getApiKey()
}
