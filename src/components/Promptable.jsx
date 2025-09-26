import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconPlus,
  IconCopy,
  IconWand,
  IconX,
  IconDeviceFloppy,
  IconHistory,
  IconArrowsDiff,
  IconPlayerPlay,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import DiffMatchPatch from 'diff-match-patch'
import { getApiKey } from '../lib/config.js'

const STORAGE_KEY = 'promptable:prompts'

const defaultModelOptions = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-exp-1206',
]

const emptyPrompt = () => ({
  id: crypto.randomUUID(),
  title: 'Untitled prompt',
  content: '',
  model: 'gemini-2.5-flash',
  useCase: '',
  updated: Date.now(),
  lastTestedAt: null,
  history: [],
  tests: [],
})

const promptOptimizationSystemInstruction = String.raw`You are a Principal Prompt Engineer specializing in optimizing prompts for the GPT-5 model. Your task is to revise and refine the provided prompt to achieve maximum clarity, efficiency, and compliance.

Return ONLY the optimized version of the prompt. Do not include any explanations, comments, or additional text.

---

### Guiding Principles for Optimization
Strictly adhere to the following principles during your revision process:

1.  **Clarify Role & Goal:** Explicitly and clearly state the model's role (`persona`) and the prompt's primary objective at the outset of the instructions.
2.  **Specify Instructions & Constraints:** Detail all required steps for the model. Define the desired output format, constraints (e.g., length, style, tone), and what to avoid (`negative constraints`).
3.  **Structure & Normalize:** Arrange instructions in a logical sequence. Use delimiters (e.g., `###`, `---`, ```) to separate context, instructions, and input data. Eliminate redundancy and normalize terminology for consistency.
4.  **Provide Examples (If Necessary):** If the original prompt includes examples, ensure they are concise, relevant, and in alignment with the primary instructions. Avoid ambiguous or contradictory examples.
5.  **Integrate Output Schema:** If a `STRUCTURED_OUTPUT_SCHEMA` is provided, concisely integrate instructions for adherence directly into the main prompt without altering the schema's structure.
6.  **Add Guardrails:** Insert simple checks or guardrail instructions (e.g., "Do not include explanations in the output") to ensure the final result conforms to the requested format.

### Constraints and Elements to Preserve
During the optimization process, adhere to the following constraints:

**NEVER:**
* Alter the core objective or scope of the original prompt.
* Add your own comments, metatext, or explanations.
* Remove crucial safety policies or instructions.
* Insert examples that contradict existing instructions.

