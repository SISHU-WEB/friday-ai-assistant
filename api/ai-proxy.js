/**
 * Vercel Function: /api/ai-proxy (S-1)
 *
 * Proxies chat/completions calls to the configured provider so the API key
 * stays in server environment variables and never reaches the browser.
 *
 * Environment variables:
 *   AI_API_KEY   required — provider API key
 *   AI_BASE_URL  optional — defaults to https://api.deepseek.com/v1
 *   AI_MODEL     optional — overrides the model requested by the client
 */

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'AI proxy not configured' })
    return
  }

  const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const body = await readBody(req)

  const payload = {
    model: process.env.AI_MODEL || body.model || 'deepseek-chat',
    messages: Array.isArray(body.messages) ? body.messages : [],
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.6,
    response_format: body.response_format || { type: 'json_object' },
  }

  if (payload.messages.length === 0) {
    res.status(400).json({ error: 'messages required' })
    return
  }

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` })
      return
    }

    const data = await upstream.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed' })
  }
}
