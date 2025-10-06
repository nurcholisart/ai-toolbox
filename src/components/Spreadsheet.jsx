import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconDownload, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react'

const STORAGE_KEY = 'spreadsheet:sheetV2'
const LEGACY_STORAGE_KEYS = ['spreadsheet:sheetV1']
const DEFAULT_ROWS = 8
const DEFAULT_COLS = 6

const columnNameFromIndex = (index) => {
  let name = ''
  let current = index
  while (current >= 0) {
    name = String.fromCharCode((current % 26) + 65) + name
    current = Math.floor(current / 26) - 1
  }
  return name
}

const columnNameToIndex = (name) => {
  return name.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
}

const parseCellId = (id) => {
  const match = /^([A-Z]+)(\d+)$/.exec(id)
  if (!match) return null
  const [, columnName, rowPart] = match
  const colIndex = columnNameToIndex(columnName)
  const rowIndex = Number.parseInt(rowPart, 10) - 1
  if (Number.isNaN(rowIndex) || colIndex < 0) return null
  return { colIndex, rowIndex }
}

const createDefaultState = () => ({
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  cells: {},
})

const sanitizeState = (state) => {
  if (!state || typeof state !== 'object') return createDefaultState()
  const rows = Number.isInteger(state.rows) && state.rows > 0 ? state.rows : DEFAULT_ROWS
  const cols = Number.isInteger(state.cols) && state.cols > 0 ? state.cols : DEFAULT_COLS
  const cells = {}
  if (state.cells && typeof state.cells === 'object') {
    Object.entries(state.cells).forEach(([key, value]) => {
      if (typeof value === 'string') cells[key] = value
    })
  }
  return { rows, cols, cells }
}

const deserializeState = (value) => {
  try {
    const parsed = JSON.parse(value)
    return sanitizeState(parsed)
  } catch (error) {
    return createDefaultState()
  }
}

const evaluateSheet = (sheet) => {
  const { rows, cols, cells } = sheet
  const cache = new Map()
  const visiting = new Set()

  const isInBounds = (id) => {
    const parsed = parseCellId(id)
    if (!parsed) return false
    const { colIndex, rowIndex } = parsed
    return colIndex >= 0 && colIndex < cols && rowIndex >= 0 && rowIndex < rows
  }

  const evaluateCell = (id) => {
    if (cache.has(id)) return cache.get(id)
    if (visiting.has(id)) {
      const circular = { value: '', error: 'Circular reference' }
      cache.set(id, circular)
      return circular
    }

    visiting.add(id)
    const rawInput = (cells[id] ?? '').trim()
    let result

    if (!rawInput) {
      result = { value: '', error: null }
    } else if (rawInput.startsWith('=')) {
      const expression = rawInput.slice(1)
      const references = expression.match(/[A-Z]+\d+/gi) || []
      let replacedExpression = expression
      let dependencyError = null

      for (const reference of references) {
        const normalized = reference.toUpperCase()
        if (!isInBounds(normalized)) {
          dependencyError = `Unknown cell ${normalized}`
          break
        }
        const evaluated = evaluateCell(normalized)
        if (evaluated.error) {
          dependencyError = evaluated.error
          break
        }
        const numericValue = Number.parseFloat(evaluated.value)
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0
        const pattern = new RegExp(normalized, 'gi')
        replacedExpression = replacedExpression.replace(pattern, safeValue.toString())
      }

      if (dependencyError) {
        result = { value: '', error: dependencyError }
      } else if (!/^[0-9+\-*/().\s]*$/.test(replacedExpression)) {
        result = { value: '', error: 'Invalid expression' }
      } else {
        try {
          const computed = Function(`"use strict"; return (${replacedExpression})`)()
          if (typeof computed === 'number' && Number.isFinite(computed)) {
            result = { value: computed.toString(), error: null }
          } else {
            result = { value: '', error: 'Invalid result' }
          }
        } catch (error) {
          result = { value: '', error: 'Invalid expression' }
        }
      }
    } else {
      result = { value: rawInput, error: null }
    }

    visiting.delete(id)
    cache.set(id, result)
    return result
  }

  const computedCells = {}
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const id = `${columnNameFromIndex(col)}${row + 1}`
      computedCells[id] = evaluateCell(id)
    }
  }
  return computedCells
}

const escapeCsvValue = (value) => {
  if (value === undefined || value === null) return ''
  const stringValue = value.toString()
  if (stringValue.includes('"') || stringValue.includes(',') || /\r|\n/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

const parseCsv = (text) => {
  const rows = []
  let current = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      current.push(value)
      value = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      current.push(value)
      rows.push(current)
      current = []
      value = ''
    } else {
      value += char
    }
  }

  if (value.length > 0 || current.length) {
    current.push(value)
    rows.push(current)
  }

  return rows
}

