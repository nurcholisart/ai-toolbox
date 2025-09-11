import React, { useCallback, useRef, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import {
  ListItemNode,
  ListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list'
import { CodeNode, INSERT_CODE_BLOCK_COMMAND } from '@lexical/code'
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { TRANSFORMERS, $convertToMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'

const emptyState = {
  root: {
    children: [],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
}

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const btn = 'bg-white border-2 border-black rounded-lg px-2 py-1 text-sm hover:bg-gray-100'
  const insertLink = () => {
    const url = window.prompt('Enter URL')
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url || null)
  }
  return (
    <div className='flex flex-wrap gap-2 mb-2'>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>B</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>I</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}>U</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>S</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h1')}>H1</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h2')}>H2</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h3')}>H3</button>
      <button className={btn} onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND)}>• List</button>
      <button className={btn} onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND)}>1. List</button>
      <button className={btn} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'quote')}>Quote</button>
      <button className={btn} onClick={() => editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND)}>Code</button>
      <button className={btn} onClick={insertLink}>Link</button>
      <button className={btn} onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND)}>HR</button>
      <button className={btn} onClick={() => editor.dispatchCommand(UNDO_COMMAND)}>Undo</button>
      <button className={btn} onClick={() => editor.dispatchCommand(REDO_COMMAND)}>Redo</button>
    </div>
  )
}

function AutosavePlugin({ onChange }) {
  const [editor] = useLexicalComposerContext()
  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const json = editorState.toJSON()
      onChange(json)
    })
  }, [editor, onChange])
  return null
}

function LoadPlugin({ content }) {
  const [editor] = useLexicalComposerContext()
  React.useEffect(() => {
    if (content) {
      const state = editor.parseEditorState(content)
      editor.setEditorState(state)
      editor.focus()
    }
  }, [editor, content])
  return null
}

function EditorRefPlugin({ editorRef }) {
  const [editor] = useLexicalComposerContext()
  React.useEffect(() => {
    editorRef.current = editor
  }, [editor, editorRef])
  return null
}

export default function Notable() {
  const [notes, setNotes] = useState(() => {
    const stored = localStorage.getItem('notable:notes')
    if (stored) return JSON.parse(stored)
    const id = crypto.randomUUID()
    const initial = [{ id, title: 'Untitled', content: JSON.stringify(emptyState), updated: Date.now() }]
    localStorage.setItem('notable:notes', JSON.stringify(initial))
    return initial
  })
  const [currentId, setCurrentId] = useState(notes[0].id)
  const [filter, setFilter] = useState('')
  const fileRef = useRef(null)
  const editorRef = useRef(null)

  const currentNote = notes.find((n) => n.id === currentId)

  const persist = (fn) => {
    setNotes((prev) => {
      const next = fn(prev)
      localStorage.setItem('notable:notes', JSON.stringify(next))
      return next
    })
  }

  const updateContent = useCallback(
    (json) => {
      persist((prev) =>
        prev.map((n) => (n.id === currentId ? { ...n, content: JSON.stringify(json), updated: Date.now() } : n)),
      )
    },
    [currentId],
  )

  const updateTitle = (title) => {
    persist((prev) => prev.map((n) => (n.id === currentId ? { ...n, title } : n)))
  }

  const createNote = () => {
    const id = crypto.randomUUID()
    const note = { id, title: 'Untitled', content: JSON.stringify(emptyState), updated: Date.now() }
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
    const editor = editorRef.current
    if (!editor) return
    editor.getEditorState().read(() => {
      const md = $convertToMarkdownString(TRANSFORMERS)
      const blob = new Blob([md], { type: 'text/markdown' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${currentNote?.title || 'note'}.md`
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  const onImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    file.text().then((text) => {
      try {
        const data = JSON.parse(text)
        const incoming = Array.isArray(data) ? data : [data]
        persist((prev) => {
          const ids = new Set(prev.map((n) => n.id))
          const merged = [...prev]
          incoming.forEach((n) => {
            let id = n.id
            while (ids.has(id)) id = crypto.randomUUID()
            ids.add(id)
            merged.push({ ...n, id })
          })
          return merged
        })
      } catch (err) {
        console.error(err)
      }
    })
    e.target.value = ''
  }

  const initialConfig = {
    namespace: 'notable',
    onError: (e) => console.error(e),
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, LinkNode, HorizontalRuleNode],
  }

  const filtered = notes.filter((n) => n.title.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className='flex h-screen bg-gray-50'>
      <div className='w-64 border-r-2 border-black p-4 flex flex-col'>
        <div className='flex gap-2 mb-2'>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={createNote}>New</button>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={() => fileRef.current.click()}>Import</button>
          <input ref={fileRef} type='file' accept='application/json' onChange={onImport} className='hidden' />
        </div>
        <input
          className='mb-2 bg-white border-2 border-black rounded-lg px-2 py-1 text-sm'
          placeholder='Search...'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className='flex-1 overflow-y-auto flex flex-col gap-2'>
          {filtered.map((note) => (
            <li
              key={note.id}
              className={`flex items-center gap-2 p-2 border-2 rounded-lg ${note.id === currentId ? 'bg-gray-100' : 'bg-white'} border-black`}
            >
              <button onClick={() => setCurrentId(note.id)} className='flex-1 text-left overflow-hidden'>
                <div className='font-semibold truncate'>{note.title}</div>
                <div className='text-xs text-gray-600'>{new Date(note.updated).toLocaleString()}</div>
              </button>
              <button className='bg-white border-2 border-black rounded px-1 text-xs hover:bg-gray-100' onClick={() => duplicateNote(note.id)}>Dup</button>
              <button className='bg-white border-2 border-black rounded px-1 text-xs hover:bg-gray-100' onClick={() => deleteNote(note.id)}>Del</button>
            </li>
          ))}
        </ul>
        <div className='mt-2 flex flex-col gap-2'>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={exportNote}>Export</button>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={exportAll}>Export All</button>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={exportMarkdown}>Export Markdown</button>
        </div>
      </div>
      <div className='flex-1 flex flex-col'>
        <input
          className='border-b-2 border-black px-4 py-2 text-xl font-semibold outline-none'
          value={currentNote?.title || ''}
          onChange={(e) => updateTitle(e.target.value)}
        />
        <div className='flex-1 p-4 overflow-auto'>
          <LexicalComposer initialConfig={initialConfig}>
            <EditorRefPlugin editorRef={editorRef} />
            <LoadPlugin content={currentNote?.content} />
            <AutosavePlugin onChange={updateContent} />
            <ToolbarPlugin />
            <RichTextPlugin
              contentEditable={<ContentEditable className='min-h-full outline-none leading-relaxed' />}
              placeholder={<div className='absolute top-4 left-4 text-gray-400 pointer-events-none'>Write a note...</div>}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          </LexicalComposer>
        </div>
      </div>
    </div>
  )
}

