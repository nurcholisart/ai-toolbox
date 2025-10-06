import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconDownload,
  IconMinus,
  IconPlus,
  IconTrash,
  IconUpload,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react'

const STORAGE_KEY = 'spreadsheet:sheetV1'
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

const createDefaultState = () => ({
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  headerNames: Array.from({ length: DEFAULT_COLS }, (_, index) => columnNameFromIndex(index)),
  showHeaderNames: true,
  cells: {},
})

const parseCellId = (id) => {
  const match = /^([A-Z]+)(\d+)$/.exec(id)
  if (!match) return null
  const [, columnName, rowPart] = match
  const colIndex = columnNameToIndex(columnName)
  const rowIndex = Number.parseInt(rowPart, 10) - 1
  if (Number.isNaN(rowIndex) || colIndex < 0) return null
  return { colIndex, rowIndex }
}

const evaluateSheet = (sheet) => {
  const { cells, rows, cols } = sheet
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

const serializeState = (sheet) => JSON.stringify(sheet)

const deserializeState = (value) => {
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return createDefaultState()
    const rows = Number.isInteger(parsed.rows) && parsed.rows > 0 ? parsed.rows : DEFAULT_ROWS
    const cols = Number.isInteger(parsed.cols) && parsed.cols > 0 ? parsed.cols : DEFAULT_COLS
    const headerNames = Array.from({ length: cols }, (_, index) => {
      const candidate = Array.isArray(parsed.headerNames) ? parsed.headerNames[index] : undefined
      if (typeof candidate === 'string' && candidate.length) return candidate
      return columnNameFromIndex(index)
    })
    const showHeaderNames = typeof parsed.showHeaderNames === 'boolean' ? parsed.showHeaderNames : true
    const cells = {}
    if (parsed.cells && typeof parsed.cells === 'object') {
      Object.entries(parsed.cells).forEach(([key, cellValue]) => {
        if (typeof cellValue === 'string') cells[key] = cellValue
      })
    }
    return { rows, cols, headerNames, showHeaderNames, cells }
  } catch (error) {
    return createDefaultState()
  }
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

export default function Spreadsheet() {
  const [sheet, setSheet] = useState(() => {
    if (typeof window === 'undefined') return createDefaultState()
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createDefaultState()
    return deserializeState(stored)
  })

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
      return {
        ...prev,
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

  const handleRemoveRow = () => {
    setSheet((prev) => {
      if (prev.rows <= 1) return prev
      const updatedCells = { ...prev.cells }
      for (let col = 0; col < prev.cols; col += 1) {
        const id = `${columnNameFromIndex(col)}${prev.rows}`
        delete updatedCells[id]
      }
      return {
        ...prev,
        rows: prev.rows - 1,
        cells: updatedCells,
      }
    })
  }

  const handleAddColumn = () => {
    setSheet((prev) => ({
      ...prev,
      cols: prev.cols + 1,
      headerNames: [...prev.headerNames, columnNameFromIndex(prev.cols)],
    }))
  }

  const handleRemoveColumn = () => {
    setSheet((prev) => {
      if (prev.cols <= 1) return prev
      const updatedCells = { ...prev.cells }
      const newCols = prev.cols - 1
      for (let row = 0; row < prev.rows; row += 1) {
        const id = `${columnNameFromIndex(prev.cols - 1)}${row + 1}`
        delete updatedCells[id]
      }
      return {
        ...prev,
        cols: newCols,
        headerNames: prev.headerNames.slice(0, newCols),
        cells: updatedCells,
      }
    })
  }

  const handleToggleHeaders = () => {
    setSheet((prev) => ({
      ...prev,
      showHeaderNames: !prev.showHeaderNames,
    }))
  }

  const handleHeaderChange = (index, value) => {
    setSheet((prev) => {
      const nextHeaderNames = [...prev.headerNames]
      nextHeaderNames[index] = value
      return {
        ...prev,
        headerNames: nextHeaderNames,
      }
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
          newCells[id] = cellValue
        })
      })
      setSheet({
        rows: rowCount,
        cols: colCount,
        headerNames: Array.from({ length: colCount }, (_, index) => sheet.headerNames[index] ?? columnNameFromIndex(index)),
        showHeaderNames: sheet.showHeaderNames,
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

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-semibold text-gray-900 mb-6">Spreadsheet</h1>
      <section className="bg-white border-2 border-black rounded-xl shadow-md p-6 space-y-4">
        <header className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconPlus size={18} />
              Add row
            </button>
            <button
              type="button"
              onClick={handleRemoveRow}
              className="inline-flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconMinus size={18} />
              Remove row
            </button>
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconPlus size={18} />
              Add column
            </button>
            <button
              type="button"
              onClick={handleRemoveColumn}
              className="inline-flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconMinus size={18} />
              Remove column
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleHeaders}
              className="inline-flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
              aria-pressed={sheet.showHeaderNames}
            >
              {sheet.showHeaderNames ? <IconEye size={18} /> : <IconEyeOff size={18} />}
              Toggle header names
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconDownload size={18} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconUpload size={18} />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => resetDialogRef.current?.showModal()}
              className="inline-flex items-center gap-2 bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <IconTrash size={18} />
              Clear sheet
            </button>
          </div>
        </header>
        <p className="text-sm text-gray-600">
          Use arrow keys to move between cells. Enter a formula starting with <code>=</code> (for example, <code>=A1*2</code>). Column headers can be renamed when header names are visible.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-2 border-black rounded-lg" role="grid">
            <thead>
              <tr>
                <th className="border-b-2 border-black bg-gray-100 text-left px-3 py-2 text-sm font-medium text-gray-700">&nbsp;</th>
                {Array.from({ length: sheet.cols }).map((_, colIndex) => (
                  <th
                    key={`header-${colIndex}`}
                    className="border-b-2 border-black bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700"
                    scope="col"
                  >
                    {sheet.showHeaderNames ? (
                      <input
                        type="text"
                        value={sheet.headerNames[colIndex] ?? columnNameFromIndex(colIndex)}
                        onChange={(event) => handleHeaderChange(colIndex, event.target.value)}
                        className="w-full bg-white border-2 border-black rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        aria-label={`Header ${columnNameFromIndex(colIndex)}`}
                      />
                    ) : (
                      <span>{columnNameFromIndex(colIndex)}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }).map((_, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                  <th className="border-b border-black px-3 py-2 text-sm font-medium text-gray-700 text-left" scope="row">
                    {rowIndex + 1}
                  </th>
                  {Array.from({ length: sheet.cols }).map((_, colIndex) => {
                    const cellId = `${columnNameFromIndex(colIndex)}${rowIndex + 1}`
                    const display = computed[cellId]
                    return (
                      <td key={cellId} className="border-b border-black px-2 py-2 align-top">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={sheet.cells[cellId] ?? ''}
                            onChange={(event) => handleCellChange(cellId, event.target.value)}
                            aria-label={`Cell ${cellId}`}
                            className="w-full bg-white border-2 border-black rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                          />
                          {display?.error ? (
                            <p className="text-xs text-gray-600">{display.error}</p>
                          ) : (
                            <p className="text-xs text-gray-600">{display?.value ?? ''}</p>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportCsv}
        aria-hidden="true"
      />

      <dialog
        ref={resetDialogRef}
        className="rounded-xl border-2 border-black p-6 max-w-sm w-full"
      >
        <form method="dialog" className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Reset sheet?</h2>
          <p className="text-sm text-gray-700">
            This action clears all cells and restores the default grid. It cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => resetDialogRef.current?.close()}
              className="bg-white border-2 border-black text-black px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
            >
              Clear
            </button>
          </div>
        </form>
      </dialog>
    </main>
  )
}
