import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconBlockquote,
  IconCode,
  IconLink,
  IconSeparator,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPlus,
  IconUpload,
  IconHistory,
  IconX,
  IconFileArrowRight,
  IconCopy,
  IconTrash,
  IconDownload,
} from '@tabler/icons-react'
import { IconEye, IconPencil, IconTextWrap, IconTextWrapDisabled } from '@tabler/icons-react'
import { marked } from 'marked'
import MarkdownEditor from './MarkdownEditor'
// Configure GitHub Flavored Markdown with soft line breaks
marked.setOptions({ gfm: true, breaks: true })

const emptyMarkdown = ''
function Toolbar({ applyWrap, applyLinePrefix, applyBlock, insertLink, insertHr, undo, redo, canUndo, canRedo, undoTitle, redoTitle, isMac }) {
  const baseBtn = 'bg-white border-2 border-black rounded-lg px-2 py-1 text-sm hover:bg-gray-100'
  return (
    <div className='flex-1 mr-2 min-w-0'>
      <div className='w-full flex flex-wrap items-center gap-2 bg-transparent px-0 py-0'>
        <button className={baseBtn} aria-label='Bold' title={isMac ? 'Bold (Cmd+B)' : 'Bold (Ctrl+B)'} onClick={() => applyWrap('**')}>
          <IconBold size={16} />
        </button>
        <button className={baseBtn} aria-label='Italic' title={isMac ? 'Italic (Cmd+I)' : 'Italic (Ctrl+I)'} onClick={() => applyWrap('*')}>
          <IconItalic size={16} />
        </button>
        <button className={baseBtn} aria-label='Inline code' title={isMac ? 'Inline code (Cmd+E) — GFM-friendly backticks' : 'Inline code (Ctrl+E) — GFM-friendly backticks'} onClick={() => applyWrap('`')}>
          <IconCode size={16} />
        </button>
        <button className={baseBtn} aria-label='Strikethrough' title={isMac ? 'Strikethrough (Cmd+Shift+S)' : 'Strikethrough (Ctrl+Shift+S)'} onClick={() => applyWrap('~~')}>
          <IconStrikethrough size={16} />
        </button>
        <button className={baseBtn} aria-label='Heading 1' title={isMac ? 'Heading 1 (Cmd+Opt+1)' : 'Heading 1 (Ctrl+Alt+1)'} onClick={() => applyLinePrefix('# ')}>
          <IconH1 size={16} />
        </button>
        <button className={baseBtn} aria-label='Heading 2' title={isMac ? 'Heading 2 (Cmd+Opt+2)' : 'Heading 2 (Ctrl+Alt+2)'} onClick={() => applyLinePrefix('## ')}>
          <IconH2 size={16} />
        </button>
        <button className={baseBtn} aria-label='Heading 3' title={isMac ? 'Heading 3 (Cmd+Opt+3)' : 'Heading 3 (Ctrl+Alt+3)'} onClick={() => applyLinePrefix('### ')}>
          <IconH3 size={16} />
        </button>
        <button className={baseBtn} aria-label='Bulleted list' title={isMac ? 'Bulleted list (Cmd+Shift+8)' : 'Bulleted list (Ctrl+Shift+8)'} onClick={() => applyLinePrefix('- ')}>
          <IconList size={16} />
        </button>
        <button className={baseBtn} aria-label='Numbered list' title={isMac ? 'Numbered list (Cmd+Shift+7)' : 'Numbered list (Ctrl+Shift+7)'} onClick={() => applyLinePrefix('1. ')}>
          <IconListNumbers size={16} />
        </button>
        <button className={baseBtn} aria-label='Quote' title={isMac ? 'Quote (Cmd+Shift+Q)' : 'Quote (Ctrl+Shift+Q)'} onClick={() => applyLinePrefix('> ')}>
          <IconBlockquote size={16} />
        </button>
        <button className={baseBtn} aria-label='Code block' title={isMac ? 'Code block (Cmd+Shift+C)' : 'Code block (Ctrl+Shift+C)'} onClick={() => applyBlock('```','```')}>
          <IconCode size={16} />
        </button>
        <button className={baseBtn} aria-label='Link' title={isMac ? 'Link (Cmd+K)' : 'Link (Ctrl+K)'} onClick={insertLink}>
          <IconLink size={16} />
        </button>
        <button className={baseBtn} aria-label='Horizontal rule' title={isMac ? 'Horizontal rule (Cmd+Shift+H)' : 'Horizontal rule (Ctrl+Shift+H)'} onClick={insertHr}>
          <IconSeparator size={16} />
        </button>
        <button
          className={`${baseBtn} ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label='Undo'
          title={undoTitle}
          onClick={undo}
          disabled={!canUndo}
        >
          <IconArrowBackUp size={16} />
        </button>
        <button
          className={`${baseBtn} ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label='Redo'
          title={redoTitle}
          onClick={redo}
          disabled={!canRedo}
        >
          <IconArrowForwardUp size={16} />
        </button>
      </div>
    </div>
  )
}

// Basic HTML sanitizer for preview (removes scripts/inline handlers)
function sanitize(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (/^on/i.test(attr.name) || attr.name === 'srcdoc') el.removeAttribute(attr.name)
      if (attr.name === 'href' || attr.name === 'src') {
        const val = el.getAttribute(attr.name) || ''
        if (/^\s*javascript:/i.test(val)) el.removeAttribute(attr.name)
      }
    })
  })
  return doc.body.innerHTML
}

