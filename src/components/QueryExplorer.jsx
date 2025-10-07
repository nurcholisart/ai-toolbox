import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArrowLeft,
  IconSettings,
  IconDatabaseImport,
  IconAlertCircle,
  IconPlayerPlay,
  IconTrash,
  IconDownload,
  IconHistory,
  IconPin,
  IconPinFilled,
  IconRestore,
  IconCloudOff,
  IconRefresh,
  IconClipboard,
  IconClock,
  IconChevronDown,
  IconChevronRight,
  IconColumns3,
} from '@tabler/icons-react'
import * as duckdb from '@duckdb/duckdb-wasm'
import { tableFromIPC } from 'apache-arrow'
import duckdbMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdbEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdbWorkerMvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbWorkerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { openDB } from 'idb'
import SqlEditor from './SqlEditor.jsx'
import VirtualTable from './VirtualTable.jsx'
import InstallPrompt from './InstallPrompt.jsx'

const MANUAL_BUNDLES = {
  mvp: {
    mainModule: duckdbMvp,
    mainWorker: duckdbWorkerMvp,
  },
  eh: {
    mainModule: duckdbEh,
    mainWorker: duckdbWorkerEh,
  },
}

const DB_NAME = 'query-explorer-cache'
const DB_VERSION = 1
const STORE_DATASETS = 'datasets'
const STORE_HISTORY = 'history'

const DEFAULT_MEMORY_LIMIT_MB = 512

const textEncoder = new TextEncoder()

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '0 B'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 2)} ${units[i]}`
}

const formatDateTimeJakarta = (date) => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

const quoteIdentifier = (value) => `"${value.replace(/"/g, '""')}"`

const sqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`

const jsonBigIntReplacer = (_, value) => {
  return typeof value === 'bigint' ? value.toString() : value
}

const safeJsonStringify = (value) => JSON.stringify(value, jsonBigIntReplacer)

const normalizeName = (input, registry) => {
  const baseName = input
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '') || 'dataset'
  let name = /^[a-z_]/.test(baseName) ? baseName : `t_${baseName}`
  let counter = 1
  while (registry.has(name)) {
    counter += 1
    name = `${baseName}_${counter}`
  }
  registry.add(name)
  return name
}

const flattenSchema = (schema) => schema.map((field) => ({
  name: field.name,
  type: field.type?.toString ? field.type.toString() : `${field.type}`,
  nullable: field.nullable ?? true,
}))

const MANUAL_QUERY_HINT = '-- Press Cmd/Ctrl + Enter to run the full query. Shift + Cmd/Ctrl + Enter runs the current selection.'

const createIndexedDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_DATASETS)) {
        const store = db.createObjectStore(STORE_DATASETS, { keyPath: 'id' })
        store.createIndex('viewName', 'viewName', { unique: true })
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const history = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' })
        history.createIndex('pinned', 'pinned', { unique: false })
      }
    },
  })
}

const ensureUuid = () => {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `qe-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}

const deriveNdjson = (text) => {
  const trimmed = text.trim()
  if (!trimmed) return { ndjson: '', converted: false }
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed)) {
        return { error: 'Expected a JSON array when attempting conversion.' }
      }
      const ndjson = parsed.map((entry, idx) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          throw new Error(`Element at index ${idx} is not a JSON object.`)
        }
        return safeJsonStringify(entry)
      }).join('\n')
      return { ndjson, converted: true }
    } catch (error) {
      return { error: `Unable to convert JSON array to JSON Lines: ${error.message}` }
    }
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  for (let i = 0; i < lines.length; i += 1) {
    try {
      const parsed = JSON.parse(lines[i])
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { error: `Line ${i + 1} is not a JSON object.` }
      }
    } catch (error) {
      return { error: `Line ${i + 1} is invalid JSON: ${error.message}` }
    }
  }
  return { ndjson: lines.join('\n'), converted: false }
}

const formatValue = (value) => {
  if (value === null || value === undefined) return <span className='text-gray-500'>NULL</span>
  if (value instanceof Uint8Array) return `0x${Array.from(value).map((x) => x.toString(16).padStart(2, '0')).join('')}`
  if (Array.isArray(value)) return safeJsonStringify(value)
  if (typeof value === 'object') return safeJsonStringify(value)
  return String(value)
}

