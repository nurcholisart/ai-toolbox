import React, { useRef, useState } from 'react'

export default function SSEToJSON() {
  const inputRef = useRef(null)
  const outputRef = useRef(null)
  const [input, setInput] = useState(example)
  const [mode, setMode] = useState('unified')
  const [outputShape, setOutputShape] = useState('response')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const handleParse = () => {
    setError('')
    try {
      const events = parseSSE(input)
      if (mode === 'events') {
        setResult(JSON.stringify(events, null, 2))
        return
      }
      const unified = unifyOpenAIResponses(events)
      const out = outputShape === 'response' ? unified.response ?? null : unified
      setResult(JSON.stringify(out, null, 2))
    } catch (e) {
      setError(e?.message || String(e))
      setResult('')
    }
  }

  const handleCopy = () => {
    try {
      if (!result) return
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(result)
          .then(() => toast('Copied to clipboard.'))
          .catch(() => {
            const ok = fallbackCopyText(result)
            toast(ok ? 'Copied with fallback.' : 'Copy failed.')
          })
      } else {
        const ok = fallbackCopyText(result)
        toast(ok ? 'Copied with fallback.' : 'Copy failed.')
      }
    } catch {
      toast('Copy failed.')
    }
  }

  const handleDownload = () => {
    try {
      if (!result) return
      const blob = new Blob([result], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = mode === 'events' ? 'events.json' : 'unified.json'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      toast('Downloaded JSON.')
    } catch {
      toast('Download failed.')
    }
  }

  const runTests = () => {
    const logs = []
    const ok = (msg) => logs.push('✅ ' + msg)
    const fail = (msg) => logs.push('❌ ' + msg)

    try {
      const ev1 = parseSSE(example)
      const u1 = unifyOpenAIResponses(ev1)
      if (u1.response?.status === 'completed') ok('Status reported as completed')
      else fail('Status not completed')
      const item = u1.response?.output?.find((x) => x?.id === 'rs_abc')
      if (item && item.delta_text?.includes('**Starting')) ok('Delta merged into item.delta_text')
      else fail('Delta not merged')

      const sample2 = `:comment\nevent: note\ndata: {"a":1}\nfoo: bar\n\n`
      const ev2 = parseSSE(sample2)
      if (ev2.length === 1 && ev2[0].dataJSON?.a === 1) ok('Comments and unknown fields handled')
      else fail('Comments or extra fields failed')

      const sample3 = `event: x\ndata: hello\n\n`
      const ev3 = parseSSE(sample3)
      if (ev3[0].dataJSON === undefined && ev3[0].dataText === 'hello') ok('Non-JSON data kept raw')
      else fail('Non-JSON handling failed')
    } catch (e) {
      logs.push('❌ Tests crashed: ' + (e?.message || String(e)))
    }

    console.log('SSE to JSON tests:\n' + logs.join('\n'))
    const passed = logs.filter((l) => l.startsWith('✅')).length
    toast(`Tests completed: ${passed}/3 passed. Check console for details.`)
  }

  const toast = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 1500)
  }

  return (
    <main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16'>
      <header className='py-8'>
        <h1 className='text-3xl font-semibold tracking-tight text-black'>Server-Sent Events to JSON</h1>
        <p className='mt-2 text-sm text-gray-700'>
          Paste a <code>text/event-stream</code> transcript from the OpenAI Responses API (or any SSE source). The parser honours the
          SSE spec: multi-line <code>data:</code> fields, blank lines as separators, and comment lines starting with <code>:</code>.
          Choose between the raw events or a merged JSON response.
        </p>
      </header>

      <section className='bg-white border-2 border-black rounded-xl shadow-md p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-wrap items-center gap-3'>
            <ModeSwitch mode={mode} setMode={setMode} />
            <OutputShapeSwitch value={outputShape} setValue={setOutputShape} />
            <button
              onClick={handleParse}
              className='inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black'
            >
              Parse
            </button>
            <button
              onClick={handleCopy}
              className='inline-flex items-center justify-center rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-50'
              disabled={!result}
            >
              Copy JSON
            </button>
            <button
              onClick={handleDownload}
              className='inline-flex items-center justify-center rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-50'
              disabled={!result}
            >
              Download
            </button>
            <button
              onClick={runTests}
              className='inline-flex items-center justify-center rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black hover:bg-gray-100'
            >
              Run tests
            </button>
          </div>
          <div aria-live='polite' className='text-xs text-gray-700 min-h-[1rem]'>
            {notice}
          </div>
        </div>

        <div className='mt-6 grid gap-6 lg:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-black'>SSE input</label>
            <textarea
              ref={inputRef}
              className='min-h-[600px] w-full resize-none rounded-lg border-2 border-black bg-white p-4 font-mono text-xs leading-5 focus:outline-none focus:ring-0'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-black'>Output</label>
            {error ? (
              <div className='rounded-lg border-2 border-black bg-gray-100 p-3 text-sm text-black'>
                {error}
              </div>
            ) : null}
            <pre
              ref={outputRef}
              className='min-h-[600px] whitespace-pre-wrap rounded-lg border-2 border-black bg-white p-4 font-mono text-xs leading-5 overflow-auto'
            >
              {result || '// Result will appear here after parsing'}
            </pre>
          </div>
        </div>
      </section>
    </main>
  )
}

