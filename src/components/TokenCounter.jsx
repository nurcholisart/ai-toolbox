import React, { useEffect, useMemo, useState } from 'react'

const MODEL_OPTIONS = [
  { id: 'cl100k_base', label: 'GPT-4o/4/3.5 (cl100k_base)' },
  { id: 'p50k_base', label: 'Codex & GPT-3 Legacy (p50k_base)' },
  { id: 'r50k_base', label: 'GPT-2 (r50k_base)' },
]

const TOKEN_SWATCHES = [
  'bg-gray-900 text-gray-100 border border-black',
  'bg-gray-800 text-gray-100 border border-black',
  'bg-gray-700 text-gray-100 border border-black',
  'bg-gray-600 text-gray-100 border border-black',
  'bg-gray-500 text-gray-900 border border-black',
  'bg-gray-400 text-gray-900 border border-black',
  'bg-gray-300 text-gray-900 border border-black',
  'bg-gray-200 text-gray-900 border border-black',
]

const STORAGE_TEXT_KEY = 'token-counter:text'
const STORAGE_MODEL_KEY = 'token-counter:model'

const TEST_CASES = [
  { name: 'Empty input', text: '', asserts: [(enc, toks) => toks.length === 0] },
  { name: 'Simple ASCII', text: 'Hello world', asserts: [(enc, toks) => enc.decode(toks) === 'Hello world'] },
  { name: 'Emoji', text: '🙂🔥', asserts: [(enc, toks) => enc.decode(toks) === '🙂🔥'] },
  { name: 'Multiline', text: 'Line1\nLine2', asserts: [(enc, toks) => enc.decode(toks) === 'Line1\nLine2'] },
  { name: 'Indonesian + punctuation', text: 'Halo, dunia! Apa kabar?', asserts: [(enc, toks) => enc.decode(toks) === 'Halo, dunia! Apa kabar?'] },
  { name: 'CJK', text: '中文測試かなカナ漢字', asserts: [(enc, toks) => enc.decode(toks) === '中文測試かなカナ漢字'] },
  { name: 'RTL Arabic', text: 'مرحبا بالعالم', asserts: [(enc, toks) => enc.decode(toks) === 'مرحبا بالعالم'] },
  { name: 'Combining marks', text: 'é café naïve', asserts: [(enc, toks) => enc.decode(toks) === 'é café naïve'] },
  { name: 'URL & symbols', text: 'Visit https://example.com/?q=token+count#hash ✅', asserts: [(enc, toks) => enc.decode(toks) === 'Visit https://example.com/?q=token+count#hash ✅'] },
  { name: 'Long text', text: 'A'.repeat(2048), asserts: [(enc, toks) => enc.decode(toks) === 'A'.repeat(2048)] },
  { name: 'ZWJ emoji sequence', text: '👩‍💻👨‍👩‍👧‍👦', asserts: [(enc, toks) => enc.decode(toks) === '👩‍💻👨‍👩‍👧‍👦'] },
  { name: 'Tabs and spaces', text: 'a\tb  c', asserts: [(enc, toks) => enc.decode(toks) === 'a\tb  c'] },
  { name: 'Hangul', text: '안녕하세요 세계', asserts: [(enc, toks) => enc.decode(toks) === '안녕하세요 세계'] },
  { name: 'Surrogate pair (CJK Ext-B)', text: '𠜎', asserts: [(enc, toks) => enc.decode(toks) === '𠜎'] },
  { name: 'CRLF', text: 'a\r\nb', asserts: [(enc, toks) => enc.decode(toks) === 'a\r\nb'] },
]

const withTimeout = (promise, ms, label) => {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) reject(new Error(`timeout: ${label}`))
    }, ms)
    promise
      .then((value) => {
        settled = true
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        settled = true
        clearTimeout(timer)
        reject(err)
      })
  })
}

const tryImport = (url) => withTimeout(import(/* @vite-ignore */ url), 12000, `import ${url}`)

