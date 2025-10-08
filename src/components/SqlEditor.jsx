import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

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
  extraExtensions: _extraExtensions = [],
}, ref) {
  const textareaRef = useRef(null)

  const emitSelectionState = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    const currentValue = textarea.value ?? ''
    if (onSelectionChange) {
      const selected = selectionStart === selectionEnd
        ? ''
        : currentValue.slice(selectionStart, selectionEnd)
      onSelectionChange(selected)
    }
    if (onCursorChange) {
      onCursorChange({ head: selectionEnd, anchor: selectionStart })
    }
  }, [onCursorChange, onSelectionChange])

  const getSelection = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return ''
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    if (selectionStart === selectionEnd) return ''
    return textarea.value.slice(selectionStart, selectionEnd)
  }, [])

  const getValue = useCallback(() => {
    return textareaRef.current ? textareaRef.current.value : ''
  }, [])

  const focus = useCallback(() => {
    textareaRef.current?.focus()
  }, [])

  const getCursor = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return { head: 0, anchor: 0 }
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    return { head: selectionEnd, anchor: selectionStart }
  }, [])

  useImperativeHandle(ref, () => ({
    getSelection,
    getValue,
    focus,
    getCursor,
  }), [focus, getCursor, getSelection, getValue])

  const insertTextAtSelection = useCallback((text) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    const currentValue = textarea.value ?? ''
    const nextValue = `${currentValue.slice(0, selectionStart)}${text}${currentValue.slice(selectionEnd)}`
    if (onChange) onChange(nextValue)
    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return
      const nextPos = selectionStart + text.length
      textareaRef.current.selectionStart = nextPos
      textareaRef.current.selectionEnd = nextPos
      emitSelectionState()
    })
  }, [emitSelectionState, onChange])

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      insertTextAtSelection('  ')
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (event.shiftKey) {
        if (onRunSelection) onRunSelection()
        else if (onRun) onRun()
        return
      }
      if (onRun) onRun()
    }
  }, [insertTextAtSelection, onRun, onRunSelection])

  const handleChange = useCallback((event) => {
    if (onChange) onChange(event.target.value)
    window.requestAnimationFrame(() => {
      emitSelectionState()
    })
  }, [emitSelectionState, onChange])

  const handleFocus = useCallback(() => {
    if (onFocus) onFocus()
  }, [onFocus])

  const handleSelectionEvent = useCallback(() => {
    emitSelectionState()
  }, [emitSelectionState])

  useEffect(() => {
    if (onSelectionChange) onSelectionChange('')
  }, [onSelectionChange])

  useEffect(() => {
    emitSelectionState()
  }, [emitSelectionState, value])

  const whitespaceClass = wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'

  return (
    <div className='rounded-lg border-2 border-black bg-white overflow-hidden'>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleSelectionEvent}
        onSelect={handleSelectionEvent}
        onMouseUp={handleSelectionEvent}
        onFocus={handleFocus}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='none'
        aria-label='SQL editor'
        className={`h-72 w-full resize-none bg-transparent p-3 font-mono text-sm leading-6 text-gray-900 outline-none ${whitespaceClass} overflow-auto`}
        wrap={wrap ? 'soft' : 'off'}
      />
    </div>
  )
})

export default SqlEditor