const getInitialState = () => {
  if (typeof window === 'undefined') return createDefaultState()
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored) return deserializeState(stored)
  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = window.localStorage.getItem(key)
    if (legacy) return deserializeState(legacy)
  }
  return createDefaultState()
}

const serializeState = (sheet) => JSON.stringify(sheet)

export default function Spreadsheet() {
  const [sheet, setSheet] = useState(() => getInitialState())

  const fileInputRef = useRef(null)
  const resetDialogRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, serializeState(sheet))
  }, [sheet])

  const computed = useMemo(() => evaluateSheet(sheet), [sheet])

  const handleCellChange = (id, value) => {
    setSheet((prev) => {
      const nextCells = { ...prev.cells }
      if (value) {
        nextCells[id] = value
      } else {
        delete nextCells[id]
      }
      return { ...prev, cells: nextCells }
    })
  }

  const handleCellPaste = (id, event) => {
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return
    const rows = text.split(/\r?\n/).filter((row, index, array) => !(index === array.length - 1 && row === ''))
    const data = rows.map((row) => row.split('\t'))
    const isMultiCell = data.length > 1 || data.some((row) => row.length > 1)
    if (!isMultiCell) return

    const start = parseCellId(id)
    if (!start) return

    event.preventDefault()

    setSheet((prev) => {
      const nextCells = { ...prev.cells }
      let nextRows = prev.rows
      let nextCols = prev.cols

      data.forEach((rowValues, rowOffset) => {
        rowValues.forEach((cellValue, colOffset) => {
          const rowIndex = start.rowIndex + rowOffset
          const colIndex = start.colIndex + colOffset
          if (rowIndex >= nextRows) nextRows = rowIndex + 1
          if (colIndex >= nextCols) nextCols = colIndex + 1
          const targetId = `${columnNameFromIndex(colIndex)}${rowIndex + 1}`
          if (cellValue) {
            nextCells[targetId] = cellValue
          } else {
            delete nextCells[targetId]
          }
        })
      })

      return {
        rows: nextRows,
        cols: nextCols,
        cells: nextCells,
      }
    })
  }

  const handleAddRow = () => {
    setSheet((prev) => ({
      ...prev,
      rows: prev.rows + 1,
    }))
  }

  const handleAddColumn = () => {
    setSheet((prev) => ({
      ...prev,
      cols: prev.cols + 1,
    }))
  }

  const handleRemoveRowAt = (targetIndex) => {
    setSheet((prev) => {
      if (prev.rows <= 1) return prev
      const nextRows = prev.rows - 1
      const nextCells = {}
      Object.entries(prev.cells).forEach(([key, value]) => {
        const parsed = parseCellId(key)
        if (!parsed) return
        if (parsed.rowIndex === targetIndex) return
        const nextRowIndex = parsed.rowIndex > targetIndex ? parsed.rowIndex - 1 : parsed.rowIndex
        if (nextRowIndex >= nextRows) return
        const id = `${columnNameFromIndex(parsed.colIndex)}${nextRowIndex + 1}`
        nextCells[id] = value
      })
      return { rows: nextRows, cols: prev.cols, cells: nextCells }
    })
  }

  const handleRemoveColumnAt = (targetIndex) => {
    setSheet((prev) => {
      if (prev.cols <= 1) return prev
      const nextCols = prev.cols - 1
      const nextCells = {}
      Object.entries(prev.cells).forEach(([key, value]) => {
        const parsed = parseCellId(key)
        if (!parsed) return
        if (parsed.colIndex === targetIndex) return
        const nextColIndex = parsed.colIndex > targetIndex ? parsed.colIndex - 1 : parsed.colIndex
        if (nextColIndex >= nextCols) return
        const id = `${columnNameFromIndex(nextColIndex)}${parsed.rowIndex + 1}`
        nextCells[id] = value
      })
      return { rows: prev.rows, cols: nextCols, cells: nextCells }
    })
  }

  const handleExportCsv = () => {
    const lines = []
    for (let row = 0; row < sheet.rows; row += 1) {
      const values = []
      for (let col = 0; col < sheet.cols; col += 1) {
        const id = `${columnNameFromIndex(col)}${row + 1}`
        values.push(escapeCsvValue(sheet.cells[id] ?? ''))
      }
      lines.push(values.join(','))
    }
    const csvContent = lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'spreadsheet.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const handleImportCsv = (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result
      if (typeof text !== 'string') return
      const rows = parseCsv(text)
      if (!rows.length) return
      const rowCount = Math.max(1, rows.length)
      const colCount = Math.max(1, ...rows.map((row) => row.length))
      const newCells = {}
      rows.forEach((row, rowIndex) => {
        row.forEach((cellValue, colIndex) => {
          const id = `${columnNameFromIndex(colIndex)}${rowIndex + 1}`
          if (cellValue) {
            newCells[id] = cellValue
          }
        })
      })
      setSheet({
        rows: rowCount,
        cols: colCount,
        cells: newCells,
      })
    }
    reader.readAsText(file)
    if (event.target) event.target.value = ''
  }

  const handleClear = () => {
    setSheet(createDefaultState())
    resetDialogRef.current?.close()
  }

  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => {
    if (!contextMenu) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  const openContextMenu = (event, payload) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ ...payload, x: event.clientX, y: event.clientY })
  }

  const closeContextMenu = () => setContextMenu(null)

  const handleDeleteFromContext = () => {
    if (!contextMenu) return
    if (contextMenu.type === 'row') {
      handleRemoveRowAt(contextMenu.index)
    } else if (contextMenu.type === 'column') {
      handleRemoveColumnAt(contextMenu.index)
    }
    closeContextMenu()
  }

  useEffect(() => {
    if (!contextMenu) return undefined
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    window.addEventListener('contextmenu', handleClick)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('contextmenu', handleClick)
    }
  }, [contextMenu])

  return (
    <main className="flex-1 w-full px-4 sm:px-8 py-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <IconUpload size={18} />
          Import CSV
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <IconDownload size={18} />
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => resetDialogRef.current?.showModal()}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <IconTrash size={18} />
          Clear sheet
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Use arrow keys to move between cells. Start a formula with <code>=</code> (for example <code>=A1*2</code>). Paste multiple
        cells from other spreadsheets and the grid will expand automatically. Right-click row or column headers to delete them.
      </p>

      <div className="relative overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm" role="grid">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500">&nbsp;</th>
              {Array.from({ length: sheet.cols }).map((_, colIndex) => (
                <th
                  key={`header-${colIndex}`}
                  className="min-w-[6rem] border border-gray-200 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-600"
                  scope="col"
                  onContextMenu={(event) => openContextMenu(event, { type: 'column', index: colIndex })}
                >
                  {columnNameFromIndex(colIndex)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }).map((_, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="even:bg-gray-50/50">
                <th
                  className="border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500"
                  scope="row"
                  onContextMenu={(event) => openContextMenu(event, { type: 'row', index: rowIndex })}
                >
                  {rowIndex + 1}
                </th>
                {Array.from({ length: sheet.cols }).map((_, colIndex) => {
                  const cellId = `${columnNameFromIndex(colIndex)}${rowIndex + 1}`
                  const display = computed[cellId]
                  return (
                    <td key={cellId} className="border border-gray-200 p-0 align-top">
                      <div className="flex flex-col">
                        <input
                          type="text"
                          value={sheet.cells[cellId] ?? ''}
                          onChange={(event) => handleCellChange(cellId, event.target.value)}
                          onPaste={(event) => handleCellPaste(cellId, event)}
                          aria-label={`Cell ${cellId}`}
                          className="w-full bg-transparent px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                        {display?.error ? (
                          <span className="px-2 pb-1 text-xs text-gray-500">{display.error}</span>
                        ) : (
                          <span className="px-2 pb-1 text-xs text-gray-500">{display?.value ?? ''}</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={handleAddColumn}
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <IconPlus size={14} />
          Column
        </button>
        <button
          type="button"
          onClick={handleAddRow}
          className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <IconPlus size={14} />
          Row
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportCsv}
        aria-hidden="true"
      />

      <dialog ref={resetDialogRef} className="max-w-sm w-full rounded-lg border border-gray-300 p-6">
        <form method="dialog" className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Reset sheet?</h2>
          <p className="text-sm text-gray-700">
            This action clears all cells and restores the default grid. It cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => resetDialogRef.current?.close()}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
            >
              Clear
            </button>
          </div>
        </form>
      </dialog>

      {contextMenu ? (
        <dialog
          open
          className="fixed z-50 min-w-[160px] rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <form method="dialog" className="space-y-1">
            <p className="px-2 py-1 text-xs uppercase tracking-wide text-gray-500">
              {contextMenu.type === 'row' ? `Row ${contextMenu.index + 1}` : `Column ${columnNameFromIndex(contextMenu.index)}`}
            </p>
            <button
              type="button"
              onClick={handleDeleteFromContext}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-gray-100"
            >
              Delete
              <span className="text-xs text-gray-500">⌫</span>
            </button>
          </form>
        </dialog>
      ) : null}
    </main>
  )
}
