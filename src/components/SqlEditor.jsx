import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { sql } from '@codemirror/lang-sql'
import { tags, tagHighlighter } from '@lezer/highlight'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'

const SqlEditor = forwardRef(function SqlEditor({
  value = '',
  onChange,
  onRun,
  onRunSelection,
  placeholder = 'Write a SQL query...',
  onSelectionChange,
  onCursorChange,
  onFocus,
  wrap = false,
  extraExtensions = [],
}, ref) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const dialectCompartment = useRef(new Compartment())
  const wrapCompartment = useRef(new Compartment())
  const lastValueRef = useRef(value)
  const extrasCompartment = useRef(new Compartment())

  const getSelection = () => {
    const view = viewRef.current
    if (!view) return ''
    const sel = view.state.selection.main
    if (sel.empty) return ''
    return view.state.sliceDoc(sel.from, sel.to)
  }

  const getValue = () => {
    const view = viewRef.current
    return view ? view.state.doc.toString() : ''
  }

  const focus = () => {
    if (!viewRef.current) return
    viewRef.current.focus()
  }

  const getCursor = () => {
    const view = viewRef.current
    if (!view) return { head: 0, anchor: 0 }
    const selection = view.state.selection.main
    return { head: selection.head, anchor: selection.anchor }
  }

  useImperativeHandle(ref, () => ({
    getSelection,
    getValue,
    focus,
    getCursor,
  }), [])

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((vu) => {
      if (vu.docChanged) {
        const nextValue = vu.state.doc.toString()
        lastValueRef.current = nextValue
        onChange && onChange(nextValue)
      }
      if (vu.selectionSet) {
        if (onSelectionChange) onSelectionChange(getSelection())
        if (onCursorChange) {
          const main = vu.state.selection.main
          onCursorChange({ head: main.head, anchor: main.anchor })
        }
      }
    })

    const extensions = [
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      lineNumbers(),
      indentationMarkers(),
      EditorState.tabSize.of(2),
      EditorView.baseTheme({
        '&': { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular)', fontSize: '0.9rem' },
        '.cm-content': { padding: '0.75rem' },
        '.cm-placeholder': { color: '#9ca3af' },
        '.cm-activeLine': { backgroundColor: '#f5f5f5' },
        '.cm-gutters': { backgroundColor: '#f9fafb', borderRight: '1px solid #111827' },
        '.cm-activeLineGutter': { backgroundColor: '#f3f4f6' },
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
            if (onRun) onRun()
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
      wrapCompartment.current.of(wrap ? EditorView.lineWrapping : []),
      extrasCompartment.current.of(extraExtensions),
      updateListener,
      EditorView.domEventHandlers({
        focus: () => {
          if (onFocus) onFocus()
        },
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
        role: 'textbox',
        'aria-multiline': 'true',
      },
    })

    viewRef.current = view
    if (onSelectionChange) onSelectionChange('')

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [extraExtensions, onChange, onCursorChange, onFocus, onRun, onRunSelection, onSelectionChange, placeholder])

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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: wrapCompartment.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    })
  }, [wrap])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: extrasCompartment.current.reconfigure(extraExtensions),
    })
  }, [extraExtensions])

  return (
    <div className='rounded-lg border-2 border-black bg-white'>
      <div ref={containerRef} className='cm-sql h-72 overflow-hidden' />
    </div>
  )
})

export default SqlEditor
