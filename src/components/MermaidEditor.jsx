import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import {
  IconSparkles,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconRotateClockwise,
} from '@tabler/icons-react'
import { getApiKey } from '../lib/config.js'

const extractMermaidCode = (value = '') => {
  const text = value.trim()
  const codeBlock = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)
  if (codeBlock && codeBlock[1]) {
    return codeBlock[1].trim()
  }
  return text
}

const defaultCode = `flowchart TD
    A[Start] --> B{Have question?}
    B -- Yes --> C[Search answer]
    C --> D[Find solution]
    D --> E[Share learnings]
    B -- No --> E
`

const fetchWithBackoff = async (url, options, retries = 3) => {
  let delay = 800
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      if (attempt === retries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }
  }
  return null
}

export default function MermaidEditor() {
  const [code, setCode] = useState(defaultCode)
  const [renderError, setRenderError] = useState('')
  const [prompt, setPrompt] = useState('Create a flowchart that explains how a pull request gets merged')
  const [aiError, setAiError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [hasKey, setHasKey] = useState(!!getApiKey())
  const [shouldCenter, setShouldCenter] = useState(false)

  const contentRef = useRef(null)
  const previewRef = useRef(null)
  const viewportRef = useRef(null)
  const aiDialogRef = useRef(null)
  const hasAutoCentered = useRef(false)

  useEffect(() => {
    const onCfg = () => setHasKey(!!getApiKey())
    window.addEventListener('ai-toolbox:config-updated', onCfg)
    return () => window.removeEventListener('ai-toolbox:config-updated', onCfg)
  }, [])

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'neutral',
      flowchart: {
        curve: 'linear',
        nodeSpacing: 80,
        rankSpacing: 120,
      },
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      if (!previewRef.current) return
      try {
        // eslint-disable-next-line no-console
        console.log('Rendering mermaid diagram', code)
        const id = `mermaid-editor`
        const { svg } = await mermaid.render(id, code)
        if (/Syntax error/i.test(svg)) {
          throw new Error('Mermaid could not parse the diagram')
        }
        if (!cancelled && previewRef.current) {
          previewRef.current.innerHTML = svg
          setRenderError('')
          if (!hasAutoCentered.current) {
            hasAutoCentered.current = true
            setShouldCenter(true)
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (previewRef.current) previewRef.current.innerHTML = ''
          // eslint-disable-next-line no-console
          console.error('Mermaid render error', error?.message, error?.stack)
          setRenderError(error?.message || 'Unable to render the diagram')
        }
      }
    }
    draw()
    return () => {
      cancelled = true
    }
  }, [code])

  const handleCodeChange = useCallback((event) => {
    const nextValue = event.target.value
    const trimmed = nextValue.trim()
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
      setCode(extractMermaidCode(nextValue))
      return
    }
    setCode(nextValue)
  }, [])

  const zoomAtPoint = useCallback(
    (nextScale, originX, originY) => {
      setPosition((prevPosition) => {
        const worldX = (originX - prevPosition.x) / scale
        const worldY = (originY - prevPosition.y) / scale
        const nextX = originX - worldX * nextScale
        const nextY = originY - worldY * nextScale
        return { x: nextX, y: nextY }
      })
      setScale(nextScale)
      setShouldCenter(false)
    },
    [scale],
  )

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!viewportRef.current) return
      const rect = viewportRef.current.getBoundingClientRect()
      const zoomStep = 0.1
      const nextScale = event.deltaY < 0 ? Math.min(scale * (1 + zoomStep), 8) : Math.max(scale * (1 - zoomStep), 0.2)
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      zoomAtPoint(nextScale, mouseX, mouseY)
    },
    [scale, zoomAtPoint],
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const listener = (event) => handleWheel(event)
    viewport.addEventListener('wheel', listener, { passive: false })
    return () => viewport.removeEventListener('wheel', listener)
  }, [handleWheel])

  const handleMouseDown = useCallback(
    (event) => {
      event.preventDefault()
      setIsPanning(true)
      setStartPan({ x: event.clientX - position.x, y: event.clientY - position.y })
      event.currentTarget.style.cursor = 'grabbing'
      setShouldCenter(false)
    },
    [position],
  )

  const handleMouseMove = useCallback(
    (event) => {
      if (!isPanning) return
      event.preventDefault()
      const x = event.clientX - startPan.x
      const y = event.clientY - startPan.y
      setPosition({ x, y })
    },
    [isPanning, startPan],
  )

  const handleMouseUpOrLeave = useCallback(
    (event) => {
      if (!isPanning) return
      event.preventDefault()
      setIsPanning(false)
      event.currentTarget.style.cursor = 'grab'
    },
    [isPanning],
  )

  const handleZoomIn = () => {
    if (!viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    const nextScale = Math.min(scale * 1.25, 8)
    zoomAtPoint(nextScale, rect.width / 2, rect.height / 2)
  }

  const handleZoomOut = () => {
    if (!viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    const nextScale = Math.max(scale / 1.25, 0.2)
    zoomAtPoint(nextScale, rect.width / 2, rect.height / 2)
  }

  const handleResetView = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setShouldCenter(true)
  }

  const centerDiagram = useCallback(() => {
    if (!viewportRef.current || !previewRef.current) return
    const svg = previewRef.current.querySelector('svg')
    if (!svg) return
    let diagramWidth = 0
    let diagramHeight = 0
    try {
      const bbox = svg.getBBox()
      diagramWidth = bbox.width
      diagramHeight = bbox.height
    } catch (error) {
      const rect = svg.getBoundingClientRect()
      diagramWidth = rect.width
      diagramHeight = rect.height
    }
    if (!diagramWidth || !diagramHeight) return
    const viewportRect = viewportRef.current.getBoundingClientRect()
    const nextX = (viewportRect.width - diagramWidth * scale) / 2
    const nextY = (viewportRect.height - diagramHeight * scale) / 2
    setPosition({ x: nextX, y: nextY })
  }, [scale])

  useLayoutEffect(() => {
    if (!shouldCenter) return
    centerDiagram()
    setShouldCenter(false)
  }, [shouldCenter, centerDiagram])

  const openAiDialog = () => {
    setAiError('')
    aiDialogRef.current?.showModal()
  }

  const closeAiDialog = () => {
    aiDialogRef.current?.close()
    setAiError('')
  }

  const handleGenerateDiagram = useCallback(async () => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setAiError('Add your Gemini API key in Settings before using the assistant.')
      return
    }
    if (!prompt.trim()) {
      setAiError('Describe the diagram you want to generate.')
      return
    }
    setIsGenerating(true)
    setAiError('')
    try {
      const systemPrompt = `You are a compiler that transforms natural-language diagram requests into valid Mermaid v10 code.

Output policy:
- Return Mermaid code ONLY. No prose, no markdown fences, no comments, no explanations.
- Emit a single diagram per request unless the input explicitly asks for multiple; if multiple are requested, output them back-to-back separated by one blank line.

Diagram type selection:
- If the input implies steps/flows: use flowchart (default to flowchart TD).
- If it implies actors exchanging messages: use sequenceDiagram.
- If it describes entities/attributes/relationships: use erDiagram.
- If it is about classes/interfaces/inheritance: use classDiagram.
- If it is about states/transitions: use stateDiagram-v2.
- If it is a schedule with dates/durations: use gantt with dateFormat.
- If it is a customer journey: use journey.
- If it is hierarchical topics: use mindmap.
- If it is chronological points without durations: use timeline.
- When unclear, choose the least-surprising type (prefer flowchart TD) and proceed.

General rules:
- Ensure code is syntactically valid and renderable by Mermaid.
- For flowcharts, include an explicit direction (TD or LR) and standard shapes (rectangles for steps, diamonds for decisions).
- Use deterministic, short, unique IDs (e.g., A, B, C…) and keep human-readable labels in the node text.
- Preserve described order (especially in sequenceDiagram), and use alt/opt/loop/par blocks when the text implies them.
- Group related steps with subgraph when lanes/groups are implied; for sequences, declare explicit participants.
- For erDiagram, declare entities with attributes when provided, and relationships with appropriate crow’s-foot cardinalities and labels.
- For gantt, provide dateFormat, sections, tasks with start and duration or dependencies; mark milestones with milestone.
- If the user provides Mermaid code, validate and return a corrected/normalized version that preserves intent.

Labeling and escaping:
- Keep labels concise; if necessary, wrap lines with <br/>.
- Encode special characters that may break parsing: use &lt; and &gt;, and &#124; for literal pipes in labels.
- If information is missing, make minimal, reasonable assumptions and mark with (unspecified) rather than inventing facts.

Styling and extras:
- Do not include init blocks (%%{init:...}%%) or custom CSS unless explicitly requested.
- Do not include comments (%% ... %%) or external includes.

Failure behavior:
- Never refuse or ask questions; make the best, least-surprising diagram given the input and these rules.`
      const payload = {
        contents: [{ parts: [{ text: prompt.trim() }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
        },
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`
      const result = await fetchWithBackoff(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const parts = result?.candidates?.[0]?.content?.parts || []
      const text = parts.map((part) => part?.text || '').join('\n').trim()
      if (!text) throw new Error('The model returned an empty response.')
      setCode(extractMermaidCode(text))
      closeAiDialog()
    } catch (error) {
      setAiError(error?.message || 'Failed to generate a diagram.')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt])

  return (
    <main className="h-screen w-full px-4 sm:px-6 lg:px-8 py-6 text-black bg-gray-50 flex flex-col overflow-hidden">
      <style>{`.mermaid-preview svg { max-width: 100%; height: auto; }`}</style>
      <header className="py-2 mb-4 shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Mermaid Editor</h1>
          </div>
        </div>
      </header>

      <section className="flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row lg:gap-8">
        <article className="flex flex-col bg-white border-2 border-black rounded-xl shadow-md lg:w-[30%] max-h-full">
          <div className="border-b-2 border-black/10 px-4 py-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Editor</h2>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openAiDialog}
                className="inline-flex items-center justify-center bg-black text-white rounded-lg p-2.5 hover:bg-gray-800 focus:ring-2 focus:ring-black"
                aria-label="Open AI assistant"
              >
                <IconSparkles size={18} stroke={2} />
                <span className="sr-only">Open AI assistant</span>
              </button>
              <button
                type="button"
                onClick={() => setCode(defaultCode)}
                className="inline-flex items-center justify-center bg-white border-2 border-black rounded-lg p-2.5 hover:bg-gray-100"
                aria-label="Reset to sample"
              >
                <IconRotateClockwise size={18} stroke={2} />
                <span className="sr-only">Reset to sample</span>
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            <label htmlFor="mermaid-code" className="sr-only">
              Mermaid code
            </label>
            <textarea
              id="mermaid-code"
              value={code}
              onChange={handleCodeChange}
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              className="flex-1 min-h-0 w-full p-4 font-mono text-sm leading-relaxed bg-white rounded-b-xl focus:outline-none resize-none"
            />
            {renderError && (
              <div className="border-t-2 border-black/10 px-4 py-3 text-sm text-gray-800 bg-gray-50">
                <p className="font-semibold">Syntax error</p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{renderError}</pre>
              </div>
            )}
          </div>
        </article>

        <article className="flex flex-col bg-white border-2 border-black rounded-xl shadow-md flex-1 min-h-0">
          <div className="border-b-2 border-black/10 px-4 py-3 flex items-center gap-2">
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold">Live preview</h2>
              <p className="text-sm text-gray-600">Scroll to zoom, drag to pan.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-lg border-2 border-black text-black hover:bg-gray-100"
                aria-label="Zoom in"
              >
                <IconZoomIn size={18} stroke={2} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-lg border-2 border-black text-black hover:bg-gray-100"
                aria-label="Zoom out"
              >
                <IconZoomOut size={18} stroke={2} />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="p-2 rounded-lg border-2 border-black text-black hover:bg-gray-100"
                aria-label="Reset view"
              >
                <IconZoomReset size={18} stroke={2} />
              </button>
            </div>
          </div>
          <div
            ref={viewportRef}
            className="flex-1 overflow-hidden mermaid-preview p-4 min-h-0"
            style={{
              cursor: isPanning ? 'grabbing' : 'grab',
              backgroundColor: '#fff',
              backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              height: '100%',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
          >
            <div
              ref={contentRef}
              className="inline-block"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                transition: isPanning ? 'none' : 'transform 50ms linear',
              }}
            >
              <div ref={previewRef} className="inline-block" />
            </div>
          </div>
        </article>
      </section>

      <dialog
        ref={aiDialogRef}
        className="rounded-xl border-2 border-black bg-white text-black w-[90vw] max-w-md p-0"
        onClose={() => setAiError('')}
      >
        <form method="dialog" className="flex flex-col">
          <header className="flex items-center justify-between border-b-2 border-black/10 px-4 py-3">
            <div>
              <h2 className="text-xl font-semibold">AI assistant</h2>
              <p className="text-sm text-gray-600">Describe the diagram and Gemini will draft Mermaid code.</p>
            </div>
            <button
              type="button"
              onClick={closeAiDialog}
              className="p-2 rounded-lg border-2 border-black hover:bg-gray-100"
              aria-label="Close dialog"
            >
              <IconX size={18} stroke={2} />
            </button>
          </header>
          <div className="px-4 py-4 flex flex-col gap-3">
            <label htmlFor="diagram-prompt" className="text-sm font-semibold">
              Diagram description
            </label>
            <textarea
              id="diagram-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className="w-full border-2 border-black rounded-lg p-3 text-sm bg-white focus:outline-none"
              placeholder="Explain the flow you want to visualize."
              disabled={isGenerating}
            />
            {!hasKey && (
              <p className="text-sm text-gray-600">
                Add a Gemini API key in the Settings tool to enable AI generation.
              </p>
            )}
            {aiError && (
              <div className="border-2 border-black rounded-lg bg-gray-50 px-3 py-2 text-sm">
                {aiError}
              </div>
            )}
          </div>
          <div className="border-t-2 border-black/10 px-4 py-3 flex items-center justify-between">
            {isGenerating && <p className="text-sm text-gray-600">Generating diagram…</p>}
            <button
              type="button"
              onClick={handleGenerateDiagram}
              disabled={isGenerating || !hasKey}
              className="ml-auto inline-flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <IconSparkles size={18} stroke={2} />
              Insert into editor
            </button>
          </div>
        </form>
      </dialog>
    </main>
  )
}