const QueryExplorer = ({ onDatasetsChanged, onQueryExecuted }) => {
  const duckStateRef = useRef({ db: null, conn: null, worker: null })
  const [duckState, setDuckState] = useState(duckStateRef.current)
  const [initError, setInitError] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState(null)
  const [query, setQuery] = useState(`${MANUAL_QUERY_HINT}\n\nSELECT * FROM example LIMIT 100;`)
  const [queryStatus, setQueryStatus] = useState({ state: 'idle' })
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [cacheEnabled, setCacheEnabled] = useState(true)
  const [loadingFromCache, setLoadingFromCache] = useState(false)
  const [memoryLimitMb, setMemoryLimitMb] = useState(DEFAULT_MEMORY_LIMIT_MB)
  const [messages, setMessages] = useState([])
  const [sidebarSections, setSidebarSections] = useState({
    uploads: true,
    columns: true,
    history: true,
    notifications: true,
  })
  const [csvOptions, setCsvOptions] = useState({
    delimiter: ',',
    header: true,
    quote: '"',
    escape: '"',
    nullstr: '',
    encoding: 'utf-8',
  })
  const dbPromiseRef = useRef(null)
  const reservedNamesRef = useRef(new Set())
  const fileHandlesRef = useRef(new Map())
  const activeQueryRef = useRef(null)

  const onDatasetsChangedRef = useRef(onDatasetsChanged)
  const onQueryExecutedRef = useRef(onQueryExecuted)

  useEffect(() => { onDatasetsChangedRef.current = onDatasetsChanged }, [onDatasetsChanged])
  useEffect(() => { onQueryExecutedRef.current = onQueryExecuted }, [onQueryExecuted])

  const ensureDb = useCallback(async () => {
    if (!dbPromiseRef.current) {
      dbPromiseRef.current = createIndexedDb()
    }
    return dbPromiseRef.current
  }, [])

  const totalDatasetSize = useMemo(() => datasets.reduce((acc, ds) => acc + (ds.approxSize || 0), 0), [datasets])

  const addMessage = useCallback((content, tone = 'info') => {
    setMessages((prev) => [...prev, { id: ensureUuid(), content, tone }])
  }, [])

  const removeMessage = useCallback((id) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id))
  }, [])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setInitializing(true)
      try {
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
        const worker = new Worker(bundle.mainWorker, { type: 'module' })
        const logger = new duckdb.ConsoleLogger()
        const db = new duckdb.AsyncDuckDB(logger, worker)
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
        const conn = await db.connect()
        if (cancelled) {
          await conn.close()
          await db.terminate()
          worker.terminate()
          return
        }
        setDuckState({ db, conn, worker })
        setInitError(null)
      } catch (error) {
        console.error('DuckDB initialization error', error)
        setInitError(error)
        addMessage('DuckDB failed to initialize. Try reloading the page.', 'error')
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [addMessage])

  useEffect(() => {
    duckStateRef.current = duckState
  }, [duckState])

  useEffect(() => {
    return () => {
      const current = duckStateRef.current
      if (current.conn) current.conn.close().catch(() => {})
      if (current.db) current.db.terminate().catch(() => {})
      if (current.worker) current.worker.terminate()
    }
  }, [])

  const loadCache = useCallback(async () => {
    if (!cacheEnabled) return
    if (!duckState.db || !duckState.conn) return
    setLoadingFromCache(true)
    try {
      const db = await ensureDb()
      const stored = await db.getAll(STORE_DATASETS)
      const pinnedQueries = await db.getAllFromIndex(STORE_HISTORY, 'pinned', IDBKeyRange.only(true))
      const loadedDatasets = []
      for (const entry of stored) {
        try {
          reservedNamesRef.current.add(entry.viewName)
          const fileName = `cache/${entry.id}/${entry.originalName}`
          await duckState.db.registerFileBuffer(fileName, new Uint8Array(entry.buffer))
          fileHandlesRef.current.set(entry.viewName, fileName)
          await duckState.conn.query(`CREATE OR REPLACE VIEW ${quoteIdentifier(entry.viewName)} AS ${entry.viewSql}`)
          const schemaTable = await duckState.conn.query(`PRAGMA table_info(${quoteIdentifier(entry.viewName)})`)
          const schema = schemaTable.toArray().map((row) => ({
            name: row.name,
            type: row.type,
            nullable: row.notnull === 0,
          }))
          loadedDatasets.push({
            id: entry.id,
            viewName: entry.viewName,
            sourceFileName: entry.originalName,
            approxSize: entry.approxSize,
            createdAt: new Date(entry.createdAt),
            schema,
            type: entry.type,
            csvOptions: entry.csvOptions,
            convertedFromArray: entry.convertedFromArray,
          })
        } catch (error) {
          console.warn('Failed to hydrate dataset from cache', error)
        }
      }
      setDatasets(loadedDatasets)
      if (loadedDatasets.length > 0) {
        setSelectedDatasetId(loadedDatasets[0].id)
      }
      const initialHistory = pinnedQueries.map((entry) => ({
        id: entry.id,
        sql: entry.sql,
        createdAt: entry.createdAt,
        pinned: true,
      }))
      setHistory(initialHistory)
      if (loadedDatasets.length > 0) {
        addMessage('Datasets restored from local cache.', 'success')
      }
    } catch (error) {
      console.error('Cache load error', error)
      addMessage('Failed to restore cached datasets.', 'error')
    } finally {
      setLoadingFromCache(false)
    }
  }, [addMessage, cacheEnabled, duckState.conn, duckState.db, ensureDb])

  useEffect(() => {
    loadCache()
  }, [loadCache])

  useEffect(() => {
    if (onDatasetsChangedRef.current) {
      onDatasetsChangedRef.current(datasets.map((ds) => ({
        name: ds.viewName,
        sourceFileName: ds.sourceFileName,
        approxSize: ds.approxSize,
        schema: ds.schema,
        createdAt: ds.createdAt,
      })))
    }
  }, [datasets])

  const toggleSidebarSection = useCallback((key) => {
    setSidebarSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const selectedDataset = useMemo(() => {
    return datasets.find((item) => item.id === selectedDatasetId) ?? null
  }, [datasets, selectedDatasetId])

  const persistDataset = useCallback(async (dataset, buffer, viewSql) => {
    if (!cacheEnabled) return
    try {
      const db = await ensureDb()
      const storedBuffer = buffer instanceof Uint8Array
        ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        : buffer
      await db.put(STORE_DATASETS, {
        id: dataset.id,
        originalName: dataset.sourceFileName,
        viewName: dataset.viewName,
        approxSize: dataset.approxSize,
        createdAt: dataset.createdAt.toISOString(),
        csvOptions: dataset.csvOptions,
        type: dataset.type,
        convertedFromArray: dataset.convertedFromArray,
        buffer: storedBuffer,
        viewSql,
      })
    } catch (error) {
      console.error('Failed to persist dataset', error)
    }
  }, [cacheEnabled, ensureDb])

  const removeDatasetFromCache = useCallback(async (id) => {
    try {
      const db = await ensureDb()
      await db.delete(STORE_DATASETS, id)
    } catch (error) {
      console.error('Failed to remove dataset from cache', error)
    }
  }, [ensureDb])

  const handleFiles = useCallback(async (files, csvOptionsOverrides = null) => {
    if (!duckState.db || !duckState.conn) {
      addMessage('DuckDB is still initializing. Please wait a moment.', 'warning')
      return
    }
    const incoming = Array.from(files)
    for (const file of incoming) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const approxSize = file.size
      if ((totalDatasetSize + approxSize) / (1024 * 1024) > memoryLimitMb) {
        const proceed = window.confirm('Dataset exceeds the configured memory budget. Close other datasets or continue?')
        if (!proceed) {
          addMessage(`Skipped ${file.name} due to memory budget.`, 'warning')
          continue
        }
      }
      const datasetId = ensureUuid()
      const viewName = normalizeName(file.name, reservedNamesRef.current)
      const fileKey = `uploads/${datasetId}/${file.name}`
      let viewSql = ''
      let datasetType = ext
      let csvOptions = csvOptionsOverrides
      let convertedFromArray = false
      let buffer

      try {
        if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
          buffer = new Uint8Array(await file.arrayBuffer())
          await duckState.db.registerFileBuffer(fileKey, buffer)
          const defaults = csvOptionsOverrides || csvOptions
          const options = { ...defaults }
          if (!csvOptionsOverrides && ext === 'tsv') options.delimiter = '\t'
          const params = [
            options.delimiter && options.delimiter !== ',' ? `delim=${sqlLiteral(options.delimiter)}` : null,
            options.header === false ? 'header=false' : 'header=true',
            options.quote && options.quote !== '"' ? `quote=${sqlLiteral(options.quote)}` : null,
            options.escape && options.escape !== options.quote ? `escape=${sqlLiteral(options.escape)}` : null,
            options.nullstr ? `nullstr=${sqlLiteral(options.nullstr)}` : null,
            options.encoding && options.encoding.toLowerCase() !== 'utf-8' ? `encoding=${sqlLiteral(options.encoding)}` : null,
          ].filter(Boolean)
          const optionFragment = params.length ? `, ${params.join(', ')}` : ''
          viewSql = `SELECT * FROM read_csv_auto('${fileKey}'${optionFragment})`
          await duckState.conn.query(`CREATE OR REPLACE VIEW ${quoteIdentifier(viewName)} AS ${viewSql}`)
          csvOptions = options
        } else if (ext === 'ndjson' || ext === 'jsonl' || ext === 'json') {
          const text = await file.text()
          const { ndjson, converted, error } = deriveNdjson(text)
          if (error) {
            addMessage(`${file.name}: ${error}`, 'error')
            reservedNamesRef.current.delete(viewName)
            continue
          }
          buffer = textEncoder.encode(ndjson)
          convertedFromArray = converted
          await duckState.db.registerFileText(fileKey, ndjson)
          viewSql = `SELECT * FROM read_json_auto('${fileKey}')`
          await duckState.conn.query(`CREATE OR REPLACE VIEW ${quoteIdentifier(viewName)} AS ${viewSql}`)
          if (converted) {
            addMessage(`${file.name} was converted from a JSON array to NDJSON automatically.`, 'success')
          }
        } else if (ext === 'parquet') {
          buffer = new Uint8Array(await file.arrayBuffer())
          await duckState.db.registerFileBuffer(fileKey, buffer)
          viewSql = `SELECT * FROM read_parquet('${fileKey}')`
          await duckState.conn.query(`CREATE OR REPLACE VIEW ${quoteIdentifier(viewName)} AS ${viewSql}`)
        } else {
          addMessage(`Unsupported file format: ${ext}`, 'error')
          reservedNamesRef.current.delete(viewName)
          continue
        }

        fileHandlesRef.current.set(viewName, fileKey)

        const schemaTable = await duckState.conn.query(`PRAGMA table_info(${quoteIdentifier(viewName)})`)
        const schema = schemaTable.toArray().map((row) => ({
          name: row.name,
          type: row.type,
          nullable: row.notnull === 0,
        }))
        const descriptor = {
          id: datasetId,
          viewName,
          sourceFileName: file.name,
          approxSize,
          createdAt: new Date(),
          schema,
          type: datasetType,
          csvOptions,
          convertedFromArray,
        }
        setDatasets((prev) => [...prev, descriptor])
        setSelectedDatasetId(datasetId)
        persistDataset(descriptor, buffer, viewSql)
        addMessage(`${file.name} is ready as view ${viewName}.`, 'success')
      } catch (error) {
        console.error('Failed to ingest file', error)
        reservedNamesRef.current.delete(viewName)
        addMessage(`Failed to ingest ${file.name}: ${error.message}`, 'error')
      }
    }
  }, [addMessage, csvOptions, duckState.conn, duckState.db, memoryLimitMb, persistDataset, totalDatasetSize])

  const handleFileInput = useCallback((event) => {
    const files = event.target.files
    if (files) handleFiles(files)
  }, [handleFiles])

  const removeDataset = useCallback(async (dataset) => {
    try {
      await duckState.conn.query(`DROP VIEW IF EXISTS ${quoteIdentifier(dataset.viewName)}`)
      const fileKey = fileHandlesRef.current.get(dataset.viewName)
      if (fileKey) {
        await duckState.db.dropFile(fileKey).catch(() => {})
        fileHandlesRef.current.delete(dataset.viewName)
      }
    } catch (error) {
      console.error('Failed to drop view', error)
    }
    reservedNamesRef.current.delete(dataset.viewName)
    setDatasets((prev) => prev.filter((item) => item.id !== dataset.id))
    removeDatasetFromCache(dataset.id)
    if (selectedDatasetId === dataset.id) {
      setSelectedDatasetId((prev) => {
        const remaining = datasets.filter((item) => item.id !== dataset.id)
        return remaining[0]?.id ?? null
      })
    }
  }, [duckState.conn, duckState.db, datasets, removeDatasetFromCache, selectedDatasetId])

  const sqlEditorRef = useRef(null)

  const exportResult = useCallback(async (format) => {
    if (!result || !duckState.db || !duckState.conn) {
      addMessage('No result to export yet.', 'warning')
      return
    }
    const baseName = `query-${queryStatus.startedAt ? formatDateTimeJakarta(queryStatus.startedAt).replace(/[^0-9]+/g, '-') : Date.now()}`
    try {
      if (format === 'csv') {
        const header = result.columns.map((col) => col.header).join(',')
        const rows = result.rows.map((row) => result.columns.map((col) => {
          const value = row[col.accessorKey]
          if (value === null || value === undefined) return ''
          const stringValue = typeof value === 'object' ? safeJsonStringify(value) : String(value)
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }).join(','))
        const csvContent = [header, ...rows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${baseName}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
      } else if (format === 'ndjson') {
        const ndjson = result.rows.map((row) => safeJsonStringify(row)).join('\n')
        const blob = new Blob([ndjson], { type: 'application/x-ndjson' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${baseName}.ndjson`
        link.click()
        URL.revokeObjectURL(link.href)
      } else if (format === 'parquet') {
        const tempTable = `temp_export_${Date.now()}`
        await duckState.conn.insertArrowTable(result.table, { schema: 'temp', name: tempTable })
        const exportFile = `exports/${tempTable}.parquet`
        await duckState.db.registerEmptyFileBuffer(exportFile)
        await duckState.conn.query(`COPY (SELECT * FROM temp.${quoteIdentifier(tempTable)}) TO '${exportFile}' (FORMAT 'parquet')`)
        const buffer = await duckState.db.copyFileToBuffer(exportFile)
        await duckState.db.dropFile(exportFile)
        await duckState.conn.query(`DROP TABLE IF EXISTS temp.${quoteIdentifier(tempTable)}`)
        const blob = new Blob([buffer], { type: 'application/octet-stream' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${baseName}.parquet`
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } catch (error) {
      console.error('Export failed', error)
      addMessage(`Export failed: ${error.message}`, 'error')
    }
  }, [addMessage, duckState.conn, duckState.db, queryStatus.startedAt, result])

  const runQuery = useCallback(async (overrideSql) => {
    if (!duckState.conn || !duckState.db) return
    const sqlText = (overrideSql ?? query).trim()
    if (!sqlText) {
      addMessage('Enter a SQL query to run.', 'warning')
      return
    }
    if (activeQueryRef.current?.cancel) {
      await activeQueryRef.current.cancel().catch(() => {})
    }
    const requestToken = { cancelled: false, cancel: null }
    activeQueryRef.current = requestToken
    const startedAt = new Date()
    setQueryStatus({ state: 'running', startedAt, selection: !!overrideSql })
    setResult(null)
    try {
      const parseStart = performance.now()
      await duckState.db.tokenize(sqlText)
      const parseMs = performance.now() - parseStart
      const execStart = performance.now()
      const stream = await duckState.conn.send(sqlText, true)
      requestToken.cancel = async () => {
        requestToken.cancelled = true
        await duckState.conn.cancelSent().catch(() => {})
        if (stream?.cancel) await stream.cancel().catch(() => {})
      }
      const table = await tableFromIPC(stream)
      if (requestToken.cancelled) return
      const execMs = performance.now() - execStart
      const rows = table.toArray().map((row) => ({ ...row }))
      const schema = flattenSchema(table.schema.fields)
      const columns = table.schema.fields.map((field) => ({
        header: field.name,
        accessorKey: field.name,
        cell: ({ getValue }) => formatValue(getValue()),
      }))
      const rowCount = table.numRows
      const sample = rows.slice(0, Math.min(rowCount, 1000)).map((row) => textEncoder.encode(safeJsonStringify(row)).length)
      const avg = sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : 0
      const memoryApprox = Math.round(avg * rowCount)
      const finishedAt = new Date()
      setResult({ rows, columns, table, schema, rowCount, memoryApprox })
      setQueryStatus({
        state: 'success',
        startedAt,
        finishedAt,
        parseMs,
        execMs,
        rowCount,
        memoryApprox,
      })
      const historyEntry = { id: ensureUuid(), sql: sqlText, createdAt: finishedAt.toISOString(), pinned: false }
      setHistory((prev) => [historyEntry, ...prev])
      if (onQueryExecutedRef.current) {
        onQueryExecutedRef.current({
          schema,
          rowCount,
          parseMs,
          execMs,
          memoryApprox,
          exportFns: {
            csv: () => exportResult('csv'),
            ndjson: () => exportResult('ndjson'),
            parquet: () => exportResult('parquet'),
          },
        })
      }
    } catch (error) {
      if (requestToken.cancelled) return
      console.error('Query error', error)
      const finishedAt = new Date()
      const message = error?.message || 'Unknown error'
      const match = message.match(/line (\d+), column (\d+)/i)
      let line = null
      let column = null
      if (match) {
        line = parseInt(match[1], 10)
        column = parseInt(match[2], 10)
      }
      setQueryStatus({ state: 'error', startedAt, finishedAt, message, line, column })
      addMessage(`Query failed: ${message}`, 'error')
    } finally {
      if (activeQueryRef.current === requestToken) {
        activeQueryRef.current = null
      }
    }
  }, [addMessage, duckState.conn, duckState.db, exportResult, onQueryExecutedRef, query])

  const runSelection = useCallback(() => {
    const selection = sqlEditorRef.current?.getSelection()
    if (selection && selection.trim().length > 0) runQuery(selection)
    else runQuery()
  }, [runQuery])

  const copySelectStatement = useCallback(async (viewName) => {
    try {
      await navigator.clipboard.writeText(`SELECT * FROM ${quoteIdentifier(viewName)} LIMIT 100;`)
      addMessage(`Copied SELECT template for ${viewName}.`, 'success')
    } catch (error) {
      addMessage('Clipboard copy failed. Please copy manually.', 'error')
    }
  }, [addMessage])

  const togglePinHistory = useCallback(async (entry) => {
    const next = { ...entry, pinned: !entry.pinned }
    setHistory((prev) => prev.map((item) => item.id === entry.id ? next : item))
    if (!cacheEnabled) return
    try {
      const db = await ensureDb()
      if (next.pinned) {
        await db.put(STORE_HISTORY, next)
      } else {
        await db.delete(STORE_HISTORY, next.id)
      }
    } catch (error) {
      console.error('Failed to toggle pin', error)
    }
  }, [cacheEnabled, ensureDb])

  const clearSessionHistory = useCallback(() => {
    setHistory((prev) => prev.filter((item) => item.pinned))
  }, [])

  const toggleCache = useCallback(async () => {
    const next = !cacheEnabled
    setCacheEnabled(next)
    if (!next) {
      try {
        const db = await ensureDb()
        const tx = db.transaction([STORE_DATASETS, STORE_HISTORY], 'readwrite')
        await tx.objectStore(STORE_DATASETS).clear()
        await tx.objectStore(STORE_HISTORY).clear()
        await tx.done
        addMessage('Private mode enabled. Persistent cache cleared.', 'info')
      } catch (error) {
        console.error('Failed to clear cache', error)
      }
    } else {
      addMessage('Dataset caching re-enabled. Future uploads will persist locally.', 'info')
    }
  }, [addMessage, cacheEnabled, ensureDb])

  const degraded = !!initError

  return (
    <div className='min-h-screen bg-gray-100 text-gray-900'>
      <header className='border-b-2 border-black bg-white'>
        <div className='flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-start lg:justify-between'>
          <div className='flex items-start gap-3'>
            <a
              href='/'
              className='inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-100'
            >
              <IconArrowLeft size={18} stroke={2} />
              Back to tools
            </a>
            <div>
              <h1 className='text-2xl font-semibold text-gray-900'>Query Explorer</h1>
              <p className='mt-1 text-xs text-gray-600'>Run analytical SQL queries entirely in your browser against CSV, JSON Lines, or Parquet datasets.</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <InstallPrompt />
            <a
              href='/settings'
              className='inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-100'
            >
              <IconSettings size={16} stroke={2} />
              Edit Config
            </a>
          </div>
        </div>
      </header>
      <div className='grid gap-6 px-6 py-6 lg:[grid-template-columns:320px_minmax(0,1fr)]'>
        <main className='min-w-0 overflow-x-auto pb-12 lg:col-start-2'>
          <div className='space-y-6 lg:min-w-[960px]'>
            {degraded ? (
              <section className='rounded-lg border-2 border-black bg-white p-6'>
                <div className='flex items-start gap-3'>
                  <IconAlertCircle size={20} />
                  <div>
                    <h2 className='text-lg font-semibold text-gray-900'>DuckDB is unavailable</h2>
                    <p className='mt-2 text-sm text-gray-600'>The WebAssembly database engine could not be initialised. Reload the page to retry. No partial state has been kept.</p>
                    <button
                      type='button'
                      onClick={() => window.location.reload()}
                      className='mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-black bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-black'
                    >
                      <IconRefresh size={16} />
                      Reload tab
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
                  <div className='flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700'>
                      <IconDatabaseImport size={16} />
                      Datasets
                    </h2>
                    <div className='flex flex-wrap items-center gap-3 text-xs text-gray-600'>
                      <span>Total size {formatBytes(totalDatasetSize)}</span>
                      <span>Memory budget {memoryLimitMb} MB</span>
                    </div>
                  </div>
                  <div className='space-y-4 px-4 py-4'>
                    {loadingFromCache && (
                      <p className='text-sm text-gray-600'>Restoring cached datasets...</p>
                    )}
                    {datasets.length === 0 && (
                      <p className='rounded-md border-2 border-dashed border-black px-4 py-3 text-sm text-gray-600'>
                        No datasets yet. Use the upload panel to register a file.
                      </p>
                    )}
                    {datasets.length > 0 && (
                      <ul className='space-y-3' role='list'>
                        {datasets.map((dataset) => {
                          const isActive = selectedDatasetId === dataset.id
                          return (
                            <li key={dataset.id}>
                              <article
                                className={`rounded-lg border-2 px-3 py-3 transition-colors ${
                                  isActive ? 'border-black bg-gray-200' : 'border-black bg-white hover:bg-gray-100'
                                }`}
                              >
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                  <button
                                    type='button'
                                    className='text-left'
                                    onClick={() => setSelectedDatasetId(dataset.id)}
                                    aria-pressed={isActive}
                                  >
                                    <h3 className='text-sm font-semibold text-gray-900'>{dataset.viewName}</h3>
                                    <p className='mt-1 text-xs text-gray-600'>
                                      {dataset.sourceFileName} · {formatBytes(dataset.approxSize)} · {formatDateTimeJakarta(dataset.createdAt)}
                                    </p>
                                  </button>
                                  <div className='flex items-center gap-2'>
                                    <span className='rounded-full border-2 border-black px-2 py-0.5 text-[11px] uppercase text-gray-700'>{dataset.type}</span>
                                    <button
                                      type='button'
                                      onClick={() => copySelectStatement(dataset.viewName)}
                                      className='inline-flex items-center gap-1 rounded-md border-2 border-black px-2 py-1 text-xs text-gray-900 hover:bg-gray-100'
                                    >
                                      <IconClipboard size={14} />
                                      Copy
                                    </button>
                                    <button
                                      type='button'
                                      onClick={() => removeDataset(dataset)}
                                      className='inline-flex items-center gap-1 rounded-md border-2 border-black px-2 py-1 text-xs text-gray-900 hover:bg-gray-100'
                                    >
                                      <IconTrash size={14} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </article>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {datasets.length > 0 && !selectedDatasetId && (
                      <p className='rounded-md border-2 border-dashed border-black px-4 py-3 text-xs text-gray-600'>
                        Select a dataset to inspect its schema.
                      </p>
                    )}
                  </div>
                </section>

                <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
                  <div className='flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700'>
                      <IconPlayerPlay size={16} />
                      SQL Query
                    </h2>
                    <div className='flex flex-wrap items-center gap-2'>
                      <button
                        type='button'
                        onClick={() => runQuery()}
                        className='inline-flex items-center gap-2 rounded-md border-2 border-black bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50'
                        disabled={queryStatus.state === 'running'}
                      >
                        <IconPlayerPlay size={16} />
                        Run
                      </button>
                      <button
                        type='button'
                        onClick={runSelection}
                        className='inline-flex items-center gap-2 rounded-md border-2 border-black bg-gray-100 px-3 py-2 text-sm text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50'
                        disabled={queryStatus.state === 'running'}
                      >
                        <IconPlayerPlay size={16} />
                        Run selection
                      </button>
                    </div>
                  </div>
                  <p className='px-4 pt-4 text-xs text-gray-600'>
                    Editor supports keyboard shortcuts. Press Cmd/Ctrl + Enter to execute the entire query or Shift + Cmd/Ctrl + Enter for the selection.
                  </p>
                  <div className='px-4 pb-4'>
                    <SqlEditor
                      ref={sqlEditorRef}
                      value={query}
                      onChange={setQuery}
                      onRun={() => runQuery()}
                      onRunSelection={runSelection}
                    />
                  </div>
                </section>

                <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
                  <div className='flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700'>
                      <IconPlayerPlay size={16} />
                      Query result
                    </h2>
                    {result && (
                      <div className='flex flex-wrap items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => exportResult('csv')}
                          className='inline-flex items-center gap-2 rounded-md border-2 border-black px-3 py-1.5 text-xs text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                          disabled={queryStatus.state !== 'success'}
                        >
                          <IconDownload size={14} />
                          CSV
                        </button>
                        <button
                          type='button'
                          onClick={() => exportResult('ndjson')}
                          className='inline-flex items-center gap-2 rounded-md border-2 border-black px-3 py-1.5 text-xs text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                          disabled={queryStatus.state !== 'success'}
                        >
                          <IconDownload size={14} />
                          NDJSON
                        </button>
                        <button
                          type='button'
                          onClick={() => exportResult('parquet')}
                          className='inline-flex items-center gap-2 rounded-md border-2 border-black px-3 py-1.5 text-xs text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                          disabled={queryStatus.state !== 'success'}
                        >
                          <IconDownload size={14} />
                          Parquet
                        </button>
                      </div>
                    )}
                  </div>
                  <div className='space-y-4 px-4 py-4'>
                    <div>
                      <h3 className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700'>
                        <IconClock size={16} />
                        Execution status
                      </h3>
                      {queryStatus.state === 'idle' && <p className='mt-2 text-sm text-gray-600'>Waiting for a query.</p>}
                      {queryStatus.state === 'running' && queryStatus.startedAt && (
                        <p className='mt-2 text-sm text-gray-600'>Query running... started at {formatDateTimeJakarta(queryStatus.startedAt)}</p>
                      )}
                      {queryStatus.state === 'success' && (
                        <dl className='mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700 md:grid-cols-4'>
                          <div>
                            <dt className='text-gray-500'>Started</dt>
                            <dd className='font-semibold text-gray-900'>{formatDateTimeJakarta(queryStatus.startedAt)}</dd>
                          </div>
                          <div>
                            <dt className='text-gray-500'>Finished</dt>
                            <dd className='font-semibold text-gray-900'>{formatDateTimeJakarta(queryStatus.finishedAt)}</dd>
                          </div>
                          <div>
                            <dt className='text-gray-500'>Parse time</dt>
                            <dd className='font-semibold text-gray-900'>{queryStatus.parseMs.toFixed(2)} ms</dd>
                          </div>
                          <div>
                            <dt className='text-gray-500'>Execution time</dt>
                            <dd className='font-semibold text-gray-900'>{queryStatus.execMs.toFixed(2)} ms</dd>
                          </div>
                          <div>
                            <dt className='text-gray-500'>Rows</dt>
                            <dd className='font-semibold text-gray-900'>{queryStatus.rowCount.toLocaleString('en-US')}</dd>
                          </div>
                          <div>
                            <dt className='text-gray-500'>Memory approx</dt>
                            <dd className='font-semibold text-gray-900'>{formatBytes(queryStatus.memoryApprox)}</dd>
                          </div>
                        </dl>
                      )}
                      {queryStatus.state === 'error' && queryStatus.finishedAt && (
                        <div className='mt-3 rounded-md border-2 border-black bg-gray-100 px-3 py-3 text-sm text-gray-700'>
                          <p>Query failed at {formatDateTimeJakarta(queryStatus.finishedAt)}.</p>
                          <p className='mt-1'>Message: {queryStatus.message}</p>
                          {typeof queryStatus.line === 'number' && (
                            <p className='mt-1'>Line {queryStatus.line}, column {queryStatus.column}</p>
                          )}
                        </div>
                      )}
                    </div>
                    {result ? (
                      <VirtualTable columns={result.columns} data={result.rows} height={360} />
                    ) : (
                      <p className='text-sm text-gray-600'>Run a query to view results.</p>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
        <aside className='space-y-4 lg:col-start-1 lg:row-start-1'>
          <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('uploads')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
            >
              <span className='flex items-center gap-2'>
                <IconDatabaseImport size={16} />
                Files
              </span>
              {sidebarSections.uploads ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.uploads && (
              <div className='space-y-4 px-4 pb-4 pt-3 text-xs text-gray-600'>
                <p>Upload files to make them available as read-only DuckDB views.</p>
                <label className='flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-black bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-white'>
                  <IconDatabaseImport size={16} />
                  <span>Upload files</span>
                  <input
                    type='file'
                    className='hidden'
                    multiple
                    accept='.csv,.tsv,.txt,.ndjson,.jsonl,.json,.parquet'
                    onChange={handleFileInput}
                  />
                </label>
                <div className='space-y-3'>
                  <div className='flex justify-between text-gray-700'>
                    <span>Total size</span>
                    <span className='font-semibold text-gray-900'>{formatBytes(totalDatasetSize)}</span>
                  </div>
                  <div className='flex items-center justify-between gap-2 text-gray-700'>
                    <label htmlFor='memoryLimit' className='text-gray-700'>Memory budget</label>
                    <div className='flex items-center gap-2'>
                      <input
                        id='memoryLimit'
                        type='number'
                        min={64}
                        step={64}
                        value={memoryLimitMb}
                        onChange={(event) => setMemoryLimitMb(Number(event.target.value))}
                        className='w-24 rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-right text-gray-900'
                      />
                      <span>MB</span>
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={toggleCache}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-xs font-medium ${
                      cacheEnabled
                        ? 'border-black bg-gray-100 text-gray-900 hover:bg-gray-200'
                        : 'border-black bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {cacheEnabled ? <IconCloudOff size={16} /> : <IconRestore size={16} />}
                    {cacheEnabled ? 'Enable private mode' : 'Re-enable cache'}
                  </button>
                </div>
                <details className='rounded-md border-2 border-dashed border-black px-3 py-2 text-gray-700'>
                  <summary className='cursor-pointer text-sm font-semibold text-gray-700'>Advanced CSV options</summary>
                  <div className='mt-3 grid grid-cols-1 gap-3'>
                    <label className='flex flex-col gap-1'>
                      <span>Delimiter</span>
                      <input
                        type='text'
                        maxLength={1}
                        value={csvOptions.delimiter}
                        onChange={(event) => setCsvOptions((prev) => ({ ...prev, delimiter: event.target.value || ',' }))}
                        className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900'
                      />
                    </label>
                    <label className='flex flex-col gap-1'>
                      <span>Encoding</span>
                      <input
                        type='text'
                        value={csvOptions.encoding}
                        onChange={(event) => setCsvOptions((prev) => ({ ...prev, encoding: event.target.value || 'utf-8' }))}
                        className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900'
                      />
                    </label>
                    <label className='flex flex-col gap-1'>
                      <span>Quote</span>
                      <input
                        type='text'
                        maxLength={1}
                        value={csvOptions.quote}
                        onChange={(event) => setCsvOptions((prev) => ({ ...prev, quote: event.target.value || '"' }))}
                        className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900'
                      />
                    </label>
                    <label className='flex flex-col gap-1'>
                      <span>Escape</span>
                      <input
                        type='text'
                        maxLength={1}
                        value={csvOptions.escape}
                        onChange={(event) => setCsvOptions((prev) => ({ ...prev, escape: event.target.value || prev.quote }))}
                        className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900'
                      />
                    </label>
                    <label className='flex items-center gap-2'>
                      <input
                        type='checkbox'
                        checked={csvOptions.header}
                        onChange={(event) => setCsvOptions((prev) => ({ ...prev, header: event.target.checked }))}
                        className='h-4 w-4 border-2 border-black bg-gray-100 text-gray-900'
                      />
                      <span>Header row present</span>
                    </label>
                    <label className='flex flex-col gap-1'>
                      <span>Null string</span>
                      <input
                        type='text'
                        value={csvOptions.nullstr}
                        onChange={(event) => setCsvOptions((prev) => ({ ...prev, nullstr: event.target.value }))}
                        className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900'
                      />
                    </label>
                  </div>
                  <p className='mt-2 text-xs text-gray-500'>These defaults apply to future CSV uploads. TSV files automatically use tab delimiters.</p>
                </details>
              </div>
            )}
          </section>

          <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('columns')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
            >
              <span className='flex items-center gap-2'>
                <IconColumns3 size={16} />
                Columns
              </span>
              {sidebarSections.columns ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.columns && (
              <div className='space-y-3 px-4 pb-4 pt-3 text-xs text-gray-600'>
                {!selectedDataset && <p>Select a dataset to inspect its columns.</p>}
                {selectedDataset && (
                  <>
                    <p>
                      Columns for <span className='font-semibold text-gray-900'>{selectedDataset.viewName}</span>.
                    </p>
                    <ul className='divide-y divide-gray-300 rounded-md border-2 border-black'>
                      {selectedDataset.schema.map((column) => (
                        <li key={column.name} className='flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700'>
                          <span className='font-medium text-gray-900'>{column.name}</span>
                          <span className='text-xs uppercase text-gray-600'>{column.type}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>

          <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('history')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
            >
              <span className='flex items-center gap-2'>
                <IconHistory size={16} />
                History
              </span>
              {sidebarSections.history ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.history && (
              <div className='space-y-3 px-4 pb-4 pt-3 text-xs text-gray-600'>
                <div className='flex items-center justify-between'>
                  <span>{history.length === 0 ? 'No queries yet.' : `${history.length} entr${history.length === 1 ? 'y' : 'ies'}.`}</span>
                  {history.some((entry) => !entry.pinned) && (
                    <button
                      type='button'
                      onClick={clearSessionHistory}
                      className='inline-flex items-center gap-1 rounded-md border-2 border-black px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100'
                    >
                      Clear session
                    </button>
                  )}
                </div>
                {history.length > 0 && (
                  <ul className='space-y-2'>
                    {history.map((entry) => (
                      <li key={entry.id} className='rounded-md border-2 border-black bg-gray-100 p-3'>
                        <div className='flex items-start justify-between gap-3'>
                          <button
                            type='button'
                            className='flex-1 text-left text-gray-900 hover:text-gray-700'
                            onClick={() => {
                              setQuery(entry.sql)
                              sqlEditorRef.current?.focus()
                            }}
                          >
                            <p className='truncate text-sm font-semibold text-gray-900'>{entry.sql.slice(0, 160) || 'Empty query'}</p>
                            <p className='mt-1 text-[11px] text-gray-500'>{formatDateTimeJakarta(new Date(entry.createdAt))}</p>
                          </button>
                          <button
                            type='button'
                            onClick={() => togglePinHistory(entry)}
                            className='inline-flex items-center gap-1 rounded-md border-2 border-black px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-200'
                          >
                            {entry.pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
                            {entry.pinned ? 'Pinned' : 'Pin'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className='overflow-hidden rounded-lg border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('notifications')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
            >
              <span className='flex items-center gap-2'>
                <IconAlertCircle size={16} />
                Notifications
              </span>
              {sidebarSections.notifications ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.notifications && (
              <div className='space-y-3 px-4 pb-4 pt-3 text-xs text-gray-600'>
                {messages.length === 0 && <p>No messages.</p>}
                {messages.length > 0 && (
                  <ul className='space-y-2'>
                    {messages.map((message) => (
                      <li key={message.id} className='flex items-start justify-between gap-3 rounded-md border-2 border-black bg-gray-100 px-3 py-2 text-sm text-gray-700'>
                        <span>{message.content}</span>
                        <button
                          type='button'
                          onClick={() => removeMessage(message.id)}
                          className='text-[11px] text-gray-600 underline hover:text-gray-700'
                        >
                          Dismiss
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )

}

export default QueryExplorer
