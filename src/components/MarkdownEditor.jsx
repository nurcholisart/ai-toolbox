import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, drawSelection } from '@codemirror/view'
import { history, defaultKeymap, historyKeymap, undo, redo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { tags, tagHighlighter } from '@lezer/highlight'

// A lightweight CodeMirror 6 wrapper tailored for Markdown editing
// Exposes imperative helpers expected by Notable's toolbar
const MarkdownEditor = forwardRef(function MarkdownEditor({ value, onChange, className = '', 'aria-label': ariaLabel, placeholder = 'Write Markdown here...', wrap: wrapProp = true }, ref) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const lastValueRef = useRef(value || '')
  const wrapCompartmentRef = useRef(new Compartment())

  // Helper: get current document text
  const getDoc = () => (viewRef.current ? viewRef.current.state.doc.toString() : '')

  // Helper: focus to end
  const focusEnd = () => {
    const v = viewRef.current
    if (!v) return
    const end = v.state.doc.length
    v.dispatch({ selection: { anchor: end, head: end }, scrollIntoView: true })
    v.focus()
  }

  // Wrap/unwrap selection with left/right delimiters
  const wrapSel = (left, right = left) => {
    const v = viewRef.current
    if (!v) return
    const st = v.state
    const sel = st.selection.main
    let from = sel.from
    let to = sel.to

    // If empty selection, expand to current word boundaries
    if (from === to) {
      const text = st.doc.toString()
      let l = from
      let r = to
      while (l > 0 && !/\s|\n/.test(text[l - 1])) l--
      while (r < text.length && !/\s|\n/.test(text[r])) r++
      if (r > l) { from = l; to = r }
    }

    const before = st.doc.sliceString(0, from)
    const selText = st.doc.sliceString(from, to)
    const after = st.doc.sliceString(to)

    const hasLeft = from >= left.length && st.doc.sliceString(from - left.length, from) === left
    const hasRight = st.doc.sliceString(to, to + right.length) === right

    let insert
    let newAnchor
    let newHead
    if (hasLeft && hasRight) {
      // Unwrap
      const unwrapped = before.slice(0, -left.length) + selText + after.slice(right.length)
      insert = unwrapped
      newAnchor = from - left.length
      newHead = to - left.length
      v.dispatch({ changes: { from: 0, to: st.doc.length, insert }, selection: { anchor: newAnchor, head: newHead } })
    } else {
      const inner = selText || 'text'
      const mid = left + inner + right
      insert = before + mid + after
      newAnchor = before.length + left.length
      newHead = newAnchor + inner.length
      v.dispatch({ changes: { from: 0, to: st.doc.length, insert }, selection: { anchor: newAnchor, head: newHead } })
    }
    v.focus()
  }

  // Toggle line prefix (e.g., headings, lists, quote). Also strips conflicting prefixes first.
  const linePrefix = (prefix) => {
    const v = viewRef.current
    if (!v) return
    const st = v.state
    const sel = st.selection.main
    const first = st.doc.lineAt(sel.from)
    const last = st.doc.lineAt(sel.to)
    const text = st.doc.toString()

    const lines = text.split('\n')
    const startLine = first.number - 1
    const endLine = last.number - 1

    const strip = (l) => l
      .replace(/^(#{1,6}\s+)/, '')
      .replace(/^(>\s+)/, '')
      .replace(/^([-*+]\s+)/, '')
      .replace(/^(\d+\.\s+)/, '')

    let totalDelta = 0
    const newLines = lines.map((l, idx) => {
      if (idx < startLine || idx > endLine) return l
      const originallyTarget = (prefix === '1. ') ? /^\d+\.\s/.test(l) : l.startsWith(prefix)
      const stripped = strip(l)
      const next = originallyTarget ? stripped : prefix + stripped
      const delta = next.length - l.length
      if (idx === startLine) totalDelta = delta // approximate first-line delta
      return next
    })

    const newText = newLines.join('\n')
    v.dispatch({ changes: { from: 0, to: st.doc.length, insert: newText } })
    const newSelFrom = sel.from + totalDelta
    const newSelTo = sel.to + (newText.length - text.length)
    v.dispatch({ selection: { anchor: Math.max(0, newSelFrom), head: Math.max(0, newSelTo) } })
    v.focus()
  }

  const block = (open, close) => {
    const v = viewRef.current
    if (!v) return
    const st = v.state
    const sel = st.selection.main
    const before = st.doc.sliceString(0, sel.from)
    const selected = st.doc.sliceString(sel.from, sel.to)
    const after = st.doc.sliceString(sel.to)
    const content = selected || 'code'
    const insert = `${before}${open}\n${content}\n${close}${after}`
    const cursor = before.length + open.length + 1 + content.length + 1
    v.dispatch({ changes: { from: 0, to: st.doc.length, insert }, selection: { anchor: cursor, head: cursor } })
    v.focus()
  }

  const insertLink = () => {
    const v = viewRef.current
    if (!v) return
    const url = window.prompt('Enter URL')
    if (!url) return
    const st = v.state
    const sel = st.selection.main
    const before = st.doc.sliceString(0, sel.from)
    const selected = st.doc.sliceString(sel.from, sel.to) || 'link'
    const after = st.doc.sliceString(sel.to)
    const insert = `${before}[${selected}](${url})${after}`
    const cursor = before.length + selected.length + url.length + 4
    v.dispatch({ changes: { from: 0, to: st.doc.length, insert }, selection: { anchor: cursor, head: cursor } })
    v.focus()
  }

  const insertHr = () => {
    const v = viewRef.current
    if (!v) return
    const st = v.state
    const sel = st.selection.main
    const before = st.doc.sliceString(0, sel.from)
    const after = st.doc.sliceString(sel.to)
    const insert = `${before}\n\n---\n\n${after}`
    const cursor = before.length + 3
    v.dispatch({ changes: { from: 0, to: st.doc.length, insert }, selection: { anchor: cursor, head: cursor } })
    v.focus()
  }

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current && viewRef.current.focus(),
    focusEnd,
    wrap: wrapSel,
    linePrefix,
    block,
    insertLink,
    insertHr,
  }))

  useEffect(() => {
    if (!containerRef.current) return
    const headingStyle = syntaxHighlighting(tagHighlighter([
      { tag: tags.heading, class: 'cm-heading-bold' },
    ]))
    const start = EditorState.create({
      doc: value || '',
      extensions: [
        history(),
        drawSelection(),
        wrapCompartmentRef.current.of(wrapProp ? EditorView.lineWrapping : []),
        keymap.of([
          ...historyKeymap,
          ...defaultKeymap,
          // Custom shortcuts mirroring previous textarea behavior
          { key: 'Mod-b', run: () => (wrapSel('**'), true) },
          { key: 'Mod-i', run: () => (wrapSel('*'), true) },
          { key: 'Mod-e', run: () => (wrapSel('`'), true) },
          { key: 'Mod-Shift-s', run: () => (wrapSel('~~'), true) },
          { key: 'Mod-Alt-1', run: () => (linePrefix('# '), true) },
          { key: 'Mod-Alt-2', run: () => (linePrefix('## '), true) },
          { key: 'Mod-Alt-3', run: () => (linePrefix('### '), true) },
          { key: 'Mod-Shift-8', run: () => (linePrefix('- '), true) },
          { key: 'Mod-Shift-7', run: () => (linePrefix('1. '), true) },
          { key: 'Mod-Shift-q', run: () => (linePrefix('> '), true) },
          { key: 'Mod-Shift-c', run: () => (block('```','```'), true) },
          { key: 'Mod-Shift-h', run: () => (insertHr(), true) },
          { key: 'Mod-k', run: () => (insertLink(), true) },
        ]),
        markdown(),
        headingStyle,
        EditorView.updateListener.of((vu) => {
          if (vu.docChanged) {
            const next = vu.state.doc.toString()
            lastValueRef.current = next
            onChange && onChange(next, { coalesce: true })
          }
        }),
        EditorView.contentAttributes.of({
          'aria-label': ariaLabel || 'Markdown editor',
          spellcheck: 'false',
          'data-placeholder': placeholder,
        }),
        // Minimal light theme tweaks to fit the monochrome card
        EditorView.theme({
          '&': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace', fontSize: '0.875rem' },
          '.cm-content': { padding: '0.5rem 0.75rem' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-editor': { borderRadius: '0.5rem', outline: 'none' },
          '&.cm-focused': { outline: 'none' },
          '.cm-heading-bold': { fontWeight: '700' },
        }, { dark: false }),
      ],
    })

    const view = new EditorView({ state: start, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Keep editor doc in sync with prop value (controlled)
  useEffect(() => {
    const v = viewRef.current
    if (!v) return
    const current = v.state.doc.toString()
    if (value !== undefined && value !== current) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }
  }, [value])

  // React to wrap prop changes by reconfiguring the wrapping compartment
  useEffect(() => {
    const v = viewRef.current
    if (!v) return
    v.dispatch({ effects: wrapCompartmentRef.current.reconfigure(wrapProp ? EditorView.lineWrapping : []) })
  }, [wrapProp])

  return (
    <div className={`bg-white border-0 rounded-lg ${className}`}>
      <div ref={containerRef} className='border-0 rounded-lg' />
    </div>
  )
})

export default MarkdownEditor
