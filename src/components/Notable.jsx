import React, { useCallback, useRef, useState } from 'react'
import {
  IconBold,
  IconItalic,
  IconUnderline,
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
} from '@tabler/icons-react'
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
import { CodeNode, $createCodeNode } from '@lexical/code'
import { $setBlocksType } from '@lexical/selection'
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { TRANSFORMERS, $convertToMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'

const emptyState = {
  root: {
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        direction: 'ltr',
        version: 1,
        children: [
          {
            type: 'text',
            text: '',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      },
    ],
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
  const insertCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (selection) {
        $setBlocksType(selection, () => $createCodeNode())
      }
    })
  }
  return (
    <div className='absolute top-2 left-1/2 -translate-x-1/2 z-10 flex justify-center pointer-events-none'>
      <div className='pointer-events-auto inline-flex flex-wrap gap-2 bg-white border-2 border-black rounded-xl shadow-md px-2 py-1'>
        <button className={btn} aria-label='Bold' title='Bold' onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
          <IconBold size={16} />
        </button>
        <button className={btn} aria-label='Italic' title='Italic' onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
          <IconItalic size={16} />
        </button>
        <button className={btn} aria-label='Underline' title='Underline' onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}>
          <IconUnderline size={16} />
        </button>
        <button className={btn} aria-label='Strikethrough' title='Strikethrough' onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>
          <IconStrikethrough size={16} />
        </button>
        <button className={btn} aria-label='Heading 1' title='Heading 1' onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h1')}>
          <IconH1 size={16} />
        </button>
        <button className={btn} aria-label='Heading 2' title='Heading 2' onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h2')}>
          <IconH2 size={16} />
        </button>
        <button className={btn} aria-label='Heading 3' title='Heading 3' onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h3')}>
          <IconH3 size={16} />
        </button>
        <button className={btn} aria-label='Bulleted list' title='Bulleted list' onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND)}>
          <IconList size={16} />
        </button>
        <button className={btn} aria-label='Numbered list' title='Numbered list' onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND)}>
          <IconListNumbers size={16} />
        </button>
        <button className={btn} aria-label='Quote' title='Quote' onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'quote')}>
          <IconBlockquote size={16} />
        </button>
        <button className={btn} aria-label='Code block' title='Code block' onClick={insertCodeBlock}>
          <IconCode size={16} />
        </button>
        <button className={btn} aria-label='Link' title='Link' onClick={insertLink}>
          <IconLink size={16} />
        </button>
        <button className={btn} aria-label='Horizontal rule' title='Horizontal rule' onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND)}>
          <IconSeparator size={16} />
        </button>
        <button className={btn} aria-label='Undo' title='Undo' onClick={() => editor.dispatchCommand(UNDO_COMMAND)}>
          <IconArrowBackUp size={16} />
        </button>
        <button className={btn} aria-label='Redo' title='Redo' onClick={() => editor.dispatchCommand(REDO_COMMAND)}>
          <IconArrowForwardUp size={16} />
        </button>
      </div>
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
      try {
        const serialized = typeof content === 'string' ? content : JSON.stringify(content)
        const state = editor.parseEditorState(serialized)
        editor.setEditorState(state)
      } catch (e) {
        console.error('Failed to load note state, falling back to empty paragraph', e)
        try {
          editor.setEditorState(editor.parseEditorState(JSON.stringify(emptyState)))
        } catch {}
      }
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
    <div className='flex flex-col md:flex-row min-h-[calc(100vh-88px)] bg-gray-50'>
      <div className='w-full md:w-72 border-b-2 md:border-b-0 md:border-r-2 border-black p-4 flex flex-col'>
        <div className='flex gap-2 mb-2'>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={createNote}>New</button>
          <button className='bg-white border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100 text-sm' onClick={() => fileRef.current.click()}>Import</button>
          <input ref={fileRef} type='file' accept='application/json' onChange={onImport} className='hidden' />
        </div>
        <input
          className='mb-2 bg-white border-2 border-black rounded-lg px-2 py-1 text-sm w-full'
          value={currentNote?.title || ''}
          onChange={(e) => updateTitle(e.target.value)}
        />
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
        <div className='flex-1 relative overflow-hidden'>
          <LexicalComposer initialConfig={initialConfig}>
            <EditorRefPlugin editorRef={editorRef} />
            <LoadPlugin content={currentNote?.content} />
            <AutosavePlugin onChange={updateContent} />
            <ToolbarPlugin />
            <RichTextPlugin
              contentEditable={<ContentEditable className='h-full w-full outline-none leading-relaxed overflow-auto' />}
              placeholder={null}
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
