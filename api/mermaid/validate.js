// Production Mermaid validation endpoint for Vercel
// - Supports GET ?b64=<base64> or ?text=<url-encoded>
// - Supports POST JSON { b64?: string, text?: string }
// - Returns JSON { valid, error?, warning?, parser }

// No heuristic validation: use real Mermaid parser only

async function tryParseWithMermaid(text) {
  // Server-side full parsing is optional. Enable by:
  // - installing `mermaid` (adds bundle size), and
  // - set env ENABLE_MERMAID_PARSE=1
  if (process.env.ENABLE_MERMAID_PARSE !== '1') {
    return {
      valid: false,
      error: 'Mermaid parser disabled. Set ENABLE_MERMAID_PARSE=1 and install mermaid + jsdom.',
      parser: 'none',
      notImplemented: true,
    }
  }
  try {
    // Ensure a browser-like DOM exists so dompurify auto-instantiates
    if (typeof window === 'undefined' || !globalThis.window?.document) {
      const { JSDOM } = await import('jsdom')
      const { window } = new JSDOM('<!doctype html><html><body></body></html>')
      globalThis.window = window
      globalThis.document = window.document
      globalThis.self = window
    }
    // Avoid static bundler resolution by composing the module name
    const modName = ['mer', 'maid'].join('')
    const mod = await import(modName)
    const mermaid = mod?.default || mod
    try { mermaid.initialize?.({ startOnLoad: false }) } catch {}
    if (typeof mermaid.parse === 'function') {
      const maybe = mermaid.parse(text)
      if (maybe && typeof maybe.then === 'function') await maybe
      return { valid: true, parser: 'mermaid' }
    }
    if (mermaid?.mermaidAPI?.parse) {
      mermaid.mermaidAPI.parse(text)
      return { valid: true, parser: 'mermaid' }
    }
    return {
      valid: false,
      error: 'Mermaid loaded without a parser API. Cannot validate without parser.',
      parser: 'mermaid',
      notImplemented: true,
    }
  } catch (e) {
    return { valid: false, error: e?.message || String(e), parser: 'mermaid' }
  }
}

function send(res, code, obj) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(obj))
}

async function parseBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => { data += c })
    req.on('end', () => {
      const ct = String(req.headers['content-type'] || '')
      if (ct.includes('application/json')) {
        try { resolve(JSON.parse(data)) } catch { resolve({}) }
        return
      }
      resolve({ raw: data })
    })
  })
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost')
    let text = ''
    const b64 = url.searchParams.get('b64')
    const q = url.searchParams.get('q') || url.searchParams.get('text')
    if (b64) {
      try { text = Buffer.from(b64, 'base64').toString('utf8') } catch {}
    } else if (q) {
      text = q
    }
    if (!text && req.method === 'POST') {
      const body = await parseBody(req)
      if (body?.b64) {
        try { text = Buffer.from(body.b64, 'base64').toString('utf8') } catch {}
      }
      if (!text && body?.text) text = String(body.text)
      if (!text && body?.raw) text = String(body.raw)
    }
    if (!String(text || '').trim()) {
      return send(res, 400, { valid: false, error: 'Missing Mermaid definition. Provide ?b64= or ?text=, or POST { b64 | text }.' })
    }

    // Normalize common escaped newlines from query usage like %5Cn
    text = String(text).replace(/\r\n/g, '\n').replace(/\\n/g, '\n')

    // Optional: try real mermaid parse when enabled
    const parsed = await tryParseWithMermaid(text)
    if (parsed?.notImplemented) return send(res, 501, parsed)
    if (parsed) return send(res, parsed.valid ? 200 : 422, parsed)
    return send(res, 501, { valid: false, error: 'Mermaid parser unavailable', parser: 'none', notImplemented: true })
  } catch (e) {
    return send(res, 500, { valid: false, error: e?.message || String(e) })
  }
}