function ModeSwitch({ mode, setMode }) {
  const options = [
    { k: 'unified', label: 'Unified JSON' },
    { k: 'events', label: 'Raw events' },
  ]
  return (
    <div className='inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white p-1 text-xs shadow-sm'>
      {options.map((opt) => (
        <button
          key={opt.k}
          onClick={() => setMode(opt.k)}
          className={`rounded-md px-3 py-1 font-medium ${mode === opt.k ? 'bg-black text-white' : 'text-black hover:bg-gray-100'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function OutputShapeSwitch({ value, setValue }) {
  const options = [
    { k: 'response', label: 'Response only' },
    { k: 'full', label: 'With metadata' },
  ]
  return (
    <div className='inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white p-1 text-xs shadow-sm'>
      {options.map((opt) => (
        <button
          key={opt.k}
          onClick={() => setValue(opt.k)}
          className={`rounded-md px-3 py-1 font-medium ${value === opt.k ? 'bg-black text-white' : 'text-black hover:bg-gray-100'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/**
 * @typedef {Object} SseMessage
 * @property {string=} event
 * @property {string=} id
 * @property {string=} retry
 * @property {string[]} data
 * @property {Record<string, string[]>=} extra
 * @property {string=} dataText
 * @property {*} [dataJSON]
 */

const parseSSE = (text) => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let cur = null

  const push = () => {
    if (!cur) return
    const hasContent = Boolean(
      (cur.event && cur.event.length > 0) ||
      (cur.id && cur.id.length > 0) ||
      (cur.retry && cur.retry.length > 0) ||
      (cur.data && cur.data.length > 0) ||
      (cur.extra && Object.keys(cur.extra).length > 0)
    )
    if (!hasContent) {
      cur = null
      return
    }
    cur.dataText = cur.data.join('\n')
    try {
      cur.dataJSON = cur.dataText ? JSON.parse(cur.dataText) : undefined
    } catch {
      cur.dataJSON = undefined
    }
    out.push(cur)
    cur = null
  }

  for (const raw of lines) {
    const line = raw
    if (line === '') {
      push()
      continue
    }
    if (!cur) cur = { data: [], extra: {} }
    if (line.startsWith(':')) {
      continue
    }
    const idx = line.indexOf(':')
    if (idx === -1) {
      const name = line.trim()
      if (name) {
        if (!cur.extra[name]) cur.extra[name] = []
        cur.extra[name].push('')
      }
      continue
    }
    const field = line.slice(0, idx).trim()
    let value = line.slice(idx + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'event':
        cur.event = value
        break
      case 'data':
        cur.data.push(value)
        break
      case 'id':
        cur.id = value
        break
      case 'retry':
        cur.retry = value
        break
      default:
        if (!cur.extra[field]) cur.extra[field] = []
        cur.extra[field].push(value)
    }
  }
  push()
  return out
}

const unifyOpenAIResponses = (events) => {
  let response = null
  const itemsById = {}
  let hasCompleted = false
  const typeCounts = {}

  const ensureOutput = () => {
    if (!response) response = {}
    if (!Array.isArray(response.output)) response.output = []
  }

  for (const ev of events) {
    const t = (ev.dataJSON && ev.dataJSON.type) || ev.event || ''
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1
    const d = ev.dataJSON
    if (!d) continue
    if (d.type && d.type.startsWith('response.')) {
      switch (d.type) {
        case 'response.created':
        case 'response.in_progress':
          if (d.response) {
            response = deepMerge(response, d.response)
            if (Array.isArray(response?.output)) {
              for (const it of response.output) {
                if (it?.id) itemsById[it.id] = it
              }
            }
          }
          break
        case 'response.output_item.added': {
          ensureOutput()
          const item = d.item || (d.response && d.response.item)
          if (item) {
            response.output.push(item)
            if (item.id) itemsById[item.id] = item
          }
          break
        }
        default: {
          if (d.type.endsWith('.delta') && d.item_id && typeof d.delta === 'string') {
            const target = itemsById[d.item_id] || (() => {
              const placeholder = { id: d.item_id, type: 'unknown', delta_text: '' }
              ensureOutput()
              response.output.push(placeholder)
              itemsById[d.item_id] = placeholder
              return placeholder
            })()
            target.delta_text = (target.delta_text || '') + d.delta
          }
          if (d.response) {
            response = deepMerge(response, d.response)
            if (Array.isArray(response?.output)) {
              for (const it of response.output) {
                if (it?.id) itemsById[it.id] = it
              }
            }
          }
          if (d.type === 'response.completed') {
            hasCompleted = true
          }
        }
      }
    }
  }

  return {
    response,
    stream_summary: {
      total_events: events.length,
      types: typeCounts,
      has_completed: hasCompleted,
    },
    events,
  }
}

const deepMerge = (a, b) => {
  if (a == null) return clone(b)
  if (b == null) return clone(a)
  if (Array.isArray(a) && Array.isArray(b)) {
    const byId = {}
    const out = []
    for (const it of a) {
      if (it && typeof it === 'object' && it.id) byId[it.id] = clone(it)
      else out.push(clone(it))
    }
    for (const it of b) {
      if (it && typeof it === 'object' && it.id) {
        const merged = Object.prototype.hasOwnProperty.call(byId, it.id) ? deepMerge(byId[it.id], it) : clone(it)
        byId[it.id] = merged
      } else {
        out.push(clone(it))
      }
    }
    const bIds = b.filter((x) => x && x.id).map((x) => x.id)
    for (const id of bIds) out.push(byId[id])
    for (const [id, val] of Object.entries(byId)) {
      if (!bIds.includes(id)) out.push(val)
    }
    return out
  }
  if (isPlain(a) && isPlain(b)) {
    const out = { ...a }
    for (const k of Object.keys(b)) {
      out[k] = deepMerge(a?.[k], b[k])
    }
    return out
  }
  return clone(b)
}

const isPlain = (x) => Boolean(x && typeof x === 'object' && !Array.isArray(x))

const clone = (x) => {
  if (x == null) return x
  if (typeof x !== 'object') return x
  return JSON.parse(JSON.stringify(x))
}

const fallbackCopyText = (text) => {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand && document.execCommand('copy')
    document.body.removeChild(ta)
    return Boolean(ok)
  } catch {
    return false
  }
}

const example = `event: response.created\n` +
  `data: {"type":"response.created","sequence_number":0,"response":{"id":"resp_0b3490...","object":"response","created_at":1761127420,"status":"in_progress","output":[],"model":"gpt-5-codex"}}\n\n` +
  `event: response.in_progress\n` +
  `data: {"type":"response.in_progress","sequence_number":1,"response":{"id":"resp_0b3490...","status":"in_progress"}}\n\n` +
  `event: response.output_item.added\n` +
  `data: {"type":"response.output_item.added","sequence_number":2,"output_index":0,"item":{"id":"rs_abc","type":"reasoning","encrypted_content":"...","summary":[]}}\n\n` +
  `event: response.reasoning_summary_text.delta\n` +
  `data: {"type":"response.reasoning_summary_text.delta","sequence_number":3,"item_id":"rs_abc","delta":"**Starting"}\n\n` +
  `event: response.completed\n` +
  `data: {"type":"response.completed","sequence_number":999,"response":{"id":"resp_0b3490...","status":"completed"}}\n\n`