export default function Notable() {
  const [notes, setNotes] = useState(() => {
    const stored = localStorage.getItem('notable:notes')
    if (stored) return JSON.parse(stored)
    const id = crypto.randomUUID()
    const initial = [{ id, title: 'Untitled', content: emptyMarkdown, updated: Date.now() }]
    localStorage.setItem('notable:notes', JSON.stringify(initial))
    return initial
  })
  const [currentId, setCurrentId] = useState(notes[0].id)
  const [filter, setFilter] = useState('')
  const fileRef = useRef(null)
  const notesDialogRef = useRef(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleInputRef = useRef(null)
  const [mdMode, setMdMode] = useState(true)
  const [mdText, setMdText] = useState('')
  const [wrap, setWrap] = useState(false)
  const historyRef = useRef({ stack: [], index: -1, lastTime: 0 })
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const editorRef = useRef(null)
  const isMac = React.useMemo(() => {
    if (typeof navigator === 'undefined') return false
    const p = navigator.platform || ''
    const ua = navigator.userAgent || ''
    return /Mac|iPhone|iPad|iPod/i.test(p) || /Macintosh|iPhone|iPad|iPod/i.test(ua)
  }, [])
  const undoTitle = isMac ? 'Undo (Cmd+Z)' : 'Undo (Ctrl+Z)'
  const redoTitle = isMac ? 'Redo (Cmd+Shift+Z)' : 'Redo (Ctrl+Y)'

  const currentNote = notes.find((n) => n.id === currentId)

  const persist = (fn) => {
    setNotes((prev) => {
      const next = fn(prev)
      localStorage.setItem('notable:notes', JSON.stringify(next))
      return next
    })
  }

  const updateContent = useCallback((markdown) => {
    persist((prev) => prev.map((n) => (n.id === currentId ? { ...n, content: markdown, updated: Date.now() } : n)))
  }, [currentId])

  const updateTitle = (title) => {
    persist((prev) => prev.map((n) => (n.id === currentId ? { ...n, title } : n)))
  }

  const createNote = () => {
    const id = crypto.randomUUID()
    const note = { id, title: 'Untitled', content: emptyMarkdown, updated: Date.now() }
    persist((prev) => [...prev, note])
    setCurrentId(id)
  }

  const duplicateNote = (id) => {
    const src = notes.find((n) => n.id === id)
    if (!src) return
    const newId = crypto.randomUUID()
    const dup = { ...src, id: newId, title: src.title + ' copy', updated: Date.now() }
    persist((prev) => [...prev, dup])
    setCurrentId(newId)
  }

  const deleteNote = (id) => {
    persist((prev) => {
      let list = prev.filter((n) => n.id !== id)
      if (!list.length) {
        const newId = crypto.randomUUID()
        const note = { id: newId, title: 'Untitled', content: JSON.stringify(emptyState), updated: Date.now() }
        list = [note]
        setCurrentId(newId)
      } else if (currentId === id) {
        setCurrentId(list[0].id)
      }
      return list
    })
  }

  const exportNote = () => {
    if (!currentNote) return
    const blob = new Blob([JSON.stringify(currentNote)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${currentNote.title || 'note'}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(notes)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'notable-notes.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportMarkdown = () => {
    const blob = new Blob([mdText], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${currentNote?.title || 'note'}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    file.text().then((text) => {
      try {
        const data = JSON.parse(text)
        const incoming = Array.isArray(data) ? data : [data]
        let lastAddedId = null
        persist((prev) => {
          const ids = new Set(prev.map((n) => n.id))
          const merged = [...prev]
          incoming.forEach((n) => {
            let id = n.id
            while (ids.has(id)) id = crypto.randomUUID()
            ids.add(id)
            merged.push({ ...n, id })
            lastAddedId = id
          })
          return merged
        })
        if (lastAddedId) setCurrentId(lastAddedId)
      } catch (err) {
        console.error(err)
      }
    })
    e.target.value = ''
  }

  const htmlPreview = useMemo(() => {
    const raw = marked.parse(mdText || '')
    return sanitize(String(raw))
  }, [mdText])

  const filtered = notes.filter((n) => n.title.toLowerCase().includes(filter.toLowerCase()))

  React.useEffect(() => {
    setIsEditingTitle(false)
  }, [currentId])

  // CodeMirror handles sizing internally; no textarea autoresize needed

  React.useEffect(() => {
    if (isEditingTitle) {
      const t = setTimeout(() => titleInputRef.current && titleInputRef.current.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [isEditingTitle])

  // Load note content into editor when switching
  React.useEffect(() => {
    const content = typeof currentNote?.content === 'string' ? currentNote.content : emptyMarkdown
    setMdText(content)
    // reset history for this note
    historyRef.current = { stack: [content], index: 0, lastTime: Date.now() }
    setCanUndo(false)
    setCanRedo(false)
  }, [currentId])

  const pushHistory = (value, { coalesce = false } = {}) => {
    const now = Date.now()
    const h = historyRef.current
    const current = h.stack[h.index]
    if (current === value) return
    if (coalesce && now - h.lastTime < 500 && h.index >= 0) {
      // replace current entry
      h.stack[h.index] = value
    } else {
      // truncate future and push
      if (h.index < h.stack.length - 1) h.stack = h.stack.slice(0, h.index + 1)
      h.stack.push(value)
      h.index++
    }
    h.lastTime = now
    setCanUndo(h.index > 0)
    setCanRedo(h.index < h.stack.length - 1)
  }

  const onMarkdownChange = (value, opts = {}) => {
    setMdText(value)
    updateContent(value)
    pushHistory(value, opts)
  }

  // Editor commands are handled via CodeMirror keymaps inside MarkdownEditor

  // Text manipulation helpers
  const applyWrap = (left, right = left) => editorRef.current && editorRef.current.wrap(left, right)

  const applyLinePrefix = (prefix) => editorRef.current && editorRef.current.linePrefix(prefix)

  const applyBlock = (open, close) => editorRef.current && editorRef.current.block(open, close)

  const insertLink = () => editorRef.current && editorRef.current.insertLink()

  const insertHr = () => editorRef.current && editorRef.current.insertHr()

  const undo = () => {
    const h = historyRef.current
    if (h.index <= 0) return
    h.index -= 1
    const value = h.stack[h.index]
    setMdText(value)
    updateContent(value)
    setCanUndo(h.index > 0)
    setCanRedo(h.index < h.stack.length - 1)
    requestAnimationFrame(() => { editorRef.current && editorRef.current.focusEnd() })
  }

  const redo = () => {
    const h = historyRef.current
    if (h.index >= h.stack.length - 1) return
    h.index += 1
    const value = h.stack[h.index]
    setMdText(value)
    updateContent(value)
    setCanUndo(h.index > 0)
    setCanRedo(h.index < h.stack.length - 1)
    requestAnimationFrame(() => { editorRef.current && editorRef.current.focusEnd() })
  }

  // After toggling back to Edit, focus editor and place caret at end
  React.useEffect(() => {
    if (mdMode) {
      requestAnimationFrame(() => { editorRef.current && editorRef.current.focusEnd() })
    }
  }, [mdMode])

  // Global shortcut: Ctrl/Cmd+Shift+P toggles Edit/Preview
  React.useEffect(() => {
    const onKey = (e) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.shiftKey && e.key && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setMdMode((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className='flex flex-col min-h-[calc(100vh-88px)] bg-gray-50'>
      <main className='flex-1 flex flex-col'>
        {/* Remount the editor when switching notes to reinitialize state */}
        {/* Markdown-only editor with preview toggle */}

          <header className='w-full border-b-2 border-transparent'>
            <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2'>
              <h1 className='sr-only'>Notable</h1>
              <div className='flex items-center gap-3'>
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    id='note-title'
                    className='bg-white border-2 border-black rounded-lg px-3 py-2 text-2xl font-semibold flex-1 min-w-0'
                    value={currentNote?.title || ''}
                    onChange={(e) => updateTitle(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setIsEditingTitle(false)
                      }
                    }}
                    aria-label='Note title'
                  />
                ) : (
                  <h2
                    className='text-2xl font-semibold cursor-text flex-1 min-w-0 truncate'
                    onClick={() => setIsEditingTitle(true)}
                    title='Click to edit title'
                  >
                    {currentNote?.title || 'Untitled'}
                  </h2>
                )}
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    className='bg-black text-white rounded-lg hover:bg-gray-800 w-9 h-9 flex items-center justify-center'
                    aria-label='New note'
                    title='New note'
                    onClick={createNote}
                  >
                    <IconPlus size={18} />
                  </button>
                  <button
                    type='button'
                    className='bg-white border-2 border-black text-black rounded-lg hover:bg-gray-100 w-9 h-9 flex items-center justify-center'
                    aria-label='Import notes'
                    title='Import notes'
                    onClick={() => fileRef.current && fileRef.current.click()}
                  >
                    <IconUpload size={18} />
                  </button>
                  <input ref={fileRef} type='file' accept='application/json' onChange={onImport} className='hidden' />
                  <button
                    type='button'
                    className='bg-white border-2 border-black text-black rounded-lg hover:bg-gray-100 w-9 h-9 flex items-center justify-center'
                    aria-label='Export Markdown'
                    title='Export Markdown'
                    onClick={exportMarkdown}
                  >
                    <IconDownload size={16} />
                  </button>
                  <button
                    type='button'
                    className='bg-white border-2 border-black text-black rounded-lg hover:bg-gray-100 w-9 h-9 flex items-center justify-center'
                    aria-label='History'
                    title='History'
                    onClick={() => notesDialogRef.current && notesDialogRef.current.showModal()}
                  >
                    <IconHistory size={16} />
                  </button>
                </div>
              </div>
              <div className='mt-3 flex items-center justify-between gap-3'>
                <Toolbar
                  applyWrap={applyWrap}
                  applyLinePrefix={applyLinePrefix}
                  applyBlock={applyBlock}
                  insertLink={insertLink}
                  insertHr={insertHr}
                  undo={undo}
                  redo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  undoTitle={undoTitle}
                  redoTitle={redoTitle}
                  isMac={isMac}
                />
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    className='bg-white border-2 border-black text-black rounded-lg hover:bg-gray-100 px-2 py-1 text-sm flex items-center justify-center shrink-0'
                    aria-pressed={wrap}
                    aria-label='Toggle line wrap'
                    title={wrap ? 'Disable line wrap' : 'Enable line wrap'}
                    onClick={() => setWrap((v) => !v)}
                  >
                    {wrap ? <IconTextWrap size={16} /> : <IconTextWrapDisabled size={16} />}
                  </button>
                  <button
                  type='button'
                  className='bg-white border-2 border-black text-black rounded-lg hover:bg-gray-100 px-2 py-1 text-sm flex items-center justify-center shrink-0'
                  aria-label={mdMode ? 'Preview' : 'Edit'}
                  title={mdMode ? (isMac ? 'Preview (Cmd+Shift+P)' : 'Preview (Ctrl+Shift+P)') : (isMac ? 'Edit (Cmd+Shift+P)' : 'Edit (Ctrl+Shift+P)')}
                  onClick={() => setMdMode((v) => !v)}
                >
                  {mdMode ? <IconEye size={16} /> : <IconPencil size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <section className='flex-1 relative'>
            <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4'>
              <div className='relative mt-1 bg-white border-2 border-black rounded-xl shadow-md p-4 notable-editor'>
                {mdMode ? (
                  <MarkdownEditor
                    ref={editorRef}
                    className='w-full'
                    value={mdText}
                    onChange={(val, opts) => onMarkdownChange(val, opts)}
                    wrap={wrap}
                    placeholder='Write Markdown here...'
                    aria-label='Markdown editor'
                  />
                ) : (
                  <article className='markdown-preview min-h-[60vh]'>
                    <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                  </article>
                )}
              </div>
            </div>
          </section>
      </main>

      <dialog ref={notesDialogRef} className='rounded-xl border-2 border-black p-0 w-[92vw] max-w-2xl bg-white text-black'>
        <form method='dialog'>
          <div className='border-b-2 border-black px-4 py-2 flex items-center justify-between'>
            <strong>History</strong>
            <button className='bg-white border-2 border-black rounded-lg p-1 hover:bg-gray-100 w-9 h-9 flex items-center justify-center' aria-label='Close'>
              <IconX size={16} />
            </button>
          </div>
        </form>
        <div className='p-4 max-h-[70vh] overflow-auto'>
          <div className='flex gap-2 mb-3'>
            <button
              className='bg-white border-2 border-black rounded-lg hover:bg-gray-100 ml-auto w-9 h-9 flex items-center justify-center'
              aria-label='Export all notes'
              title='Export all notes'
              onClick={exportAll}
            >
              <IconFileArrowRight size={16} />
            </button>
          </div>
          <input
            className='mb-3 bg-white border-2 border-black rounded-lg px-3 py-2 text-sm w-full'
            placeholder='Search notes...'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className='flex flex-col gap-2'>
            {filtered.map((note) => (
              <li
                key={note.id}
                className={`flex items-center gap-2 p-2 border-2 rounded-lg ${note.id === currentId ? 'bg-gray-100' : 'bg-white'} border-black`}
              >
                <button
                  onClick={() => {
                    setCurrentId(note.id)
                    notesDialogRef.current && notesDialogRef.current.close()
                  }}
                  className='flex-1 text-left overflow-hidden'
                >
                  <div className='font-semibold truncate'>{note.title}</div>
                  <div className='text-xs text-gray-600'>{new Date(note.updated).toLocaleString()}</div>
                </button>
                <button
                  className='bg-white border-2 border-black rounded-lg hover:bg-gray-100 w-8 h-8 flex items-center justify-center'
                  aria-label='Duplicate note'
                  title='Duplicate note'
                  onClick={() => duplicateNote(note.id)}
                >
                  <IconCopy size={14} />
                </button>
                <button
                  className='bg-white border-2 border-black rounded-lg hover:bg-gray-100 w-8 h-8 flex items-center justify-center'
                  aria-label='Delete note'
                  title='Delete note'
                  onClick={() => deleteNote(note.id)}
                >
                  <IconTrash size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  )
}