**ALWAYS RETAIN:**
* **Fundamental Structure:** Preserve the role/section structure (e.g., `System/Developer/User`), delimiters, placeholders (`{...}`, `$…`, `[[...]]`), and existing code/HTML/Markdown formatting.
* **Specific Assets:** Maintain the integrity of domain-specific language, tone, variable names, IDs/UUIDs/tags, and existing API formats or contracts.`

const migratePrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'object') return emptyPrompt()
  return {
    ...emptyPrompt(),
    ...prompt,
    history: Array.isArray(prompt.history) ? prompt.history : [],
    tests: Array.isArray(prompt.tests) ? prompt.tests : [],
  }
}

const diffEngine = new DiffMatchPatch()

const buildDiff = (original, draft) => {
  const diff = diffEngine.diff_main(original || '', draft || '')
  diffEngine.diff_cleanupSemantic(diff)
  return diff
}

const renderDiff = (diff) =>
  diff.map(([op, text], index) => {
    const key = `${op}-${index}`
    const classes =
      op === 1
        ? 'bg-gray-200 text-gray-900 px-1 py-0.5 rounded'
        : op === -1
          ? 'bg-gray-100 line-through text-gray-600 px-1 py-0.5 rounded'
          : 'text-gray-800'
    const segments = text.split('\n')
    return (
      <span key={key} className={`inline ${classes}`}>
        {segments.map((segment, i) => (
          <React.Fragment key={`${key}-${i}`}>
            {segment}
            {i < segments.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </span>
    )
  })

const summarise = (text) => {
  if (!text) return 'Empty prompt'
  const firstLine = text.split('\n').find((line) => line.trim()) || text
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine
}

export default function Promptable() {
  const [prompts, setPrompts] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return [emptyPrompt()]
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed) || !parsed.length) return [emptyPrompt()]
      return parsed.map(migratePrompt)
    } catch (error) {
      console.error('Failed to load stored prompts', error)
      return [emptyPrompt()]
    }
  })
  const [currentId, setCurrentId] = useState(() => prompts[0]?.id)
  const [filter, setFilter] = useState('')
  const [editorState, setEditorState] = useState(() => prompts[0])
  const [isImproving, setIsImproving] = useState(false)
  const [improveError, setImproveError] = useState('')
  const [improvedDraft, setImprovedDraft] = useState('')
  const [diff, setDiff] = useState([])
  const improveDialogRef = useRef(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState(null)
  const [historyDiff, setHistoryDiff] = useState([])
  const [isTesting, setIsTesting] = useState(false)
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState('')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
  }, [prompts])

  useEffect(() => {
    const next = prompts.find((item) => item.id === currentId)
    if (next) {
      setEditorState(next)
    }
  }, [currentId, prompts])

  const persist = (updater) => {
    setPrompts((prev) => {
      const next = updater(prev.map(migratePrompt))
      return next
    })
  }

  const currentPrompt = useMemo(
    () => prompts.find((item) => item.id === currentId) || prompts[0],
    [currentId, prompts],
  )

  const filteredPrompts = useMemo(() => {
    if (!filter.trim()) return prompts
    const q = filter.toLowerCase()
    return prompts.filter((prompt) =>
      prompt.title.toLowerCase().includes(q) || prompt.useCase.toLowerCase().includes(q),
    )
  }, [filter, prompts])

  const updateEditorField = (field, value) => {
    setEditorState((prev) => ({ ...prev, [field]: value }))
  }

  const addSnapshot = (prompt, content) => {
    const entry = {
      id: crypto.randomUUID(),
      content,
      createdAt: Date.now(),
      summary: summarise(content),
    }
    const nextHistory = [entry, ...(prompt.history || [])].slice(0, 20)
    return { ...prompt, history: nextHistory }
  }

  const handleSavePrompt = () => {
    if (!currentPrompt) return
    persist((prev) =>
      prev.map((item) => {
        if (item.id !== currentPrompt.id) return item
        const merged = {
          ...item,
          title: editorState.title,
          content: editorState.content,
          model: editorState.model,
          useCase: editorState.useCase,
          updated: Date.now(),
        }
        return addSnapshot(merged, editorState.content)
      }),
    )
  }

  const createPrompt = () => {
    const prompt = emptyPrompt()
    setPrompts((prev) => {
      const next = [prompt, ...prev]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setCurrentId(prompt.id)
    setEditorState(prompt)
  }

  const duplicatePrompt = (id) => {
    const source = prompts.find((item) => item.id === id)
    if (!source) return
    const dup = {
      ...source,
      id: crypto.randomUUID(),
      title: `${source.title} copy`,
      updated: Date.now(),
      history: [...(source.history || [])],
      tests: [...(source.tests || [])],
    }
    persist((prev) => [dup, ...prev])
    setCurrentId(dup.id)
  }

  const deletePrompt = (id) => {
    if (!window.confirm('Delete this prompt?')) return
    persist((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (!next.length) {
        const fresh = emptyPrompt()
        setCurrentId(fresh.id)
        return [fresh]
      }
      if (currentId === id) {
        setCurrentId(next[0].id)
      }
      return next
    })
  }

  const handleImprovePrompt = async () => {
    setImproveError('')
    if (!currentPrompt) return
    const apiKey = getApiKey()
    if (!apiKey) {
      setImproveError('API key not set. Open Settings to add your Gemini key.')
      return
    }
    setIsImproving(true)
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`
      const payload = {
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: promptOptimizationSystemInstruction,
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Prompt title: ${currentPrompt.title}\nUse case: ${currentPrompt.useCase}\n---\n${editorState.content}`,
              },
            ],
          },
        ],
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        let message = `Request failed ${resp.status}`
        try {
          const err = await resp.json()
          message = err.error?.message || message
        } catch {}
        throw new Error(message)
      }
      const data = await resp.json()
      const candidate = data.candidates?.[0]
      const text = candidate?.content?.parts?.map((part) => part.text).join('').trim()
      if (!text) throw new Error('Gemini response did not include text content.')
      setImprovedDraft(text)
      setDiff(buildDiff(editorState.content, text))
      const dialog = improveDialogRef.current
      if (dialog && !dialog.open) dialog.showModal()
    } catch (error) {
      console.error(error)
      setImproveError(error.message || 'Failed to improve prompt.')
    } finally {
      setIsImproving(false)
    }
  }

  const closeImproveDialog = () => {
    const dialog = improveDialogRef.current
    if (dialog?.open) dialog.close()
    setImprovedDraft('')
    setDiff([])
  }

  const acceptImprovement = () => {
    if (!improvedDraft || !currentPrompt) return
    persist((prev) =>
      prev.map((item) => {
        if (item.id !== currentPrompt.id) return item
        const updatedPrompt = {
          ...item,
          content: improvedDraft,
          updated: Date.now(),
        }
        return addSnapshot(updatedPrompt, improvedDraft)
      }),
    )
    setEditorState((prev) => ({ ...prev, content: improvedDraft }))
    closeImproveDialog()
  }

  const copyImprovedDraft = async () => {
    if (!improvedDraft) return
    try {
      await navigator.clipboard.writeText(improvedDraft)
    } catch (error) {
      console.error('Failed to copy', error)
    }
  }

  const selectHistory = (historyId) => {
    if (!currentPrompt) return
    setSelectedHistoryId(historyId)
    const entry = currentPrompt.history.find((item) => item.id === historyId)
    if (!entry) {
      setHistoryDiff([])
      return
    }
    setHistoryDiff(buildDiff(entry.content, editorState.content))
  }

  const restoreHistory = (historyId) => {
    if (!currentPrompt) return
    const entry = currentPrompt.history.find((item) => item.id === historyId)
    if (!entry) return
    if (!window.confirm('Restore this version? This will replace the current editor content.')) return
    setEditorState((prev) => ({ ...prev, content: entry.content }))
    persist((prev) =>
      prev.map((item) => {
        if (item.id !== currentPrompt.id) return item
        const restored = {
          ...item,
          content: entry.content,
          updated: Date.now(),
        }
        return addSnapshot(restored, entry.content)
      }),
    )
  }

  const handleRunTest = async () => {
    setTestError('')
    setTestOutput('')
    if (!currentPrompt) return
    const apiKey = getApiKey()
    if (!apiKey) {
      setTestError('API key not set. Open Settings to add your Gemini key.')
      return
    }
    if (!testInput.trim()) {
      setTestError('Provide a sample input before running the test.')
      return
    }
    setIsTesting(true)
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentPrompt.model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`
      const payload = {
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: promptOptimizationSystemInstruction,
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `PROMPT:\n${editorState.content}\n\nSAMPLE INPUT:\n${testInput}`,
              },
            ],
          },
        ],
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        let message = `Request failed ${resp.status}`
        try {
          const err = await resp.json()
          message = err.error?.message || message
        } catch {}
        throw new Error(message)
      }
      const data = await resp.json()
      const candidate = data.candidates?.[0]
      const text = candidate?.content?.parts?.map((part) => part.text).join('').trim()
      if (!text) throw new Error('Gemini response did not include text output.')
      setTestOutput(text)
      const testEntry = {
        id: crypto.randomUUID(),
        input: testInput,
        output: text,
        createdAt: Date.now(),
      }
      persist((prev) =>
        prev.map((item) => {
          if (item.id !== currentPrompt.id) return item
          return {
            ...item,
            lastTestedAt: Date.now(),
            tests: [testEntry, ...(item.tests || [])].slice(0, 20),
          }
        }),
      )
    } catch (error) {
      console.error(error)
      setTestError(error.message || 'Failed to run prompt test.')
    } finally {
      setIsTesting(false)
    }
  }

  const copyTestOutput = async () => {
    if (!testOutput) return
    try {
      await navigator.clipboard.writeText(testOutput)
    } catch (error) {
      console.error('Failed to copy test output', error)
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 py-6'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        <div className='bg-white border-2 border-black rounded-xl shadow-md p-6'>
          <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Promptable</h1>
              <p className='text-gray-600 mt-1'>Create, iterate, and test prompts with Gemini-powered previews.</p>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row sm:flex-nowrap'>
              <button
                type='button'
                onClick={createPrompt}
                className='inline-flex items-center gap-2 bg-black text-white rounded-lg px-3 py-2 text-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black'
              >
                <IconPlus size={16} />
                New prompt
              </button>
              <button
                type='button'
                onClick={handleSavePrompt}
                className='inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none'
              >
                <IconDeviceFloppy size={16} />
                Save changes
              </button>
              <button
                type='button'
                onClick={handleImprovePrompt}
                className='inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none'
                disabled={isImproving}
              >
                <IconWand size={16} />
                {isImproving ? 'Improving…' : 'Improve prompt'}
              </button>
            </div>
          </header>

          {improveError ? (
            <p className='mt-4 text-sm text-gray-700'>{improveError}</p>
          ) : null}

          <div className='mt-6 grid gap-6 lg:grid-cols-[260px_1fr]'>
            <aside className='bg-gray-100 border-2 border-black rounded-lg p-4 space-y-4'>
              <div className='relative'>
                <IconSearch size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-600' />
                <input
                  type='search'
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder='Search prompts'
                  className='w-full bg-white border-2 border-black rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none'
                />
              </div>
              <ul className='space-y-2 max-h-[420px] overflow-y-auto pr-1'>
                {filteredPrompts.map((prompt) => (
                  <li key={prompt.id}>
                    <button
                      type='button'
                      onClick={() => setCurrentId(prompt.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border-2 ${prompt.id === currentId ? 'border-black bg-white shadow-sm' : 'border-transparent bg-gray-200 hover:bg-gray-300'}`}
                    >
                      <p className='font-medium text-sm text-gray-900 truncate'>{prompt.title}</p>
                      <p className='text-xs text-gray-700 truncate'>{prompt.useCase || 'No use case'}</p>
                      <div className='mt-1 flex items-center gap-2 text-[11px] text-gray-600'>
                        <span>{prompt.model}</span>
                        {prompt.lastTestedAt ? <span>Tested {new Date(prompt.lastTestedAt).toLocaleString()}</span> : null}
                      </div>
                    </button>
                    <div className='mt-1 flex items-center gap-2'>
                      <button
                        type='button'
                        className='flex-1 bg-white border-2 border-black rounded-lg px-2 py-1 text-xs hover:bg-gray-100'
                        onClick={() => duplicatePrompt(prompt.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        type='button'
                        className='flex-1 bg-white border-2 border-black rounded-lg px-2 py-1 text-xs hover:bg-gray-100'
                        onClick={() => deletePrompt(prompt.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            <main className='space-y-6'>
              <section className='bg-white border-2 border-black rounded-lg p-4 space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-800 mb-1' htmlFor='prompt-title'>Title</label>
                  <input
                    id='prompt-title'
                    type='text'
                    value={editorState?.title || ''}
                    onChange={(event) => updateEditorField('title', event.target.value)}
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none'
                  />
                </div>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div>
                    <label className='block text-sm font-medium text-gray-800 mb-1' htmlFor='prompt-model'>Target model</label>
                    <select
                      id='prompt-model'
                      value={editorState?.model || ''}
                      onChange={(event) => updateEditorField('model', event.target.value)}
                      className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none'
                    >
                      {defaultModelOptions.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-800 mb-1' htmlFor='prompt-usecase'>Use case</label>
                    <input
                      id='prompt-usecase'
                      type='text'
                      value={editorState?.useCase || ''}
                      onChange={(event) => updateEditorField('useCase', event.target.value)}
                      className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-800 mb-1' htmlFor='prompt-content'>Prompt</label>
                  <textarea
                    id='prompt-content'
                    value={editorState?.content || ''}
                    onChange={(event) => updateEditorField('content', event.target.value)}
                    rows={14}
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none leading-relaxed'
                  />
                </div>
              </section>

              <section className='bg-white border-2 border-black rounded-lg p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h2 className='text-lg font-semibold text-gray-900'>History</h2>
                    <p className='text-sm text-gray-600'>Snapshots are created when you save or accept Gemini suggestions.</p>
                  </div>
                  <IconHistory size={20} className='text-gray-700' />
                </div>
                <div className='mt-4 grid gap-4 lg:grid-cols-[220px_1fr]'>
                  <ul className='space-y-2 max-h-64 overflow-y-auto pr-1'>
                    {currentPrompt?.history?.length ? (
                      currentPrompt.history.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type='button'
                            onClick={() => selectHistory(entry.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border-2 ${entry.id === selectedHistoryId ? 'border-black bg-white shadow-sm' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <p className='text-sm font-medium text-gray-900'>{new Date(entry.createdAt).toLocaleString()}</p>
                            <p className='text-xs text-gray-700'>{entry.summary}</p>
                          </button>
                          <button
                            type='button'
                            onClick={() => restoreHistory(entry.id)}
                            className='mt-2 inline-flex items-center gap-2 bg-white border-2 border-black rounded-lg px-2 py-1 text-xs hover:bg-gray-100'
                          >
                            <IconRestore size={14} />
                            Restore
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className='text-sm text-gray-700'>No history yet.</li>
                    )}
                  </ul>
                  <div className='border-2 border-black rounded-lg p-3 bg-gray-50 min-h-[200px]'>
                    <h3 className='text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2'>
                      <IconArrowsDiff size={16} />
                      Differences from current editor
                    </h3>
                    <div className='text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed'>
                      {historyDiff.length ? renderDiff(historyDiff) : 'Select a snapshot to compare with the current content.'}
                    </div>
                  </div>
                </div>
              </section>

              <section className='bg-white border-2 border-black rounded-lg p-4 space-y-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h2 className='text-lg font-semibold text-gray-900'>Test prompt</h2>
                    <p className='text-sm text-gray-600'>Send a sample input through Gemini using the selected model.</p>
                  </div>
                  <IconPlayerPlay size={20} className='text-gray-700' />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-800 mb-1' htmlFor='test-input'>Sample input</label>
                  <textarea
                    id='test-input'
                    value={testInput}
                    onChange={(event) => setTestInput(event.target.value)}
                    rows={6}
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none'
                  />
                </div>
                {testError ? <p className='text-sm text-gray-700'>{testError}</p> : null}
                <div className='flex flex-wrap gap-2'>
                  <button
                    type='button'
                    onClick={handleRunTest}
                    disabled={isTesting}
                    className='inline-flex items-center gap-2 bg-black text-white rounded-lg px-3 py-2 text-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black'
                  >
                    <IconPlayerPlay size={16} />
                    {isTesting ? 'Running…' : 'Run test'}
                  </button>
                  <button
                    type='button'
                    onClick={copyTestOutput}
                    className='inline-flex items-center gap-2 bg-white border-2 border-black text-black rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none'
                  >
                    <IconCopy size={16} />
                    Copy result
                  </button>
                </div>
                <div className='border-2 border-black rounded-lg p-3 bg-gray-50 min-h-[180px] whitespace-pre-wrap text-sm text-gray-900'>
                  {testOutput || 'Test output will appear here after you run Gemini.'}
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-gray-800 mb-2'>Recent test runs</h3>
                  <ul className='space-y-2 max-h-48 overflow-y-auto pr-1 text-sm text-gray-700'>
                    {currentPrompt?.tests?.length ? (
                      currentPrompt.tests.map((item) => (
                        <li key={item.id} className='bg-gray-100 border-2 border-black rounded-lg p-3'>
                          <p className='text-xs text-gray-600 mb-1'>{new Date(item.createdAt).toLocaleString()}</p>
                          <p className='font-medium text-gray-900 mb-1'>Sample input</p>
                          <p className='mb-2 whitespace-pre-wrap'>{item.input}</p>
                          <p className='font-medium text-gray-900 mb-1'>Output</p>
                          <p className='whitespace-pre-wrap'>{item.output}</p>
                        </li>
                      ))
                    ) : (
                      <li className='text-sm text-gray-700'>No tests recorded yet.</li>
                    )}
                  </ul>
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>

      <dialog ref={improveDialogRef} className='rounded-lg border-2 border-black bg-white p-0 max-w-2xl w-full'>
        <form method='dialog'>
          <header className='flex items-center justify-between px-4 py-3 border-b-2 border-black'>
            <h2 className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
              <IconArrowsDiff size={18} />
              Gemini preview
            </h2>
            <button type='button' onClick={closeImproveDialog} className='text-gray-700 hover:text-black'>
              <IconX size={18} />
            </button>
          </header>
          <div className='px-4 py-4 space-y-4'>
            <div className='border-2 border-black rounded-lg p-3 bg-gray-50 max-h-[320px] overflow-y-auto text-sm whitespace-pre-wrap leading-relaxed text-gray-900'>
              {diff.length ? renderDiff(diff) : 'No differences to display.'}
            </div>
            <div className='flex flex-wrap gap-2'>
              <button
                type='button'
                onClick={acceptImprovement}
                className='inline-flex items-center gap-2 bg-black text-white rounded-lg px-3 py-2 text-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black'
              >
                Accept changes
              </button>
              <button
                type='button'
                onClick={copyImprovedDraft}
                className='inline-flex items-center gap-2 bg-white border-2 border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none'
              >
                <IconCopy size={16} />
                Copy preview
              </button>
              <button
                type='button'
                onClick={closeImproveDialog}
                className='inline-flex items-center gap-2 bg-white border-2 border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none'
              >
                Discard
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </div>
  )
}