const loadTokenizerModule = async (setStatus) => {
  const override = typeof window !== 'undefined' ? window.GPT_TOKENIZER_URL : ''
  const urls = [
    override,
    'https://cdn.jsdelivr.net/npm/gpt-tokenizer@2.6.1/+esm',
    'https://unpkg.com/gpt-tokenizer@2.6.1?module',
    'https://esm.run/gpt-tokenizer@2.6.1',
    'https://esm.sh/gpt-tokenizer@2.6.1?target=es2022&bundle',
    'https://cdn.skypack.dev/gpt-tokenizer@2.6.1',
  ].filter(Boolean)

  let lastErr = null
  for (const url of urls) {
    try {
      setStatus(`Importing tokenizer from ${url}`)
      const mod = await tryImport(url)
      let host = ''
      try {
        host = new URL(url).hostname
      } catch {
        host = url
      }
      return { mod, host }
    } catch (err) {
      lastErr = err
      console.warn('Import failed', url, err)
    }
  }
  throw lastErr || new Error('Unable to import gpt-tokenizer from any CDN')
}

const asEncoder = (obj) => {
  if (!obj) return null
  if (typeof obj.encode === 'function' && typeof obj.decode === 'function') {
    return obj
  }
  return null
}

const buildEncodersFromModule = (mod) => {
  const enc = {}
  if (!mod || typeof mod !== 'object') {
    throw new Error('Invalid gpt-tokenizer module shape')
  }

  if (typeof mod.get_encoding === 'function') {
    try { enc.cl100k_base = asEncoder(mod.get_encoding('cl100k_base')) } catch {}
    try { enc.p50k_base = asEncoder(mod.get_encoding('p50k_base')) } catch {}
    try { enc.r50k_base = asEncoder(mod.get_encoding('r50k_base')) } catch {}
  }

  if (mod.encodings && typeof mod.encodings === 'object') {
    if (!enc.cl100k_base) enc.cl100k_base = asEncoder(mod.encodings.cl100k_base)
    if (!enc.p50k_base) enc.p50k_base = asEncoder(mod.encodings.p50k_base)
    if (!enc.r50k_base) enc.r50k_base = asEncoder(mod.encodings.r50k_base)
  }

  if (!enc.cl100k_base) enc.cl100k_base = asEncoder(mod.cl100k_base)
  if (!enc.p50k_base) enc.p50k_base = asEncoder(mod.p50k_base)
  if (!enc.r50k_base) enc.r50k_base = asEncoder(mod.r50k_base)

  const encForModel = mod.encoding_for_model || mod.encodingForModel || mod.encoding_for || mod.getEncodingForModel
  if (typeof encForModel === 'function') {
    const map = {
      cl100k_base: 'gpt-4o',
      p50k_base: 'text-davinci-003',
      r50k_base: 'gpt2',
    }
    try { if (!enc.cl100k_base) enc.cl100k_base = asEncoder(encForModel(map.cl100k_base)) } catch {}
    try { if (!enc.p50k_base) enc.p50k_base = asEncoder(encForModel(map.p50k_base)) } catch {}
    try { if (!enc.r50k_base) enc.r50k_base = asEncoder(encForModel(map.r50k_base)) } catch {}
  }

  if (!enc.cl100k_base || !enc.p50k_base || !enc.r50k_base) {
    if (typeof mod.encode === 'function' && typeof mod.decode === 'function') {
      const generic = {
        encode: (text) => mod.encode(text),
        decode: (ids) => mod.decode(ids),
      }
      if (!enc.cl100k_base) enc.cl100k_base = generic
      if (!enc.p50k_base) enc.p50k_base = generic
      if (!enc.r50k_base) enc.r50k_base = generic
    }
  }

  if (!enc.cl100k_base || !enc.p50k_base || !enc.r50k_base) {
    throw new Error(`API mismatch. Exposed keys: ${Object.keys(mod).join(', ')}`)
  }

  return enc
}

const prepareEncoders = (mod) => {
  const candidates = [mod, mod?.default]
  let lastErr = null
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return buildEncodersFromModule(candidate)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Failed to build encoders from module exports')
}

