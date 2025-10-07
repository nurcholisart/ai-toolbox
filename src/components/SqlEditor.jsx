import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, drawSelection, keymap, highlightActiveLine, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { sql } from '@codemirror/lang-sql'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { tags, tagHighlighter } from '@lezer/highlight'

const SqlEditor = forwardRef(function SqlEditor({
  value = '',
  onChange,
  onRun,
  onRunSelection,
  placeholder = 'Write a SQL query...'
}, ref) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const dialectCompartment = useRef(new Compartment())
  const lastValueRef = useRef(value)

  const getSelection = () => {
    const view = viewRef.current
    if (!view) return ''
    const sel = view.state.selection.main
    if (sel.empty) return ''
    return view.state.sliceDoc(sel.from, sel.to)
  }

  const getValue = () => viewRef.current ? viewRef.current.state.doc.toString() : ''

  const focus = () => {
    if (!viewRef.current) return
    viewRef.current.focus()
  }

  useImperativeHandle(ref, () => ({
    getSelection,
    getValue,
    focus,
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const extensions = [
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      EditorView.theme({
        '&': { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular)', fontSize: '0.9rem' },
        '.cm-placeholder': { color: '#9ca3af' },
        '.cm-content': { padding: '0.75rem' },
      }),
      syntaxHighlighting(tagHighlighter([
        { tag: tags.keyword, class: 'cm-sql-keyword' },
        { tag: tags.string, class: 'cm-sql-string' },
        { tag: tags.number, class: 'cm-sql-number' },
      ])),
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-Enter',
          run: () => {
            onRun && onRun()
            return true
          },
        },
        {
          key: 'Shift-Mod-Enter',
          run: () => {
            if (onRunSelection) onRunSelection()
            else if (onRun) onRun()
            return true
          },
        },
      ]),
      dialectCompartment.current.of(sql()),
      cmPlaceholder(placeholder),
      EditorView.lineWrapping,
      EditorView.updateListener.of((vu) => {
        if (!vu.docChanged) return
        const nextValue = vu.state.doc.toString()
        lastValueRef.current = nextValue
        onChange && onChange(nextValue)
      }),
    ]

    const startState = EditorState.create({
      doc: value,
      extensions,
    })

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
      attributes: {
        'aria-label': 'SQL editor',
        'role': 'textbox',
        'aria-multiline': 'true',
      },
    })

    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc.toString()
    if (value !== doc && value !== lastValueRef.current) {
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: value },
      })
      lastValueRef.current = value
    }
  }, [value])

  return (
    <div className='border-2 border-black rounded-lg bg-white overflow-hidden' data-placeholder={placeholder}>
      <div ref={containerRef} className='cm-sql h-72' />
    </div>
  )
})

export default SqlEditor
