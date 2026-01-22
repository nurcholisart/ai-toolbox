import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
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
import { autocompletion } from '@codemirror/autocomplete'
import { indentUnit } from '@codemirror/language'
import { sql } from '@codemirror/lang-sql'

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
  extraExtensions: extraExtensionsProp = [],
}, ref) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const wrapCompartment = useMemo(() => new Compartment(), [])
  const placeholderCompartment = useMemo(() => new Compartment(), [])
  const extraExtensionsCompartment = useMemo(() => new Compartment(), [])

  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  const onRunSelectionRef = useRef(onRunSelection)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const onFocusRef = useRef(onFocus)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    onRunRef.current = onRun
  }, [onRun])
  useEffect(() => {
    onRunSelectionRef.current = onRunSelection
  }, [onRunSelection])
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])
  useEffect(() => {
    onFocusRef.current = onFocus
  }, [onFocus])

  const runKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: 'Shift-Mod-Enter',
          run: () => {
            if (onRunSelectionRef.current) {
              onRunSelectionRef.current()
              return true
            }
            if (onRunRef.current) {
              onRunRef.current()
              return true
            }
            return false
          },
        },
        {
          key: 'Mod-Enter',
          run: () => {
            if (onRunRef.current) {
              onRunRef.current()
              return true
            }
            return false
          },
        },
        indentWithTab,
      ]),
    [],
  )

  const updateListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (update.focusChanged && update.view.hasFocus) {
          if (onFocusRef.current) onFocusRef.current()
        }

        if (update.docChanged) {
          if (onChangeRef.current) {
            onChangeRef.current(update.state.doc.toString())
          }
        }

        if (update.docChanged || update.selectionSet) {
          const { main } = update.state.selection
          if (onSelectionChangeRef.current) {
            if (main.empty) {
              onSelectionChangeRef.current('')
            } else {
              onSelectionChangeRef.current(update.state.sliceDoc(main.from, main.to))
            }
          }
          if (onCursorChangeRef.current) {
            onCursorChangeRef.current({ head: main.head, anchor: main.anchor })
          }
        }
      }),
    [],
  )

  const baseTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'transparent',
          color: '#111827',
        },
        '.cm-content': {
          fontFamily:
            'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '0.875rem',
          lineHeight: '1.5rem',
          padding: '0.75rem',
        },
        '.cm-line': {
          padding: '0 0.25rem',
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: '#6b7280',
          border: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#f3f4f6',
        },
        '.cm-activeLine': {
          backgroundColor: '#f9fafb',
        },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor: '#11182726',
        },
        '&.cm-editor.cm-focused': {
          outline: 'none',
        },
      }),
    [],
  )

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        autocompletion(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        sql(),
        baseTheme,
        EditorView.contentAttributes.of({
          'aria-label': 'SQL editor',
          spellcheck: 'false',
          autocorrect: 'off',
          autocomplete: 'off',
          autocapitalize: 'none',
        }),
        runKeymap,
        keymap.of([...historyKeymap, ...defaultKeymap]),
        updateListener,
        wrapCompartment.of(wrap ? EditorView.lineWrapping : []),
        placeholderCompartment.of(placeholder ? cmPlaceholder(placeholder) : []),
        extraExtensionsCompartment.of(extraExtensionsProp || []),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    })

    viewRef.current = view

    if (onSelectionChangeRef.current) {
      onSelectionChangeRef.current('')
    }
    if (onCursorChangeRef.current) {
      const { main } = view.state.selection
      onCursorChangeRef.current({ head: main.head, anchor: main.anchor })
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [
    baseTheme,
    extraExtensionsCompartment,
    extraExtensionsProp,
    placeholder,
    placeholderCompartment,
    runKeymap,
    updateListener,
    value,
    wrap,
    wrapCompartment,
  ])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      const { main } = view.state.selection
      const newLength = value.length
      const anchor = Math.min(main.anchor, newLength)
      const head = Math.min(main.head, newLength)
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        selection: { anchor, head },
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    })
  }, [wrap, wrapCompartment])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const extension = placeholder ? cmPlaceholder(placeholder) : []
    view.dispatch({
      effects: placeholderCompartment.reconfigure(extension),
    })
  }, [placeholder, placeholderCompartment])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: extraExtensionsCompartment.reconfigure(extraExtensionsProp || []),
    })
  }, [extraExtensionsCompartment, extraExtensionsProp])

  const getSelection = useCallback(() => {
    const view = viewRef.current
    if (!view) return ''
    const { main } = view.state.selection
    if (main.empty) return ''
    return view.state.sliceDoc(main.from, main.to)
  }, [])

  const getValue = useCallback(() => {
    return viewRef.current ? viewRef.current.state.doc.toString() : ''
  }, [])

  const focus = useCallback(() => {
    viewRef.current?.focus()
  }, [])

  const getCursor = useCallback(() => {
    const view = viewRef.current
    if (!view) return { head: 0, anchor: 0 }
    const { main } = view.state.selection
    return { head: main.head, anchor: main.anchor }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      getSelection,
      getValue,
      focus,
      getCursor,
    }),
    [focus, getCursor, getSelection, getValue],
  )

  return (
    <div className='rounded-lg border-2 border-black bg-white overflow-hidden'>
      <div className='h-72' ref={containerRef} />
    </div>
  )
})

export default SqlEditor
