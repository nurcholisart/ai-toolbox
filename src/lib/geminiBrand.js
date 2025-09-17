// Gemini-powered brand color extraction
// Inputs: { site?: string, company?: string, imageUrl?: string, max?: number, useGrounding?: boolean, vibe?: string }
// Output: { colors: string[], notes?: string, warnings?: string[] }

import { getApiKey } from './config.js'

const MODEL = 'gemini-2.5-flash-preview-05-20'

const extractJson = (text) => {
  if (!text) return null
  try { return JSON.parse(text) } catch {}
  const m = text.match(/```json\s*([\s\S]*?)```/i)
  if (m && m[1]) {
    try { return JSON.parse(m[1]) } catch {}
  }
  const i = text.indexOf('{')
  const j = text.lastIndexOf('}')
  if (i !== -1 && j !== -1 && j > i) {
    try { return JSON.parse(text.slice(i, j + 1)) } catch {}
  }
  return null
}

const sanitizeHex = (s) => {
  if (!s) return null
  const m = String(s).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return ('#' + h).toUpperCase()
}

const ensureHexArray = (arr, max) => {
  if (!Array.isArray(arr)) return []
  const out = []
  for (const v of arr) {
    if (typeof v === 'string') {
      const h = sanitizeHex(v)
      if (h) out.push(h)
    } else if (v && typeof v.hex === 'string') {
      const h = sanitizeHex(v.hex)
      if (h) out.push(h)
    }
    if (out.length >= max) break
  }
  return Array.from(new Set(out))
}

export async function extractBrandColorsWithGemini({ site = '', company = '', imageUrl = '', max = 8, useGrounding = true, vibe = '' } = {}) {
  const apiKey = getApiKey()
  const warnings = []
  if (!apiKey) {
    return { colors: [], notes: '', warnings: ['Gemini API key not set. Open Settings and add your key.'] }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`

  const hints = []
  if (vibe) hints.push(`Vibe target: ${vibe}`)
  hints.push('Prefer HEX in brand-safe mid chroma. Avoid pure black/white unless core brand colors.')
  hints.push('If the site or image is inaccessible, infer from the brand name and public knowledge.')

  const sys = [
    'You extract brand colors from provided inputs.',
    'Return up to N HEX colors representing the core palette.',
    'Output ONLY strict JSON: { colors: string[], notes: string }.',
    'colors: unique HEX strings, like "#6750A4". Keep list tight and representative.',
    'notes: brief sentence about how you derived them.',
  ].join('\n')

  const parts = []
  const lines = []
  lines.push('# TASK')
  lines.push(`Return up to ${max} brand-representative HEX colors.`)
  if (company?.trim()) lines.push(`Company/Brand: ${company.trim()}`)
  if (site?.trim()) lines.push(`Website: ${site.trim()}`)
  if (imageUrl?.trim()) lines.push(`Logo/Image URL (may be remote): ${imageUrl.trim()}`)
  if (hints.length) {
    lines.push('')
    lines.push('# HINTS')
    lines.push(...hints)
  }
  lines.push('')
  lines.push('# OUTPUT FORMAT')
  lines.push('Respond ONLY valid JSON matching: { "colors": string[], "notes": string }')

  parts.push({ text: lines.join('\n') })

  const payloadBase = {
    contents: [{ parts }],
    systemInstruction: { parts: [{ text: sys }] },
  }
  const payloadWithTools = useGrounding ? { ...payloadBase, tools: [{ googleSearch: {} }] } : payloadBase

  const tryRequest = async (payload) => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return resp
  }

  try {
    let resp = await tryRequest(payloadWithTools)
    if (!resp.ok) {
      const maybeToolIssue = resp.status === 400 || resp.status === 404
      const retriable = resp.status === 429 || resp.status >= 500
      if (maybeToolIssue && useGrounding) {
        resp = await tryRequest(payloadBase)
      } else if (retriable) {
        await new Promise((r) => setTimeout(r, 800))
        resp = await tryRequest(useGrounding ? payloadWithTools : payloadBase)
      }
    }
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`
      try { const err = await resp.json(); msg = err?.error?.message || msg } catch {}
      return { colors: [], notes: '', warnings: [msg] }
    }
    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = extractJson(text)
    if (!parsed) return { colors: [], notes: '', warnings: ['Failed to parse AI output.'] }
    const colors = ensureHexArray(parsed.colors, max)
    const notes = String(parsed.notes || '').trim()
    if (!colors.length) warnings.push('No colors returned by AI.')
    return { colors, notes, warnings }
  } catch (e) {
    return { colors: [], notes: '', warnings: [e?.message || 'Gemini request failed'] }
  }
}