export default function TokenCounter() {
  const [text, setText] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_TEXT_KEY) || ''
  })
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === 'undefined') return 'cl100k_base'
    const stored = window.localStorage.getItem(STORAGE_MODEL_KEY)
    return MODEL_OPTIONS.some((opt) => opt.id === stored) ? stored : 'cl100k_base'
  })
  const [status, setStatus] = useState('Loading tokenizer module…')
  const [encoderMap, setEncoderMap] = useState({})
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [libInfo, setLibInfo] = useState('')
  const [tokens, setTokens] = useState([])
  const [tokenSegments, setTokenSegments] = useState([])
  const [copyLabel, setCopyLabel] = useState('Copy tokens JSON')
  const [testsVisible, setTestsVisible] = useState(false)
  const [testSummary, setTestSummary] = useState('')
  const [testLines, setTestLines] = useState([])

  const charCount = useMemo(() => text.length, [text])
  const tokenCount = useMemo(() => tokens.length, [tokens])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      try {
        setStatus('Loading gpt-tokenizer (pure JS)…')
        const { mod, host } = await loadTokenizerModule(setStatus)
        if (cancelled) return
        const enc = prepareEncoders(mod)
        if (cancelled) return
        setEncoderMap(enc)
        setLibInfo(`Library: gpt-tokenizer (pure JS) • Source: ${host}`)
        setStatus('Tokenizer ready.')
        setIsReady(true)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setLoadError(err?.message || 'Failed to load tokenizer.')
        setStatus('Tokenizer is unavailable.')
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_TEXT_KEY, text)
  }, [text])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_MODEL_KEY, selectedModel)
  }, [selectedModel])

  useEffect(() => {
    const encoder = encoderMap[selectedModel]
    if (!encoder) {
      setTokens([])
      setTokenSegments([])
      return
    }
    const source = text || ''
    try {
      const encoded = encoder.encode(source)
      setTokens(encoded)
      const segments = encoded.map((id) => {
        let chunk = ''
        try {
          chunk = encoder.decode([id])
        } catch {
          chunk = `[${id}]`
        }
        const normalized = chunk.replace(/ /g, '\u00A0').replace(/\n/g, '↵\n')
        return { id, text: normalized }
      })
      setTokenSegments(segments)
    } catch (err) {
      console.error(err)
      setTokens([])
      setTokenSegments([])
    }
  }, [text, selectedModel, encoderMap])

  const handleModelChange = (id) => {
    if (id === selectedModel) return
    setSelectedModel(id)
  }

  const handleCopyJson = async () => {
    try {
      const payload = {
        model: selectedModel,
        text,
        tokens,
      }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy tokens JSON'), 1200)
    } catch {
      setCopyLabel('Copy failed')
      setTimeout(() => setCopyLabel('Copy tokens JSON'), 1400)
    }
  }

  const handleRunTests = () => {
    setTestsVisible(true)
    const lines = []
    let passed = 0
    let total = 0
    MODEL_OPTIONS.forEach((option) => {
      lines.push({ type: 'header', text: `Model: ${option.id}` })
      const encoder = encoderMap[option.id]
      if (!encoder) {
        lines.push({ type: 'case', ok: false, text: 'Encoder unavailable.' })
        return
      }
      TEST_CASES.forEach((tc) => {
        total += 1
        let ok = false
        let message = ''
        try {
          const toks = encoder.encode(tc.text)
          ok = tc.asserts.every((fn) => {
            try {
              return !!fn(encoder, toks)
            } catch {
              return false
            }
          })
          message = `tokens=${toks.length}`
        } catch (err) {
          message = `exception: ${err?.message || err}`
        }
        if (ok) passed += 1
        lines.push({ type: 'case', ok, text: `${tc.name} — ${message}` })
      })
    })
    setTestLines(lines)
    setTestSummary(`${passed}/${total} tests passed`)
  }

  const clearInput = () => {
    setText('')
    setTokenSegments([])
    setTokens([])
  }

  const mainVisible = isReady && !loadError

  return (
    <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
      <div className='bg-white border-2 border-black rounded-xl shadow-md p-6 sm:p-8 space-y-6'>
        <header className='space-y-2'>
          <h1 className='text-3xl font-bold text-gray-900'>Token Counter</h1>
          <p className='text-gray-600'>Count tokens for any text using the pure JavaScript gpt-tokenizer build with layered CDN fallbacks.</p>
          <p className='text-sm text-gray-500'>{status}</p>
        </header>

        {mainVisible ? (
          <>
            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
              <div className='flex flex-wrap gap-2'>
                <button
                  type='button'
                  className='bg-black text-white rounded-lg px-3 py-2 text-sm hover:bg-gray-800 focus:ring-2 focus:ring-black disabled:opacity-60'
                  onClick={handleCopyJson}
                  disabled={!tokens.length}
                >
                  {copyLabel}
                </button>
                <button
                  type='button'
                  className='bg-white border-2 border-black text-black rounded-lg px-3 py-2 text-sm hover:bg-gray-100'
                  onClick={handleRunTests}
                >
                  Run tests
                </button>
              </div>
              {libInfo ? <div className='text-sm text-gray-500 text-left md:text-right'>{libInfo}</div> : null}
            </div>

            <div className='flex flex-wrap gap-2 border-b border-gray-200 pb-4'>
              {MODEL_OPTIONS.map((option) => {
                const active = option.id === selectedModel
                return (
                  <button
                    key={option.id}
                    type='button'
                    className={`px-3 py-2 text-sm font-medium rounded-lg border-b-2 ${active ? 'text-black border-black' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                    onClick={() => handleModelChange(option.id)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Type or paste text here… (auto-saved locally)'
              className='w-full min-h-[180px] bg-white border-2 border-black rounded-lg px-4 py-3 focus:outline-none focus:ring-0'
            />

            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <button
                type='button'
                onClick={clearInput}
                className='bg-white border-2 border-black text-black rounded-lg px-4 py-2 text-sm hover:bg-gray-100'
              >
                Clear
              </button>
              <div className='flex gap-8 sm:gap-12 text-right'>
                <div>
                  <div className='text-3xl font-bold text-gray-900'>{tokenCount}</div>
                  <p className='text-sm text-gray-500'>Tokens</p>
                </div>
                <div>
                  <div className='text-3xl font-bold text-gray-900'>{charCount}</div>
                  <p className='text-sm text-gray-500'>Characters</p>
                </div>
              </div>
            </div>

            <div className='min-h-[120px] bg-gray-50 border-2 border-black rounded-lg p-4'>
              {tokenSegments.length ? (
                <div className='flex flex-wrap gap-2'>
                  {tokenSegments.map((segment, index) => (
                    <span
                      key={`${segment.id}-${index}`}
                      className={`px-2 py-1 rounded-md text-sm font-mono whitespace-pre-wrap ${TOKEN_SWATCHES[index % TOKEN_SWATCHES.length]}`}
                    >
                      {segment.text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className='text-sm text-gray-500'>Tokenized output will appear here.</p>
              )}
            </div>

            {testsVisible ? (
              <section className='bg-gray-50 border-2 border-black rounded-lg'>
                <header className='flex items-center justify-between border-b-2 border-black px-4 py-3'>
                  <h2 className='text-base font-semibold text-gray-900'>Test Suite</h2>
                  <span className='text-sm text-gray-600'>{testSummary}</span>
                </header>
                <div className='p-4 space-y-1 text-sm font-mono text-gray-800'>
                  {testLines.map((line, index) => {
                    if (line.type === 'header') {
                      return (
                        <div key={`header-${index}`} className='mt-3 text-gray-700 font-semibold'>
                          {line.text}
                        </div>
                      )
                    }
                    return (
                      <div
                        key={`case-${index}`}
                        className={line.ok ? 'text-gray-800' : 'text-gray-500'}
                      >
                        {`${line.ok ? '✔' : '✘'} ${line.text}`}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <p className='text-xs text-gray-500'>
              Tip: set <code className='font-mono'>window.GPT_TOKENIZER_URL</code> before the page loads to force a specific CDN URL.
            </p>
          </>
        ) : loadError ? (
          <div className='bg-gray-50 border-2 border-black rounded-lg p-4 space-y-2'>
            <p className='text-sm font-semibold text-gray-900'>Failed to load the tokenizer module.</p>
            <p className='text-sm text-gray-600'>Check your connection or provide a custom CDN URL.</p>
            <ul className='text-sm text-gray-600 list-disc pl-5 space-y-1'>
              <li>Ensure <code className='font-mono'>import()</code> is allowed by your Content Security Policy.</li>
              <li>Set <code className='font-mono'>window.GPT_TOKENIZER_URL = "https://cdn.jsdelivr.net/npm/gpt-tokenizer@2.6.1/+esm"</code> before loading the app.</li>
              <li>Self-host the ESM bundle of <code className='font-mono'>gpt-tokenizer</code> and point the override to it.</li>
            </ul>
            <p className='text-xs text-gray-500 break-all'>{loadError}</p>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center min-h-[180px] gap-3 text-center'>
            <div className='w-10 h-10 rounded-full border-4 border-gray-300 border-t-black animate-spin' />
            <p className='text-sm text-gray-600'>Loading the pure JavaScript tokenizer…</p>
            <p className='text-xs text-gray-500'>No WASM dependency required. If this takes a while, check your network connection.</p>
          </div>
        )}
      </div>
    </div>
  )
}
