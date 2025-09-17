import React, { useMemo, useState } from 'react'

const samples = {
  flowchart: `flowchart TD
  A[Start] --> B{Is it valid?}
  B -- Yes --> C[Great]
  B -- No --> D[Fix it]
  D --> B
  C --> E[End]
`,
  sequence: `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: Hello Bob, how are you?
  Bob-->>Alice: I am good thanks!
`,
}

export default function MermaidValidator() {
  const [input, setInput] = useState(samples.flowchart)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [importError, setImportError] = useState('')

  const starters = useMemo(() => [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram',
    'gantt', 'pie', 'journey', 'mindmap', 'timeline', 'gitGraph', 'quadrantChart', 'xychart-beta',
  ], [])

  const lightweightValidate = (text) => {
    const first = String(text || '').trim().split('\n').find(l => l.trim().length)?.trim() || ''
    const ok = starters.some(k => first.startsWith(k))
    if (!ok) {
      return {
        valid: false,
        error: 'Does not look like a Mermaid definition. Start with a diagram keyword (e.g., "flowchart" or "graph").',
        fallback: true,
      }
    }
    return {
      valid: true,
      warning: 'Lightweight check only (mermaid package not installed).',
      fallback: true,
    }
  }

  const loadMermaid = async () => {
    let lastErr = null
    // 1) Try local ESM import (installed dependency)
    try {
      const mod = await (0, eval)('import("mermaid")')
      return mod?.default || mod
    } catch (e1) {
      lastErr = e1
    }
    // 2) Try CDN UMD build and read from window.mermaid
    try {
      if (typeof window !== 'undefined') {
        if (window.mermaid) return window.mermaid
        const tryLoad = (src) => new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = src
          s.async = true
          s.onload = () => resolve(window.mermaid)
          s.onerror = () => reject(new Error('Failed to load ' + src))
          document.head.appendChild(s)
        })
        // Prefer a stable major
        const cdnUrls = [
          'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
          'https://unpkg.com/mermaid@10/dist/mermaid.min.js',
        ]
        for (const url of cdnUrls) {
          try {
            const m = await tryLoad(url)
            if (m) return m
          } catch (e) {
            lastErr = e
          }
        }
      }
    } catch (e2) {
      lastErr = e2
    }
    throw lastErr || new Error('Unable to load Mermaid')
  }

  const handleValidate = async () => {
    const text = String(input || '').trim()
    setStatus('')
    setResult(null)
    setImportError('')
    if (!text) {
      setStatus('Enter a Mermaid diagram to validate.')
      return
    }
    setIsLoading(true)
    try {
      // Load Mermaid locally or via CDN as fallback
      let mermaid
      let lastErr = null
      try {
        mermaid = await loadMermaid()
      } catch (e) {
        lastErr = e
        mermaid = null
      }

      if (!mermaid) {
        setResult({ ...lightweightValidate(text), warning: 'Mermaid could not be loaded. Using lightweight checks.' })
        if (lastErr) setImportError(String(lastErr?.message || lastErr))
        return
      }

      // Initialize safely when available
      try {
        if (mermaid?.initialize) mermaid.initialize({ startOnLoad: false })
      } catch (e) {
        // non-fatal for validation; continue
      }

      // Prefer mermaid.parse if available
      try {
        if (typeof mermaid.parse === 'function') {
          const maybe = mermaid.parse(text)
          if (maybe && typeof maybe.then === 'function') await maybe
          setResult({ valid: true })
          setStatus('')
          return
        }
      } catch (e) {
        setResult({ valid: false, error: e?.message || String(e) })
        return
      }

      // Fallback to mermaidAPI.parse
      try {
        if (mermaid?.mermaidAPI?.parse) {
          mermaid.mermaidAPI.parse(text)
          setResult({ valid: true })
          setStatus('')
          return
        }
      } catch (e) {
        setResult({ valid: false, error: e?.message || String(e) })
        return
      }

      // If we got here, mermaid is present but no parser exposed
      setResult({ ...lightweightValidate(text), warning: 'Mermaid loaded without a parser API. Using lightweight checks.' })
    } finally {
      setIsLoading(false)
    }
  }

  const setExample = (key) => {
    setInput(samples[key] || '')
    setStatus('Loaded example')
    setResult(null)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white border-2 border-black rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Mermaid Validator</h1>
        </div>

        <p className="text-gray-600 mb-4">Paste a Mermaid diagram definition and validate its syntax. Uses the Mermaid parser when available; otherwise performs lightweight checks.</p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className="bg-black text-white rounded-lg px-3 py-1 hover:bg-gray-800 focus:ring-2 focus:ring-black"
            onClick={handleValidate}
            disabled={isLoading}
          >
            {isLoading ? 'Validating…' : 'Validate'}
          </button>
          <button
            type="button"
            className="bg-white border-2 border-black text-black rounded-lg px-3 py-1 hover:bg-gray-100"
            onClick={() => setExample('flowchart')}
          >
            Load flowchart example
          </button>
          <button
            type="button"
            className="bg-white border-2 border-black text-black rounded-lg px-3 py-1 hover:bg-gray-100"
            onClick={() => setExample('sequence')}
          >
            Load sequence example
          </button>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'Enter mermaid definition, e.g.\nflowchart TD\n  A --> B'}
          rows={12}
          className="w-full bg-white border-2 border-black rounded-lg p-3 font-mono text-sm outline-none focus:ring-0"
        />

        {status && (
          <div className="mt-3 text-sm text-gray-700">{status}</div>
        )}

        {result && (
          <div className="mt-4 bg-white border-2 border-black rounded-lg p-3">
            {result.valid ? (
              <div>
                <p className="font-semibold">Valid diagram</p>
                {result.warning && (
                  <p className="text-gray-600 text-sm mt-1">{result.warning}</p>
                )}
              </div>
            ) : (
              <div>
                <p className="font-semibold">Invalid diagram</p>
                {result.error && (
                  <pre className="mt-2 text-sm whitespace-pre-wrap text-gray-700">{result.error}</pre>
                )}
                {result.warning && (
                  <p className="text-gray-600 text-sm mt-2">{result.warning}</p>
                )}
              </div>
            )}
            {importError && (
              <details className="mt-3 text-gray-600 text-sm">
                <summary className="cursor-pointer">Import error details</summary>
                <pre className="mt-2 whitespace-pre-wrap">{importError}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
