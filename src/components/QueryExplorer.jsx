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
  IconRestore,
  IconCloudOff,
  IconRefresh,
  IconClipboard,
  IconClock,
  IconChevronDown,
  IconChevronRight,
  IconColumns3,
  IconBraces,
  IconTextWrap,
  IconSearch,
  IconArrowUp,
  IconTable,
} from '@tabler/icons-react'
import { keymap as cmKeymap } from '@codemirror/view'
import * as duckdb from '@duckdb/duckdb-wasm'
import { tableFromIPC } from 'apache-arrow'
import duckdbMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdbEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdbWorkerMvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbWorkerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { openDB } from 'idb'
import { format as formatSqlText } from 'sql-formatter'
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
const DB_VERSION = 2
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

const MAX_HISTORY_ENTRIES = 20
const COLUMNS_PER_PAGE = 30
const COLUMN_SCROLL_THRESHOLD = 240

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

const DEFAULT_FEATURE_FLAGS = {
  enableSqlAutocomplete: true,
}

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'CROSS JOIN',
  'ON',
  'USING',
  'WITH',
  'INSERT INTO',
  'CREATE TABLE',
  'CREATE VIEW',
  'DROP TABLE',
  'DROP VIEW',
  'UPDATE',
  'DELETE',
  'VALUES',
  'UNION',
  'EXCEPT',
  'INTERSECT',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
]

const DUCKDB_FUNCTIONS = [
  {
    name: 'date_trunc',
    snippet: 'date_trunc(${1:unit}, ${2:timestamp_expression})',
    detail: 'date_trunc(unit, timestamp)',
    documentation: 'Truncate the given timestamp to the specified unit such as hour, day, or month.',
  },
  {
    name: 'extract',
    snippet: 'extract(${1:field} FROM ${2:source})',
    detail: 'extract(field FROM source)',
    documentation: 'Extract a component such as year or month from a date, time, or interval.',
  },
  {
    name: 'json_extract',
    snippet: "json_extract(${1:json}, '${2:path}')",
    detail: "json_extract(json, 'path')",
    documentation: 'Return a JSON value located at the given path using JSON pointer syntax.',
  },
  {
    name: 'quantile',
    snippet: 'quantile(${1:expression}, ${2:quantile})',
    detail: 'quantile(expression, q)',
    documentation: 'Compute the approximate quantile of an expression using the t-digest algorithm.',
  },
  {
    name: 'avg',
    snippet: 'avg(${1:expression})',
    detail: 'avg(expression)',
    documentation: 'Return the arithmetic mean of the given numeric expression.',
  },
  {
    name: 'count',
    snippet: 'count(${1:expression})',
    detail: 'count(expression)',
    documentation: 'Count the number of input rows, or non-null values if an expression is provided.',
  },
  {
    name: 'sum',
    snippet: 'sum(${1:expression})',
    detail: 'sum(expression)',
    documentation: 'Return the sum of the values of the given numeric expression.',
  },
  {
    name: 'min',
    snippet: 'min(${1:expression})',
    detail: 'min(expression)',
    documentation: 'Return the smallest value from the input expression.',
  },
  {
    name: 'max',
    snippet: 'max(${1:expression})',
    detail: 'max(expression)',
    documentation: 'Return the largest value from the input expression.',
  },
  {
    name: 'stddev_pop',
    snippet: 'stddev_pop(${1:expression})',
    detail: 'stddev_pop(expression)',
    documentation: 'Calculate the population standard deviation of the input expression.',
  },
]

const stripQuotes = (value) => {
  if (typeof value !== 'string') return value
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('`') && value.endsWith('`'))) {
    return value.slice(1, -1)
  }
  return value
}

const needsQuoting = (value) => {
  if (!value) return false
  return !/^[a-z_][a-z0-9_]*$/.test(value)
}

const normalizeIdentifierForLookup = (value) => {
  if (!value) return ''
  const plain = stripQuotes(value)
  return plain.replace(/[^a-z0-9]+/gi, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '').toLowerCase()
}

const buildSearchKeys = (value, schema = null) => {
  const plain = stripQuotes(value)
  const snake = plain.replace(/[^a-z0-9]+/gi, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '')
  const keys = new Set([plain, plain.toLowerCase(), snake.toLowerCase()])
  if (schema) {
    keys.add(`${schema}.${plain}`.toLowerCase())
    keys.add(`${schema}_${snake}`.toLowerCase())
  }
  return Array.from(keys)
}

const computeFuzzyScore = (query, target) => {
  if (!query) return 0
  if (!target) return -Infinity
  if (target.startsWith(query)) {
    return 200 - target.length
  }
  let score = 0
  let lastIndex = -1
  const lowerTarget = target.toLowerCase()
  for (let i = 0; i < query.length; i += 1) {
    const ch = query[i]
    const idx = lowerTarget.indexOf(ch, lastIndex + 1)
    if (idx === -1) return -Infinity
    const distance = idx - lastIndex
    score += Math.max(1, 6 - distance)
    lastIndex = idx
  }
  return score
}

const limitOptions = (options, limit = 50) => options.slice(0, limit)

const resolveTableKey = (rawName, lookup) => {
  if (!rawName) return null
  const plain = stripQuotes(rawName)
  const direct = lookup[normalizeIdentifierForLookup(plain)]
  if (direct) return direct
  if (plain.includes('.')) {
    const [schema, table] = plain.split('.')
    const schemaKey = normalizeIdentifierForLookup(schema)
    const tableKey = normalizeIdentifierForLookup(table)
    const combined = lookup[`${schemaKey}.${tableKey}`]
    if (combined) return combined
    const schemaCombined = lookup[normalizeIdentifierForLookup(`${schema}.${table}`)]
    if (schemaCombined) return schemaCombined
  }
  const fallback = plain.split('.').pop()
  if (!fallback) return null
  return lookup[normalizeIdentifierForLookup(fallback)] ?? null
}

const splitSqlStatements = (sql) => {
  const statements = []
  if (!sql) return statements
  let start = 0
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]
    const prev = sql[i - 1]
    if (ch === "'" && !inDouble) {
      const escaped = prev === "'"
      if (!escaped) inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      const escaped = prev === '"'
      if (!escaped) inDouble = !inDouble
    } else if (ch === ';' && !inSingle && !inDouble) {
      statements.push({ start, end: i + 1 })
      start = i + 1
    }
  }
  if (start < sql.length) {
    statements.push({ start, end: sql.length })
  }
  return statements
}

const findStatementRange = (sql, cursor) => {
  const segments = splitSqlStatements(sql)
  if (segments.length === 0) {
    return { start: 0, end: sql.length }
  }
  return segments.find((segment) => cursor >= segment.start && cursor <= segment.end) || segments[segments.length - 1]
}

const findLastClause = (text) => {
  if (!text) return null
  const lower = text.toLowerCase()
  const clauses = [
    'select',
    'where',
    'group by',
    'order by',
    'having',
    'on',
    'using',
    'from',
    'join',
    'update',
    'into',
  ]
  let best = null
  let bestIndex = -1
  clauses.forEach((clause) => {
    const idx = lower.lastIndexOf(clause)
    if (idx > bestIndex) {
      best = clause
      bestIndex = idx
    }
  })
  return best
}

const extractAliasContext = (sql, cursor, schemaState) => {
  if (!sql) {
    return {
      aliases: {},
      tablesInScope: [],
      lastTableKey: null,
      statementRange: { start: 0, end: 0 },
      beforeCursor: '',
    }
  }
  const range = findStatementRange(sql, cursor)
  const statementText = sql.slice(range.start, range.end)
  const beforeCursor = sql.slice(range.start, cursor)
  const aliasMap = {}
  const tablesInScope = []
  let lastTableKey = null
  const tableRegex = /\b(from|join|update|into)\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-zA-Z_][\w$\.]*)?)(?:\s+(?:as\s+)?([a-zA-Z_][\w$]*))?/gi
  let match
  while ((match = tableRegex.exec(statementText))) {
    const tableRaw = (match[2] || '').trim()
    const aliasRaw = match[3]
    const tableKey = resolveTableKey(tableRaw, schemaState.tableLookup) || resolveTableKey(aliasRaw, schemaState.tableLookup)
    if (tableKey && !tablesInScope.includes(tableKey)) {
      tablesInScope.push(tableKey)
      lastTableKey = tableKey
    }
    if (aliasRaw) {
      aliasMap[normalizeIdentifierForLookup(aliasRaw)] = {
        target: tableKey,
        source: tableRaw || aliasRaw,
        type: 'table',
      }
    }
  }
  const cteRegex = /\bwith\s+([a-zA-Z_][\w$]*)\s+as\s*\(/gi
  while ((match = cteRegex.exec(statementText))) {
    const alias = match[1]
    aliasMap[normalizeIdentifierForLookup(alias)] = {
      target: null,
      source: alias,
      type: 'cte',
    }
  }
  const subqueryRegex = /\)\s+([a-zA-Z_][\w$]*)/gi
  while ((match = subqueryRegex.exec(statementText))) {
    const alias = match[1]
    if (!aliasMap[normalizeIdentifierForLookup(alias)]) {
      aliasMap[normalizeIdentifierForLookup(alias)] = {
        target: null,
        source: alias,
        type: 'subquery',
      }
    }
  }
  return {
    aliases: aliasMap,
    tablesInScope,
    lastTableKey,
    statementRange: range,
    beforeCursor,
  }
}

const createIndexedDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      let datasetStore
      if (db.objectStoreNames.contains(STORE_DATASETS)) {
        datasetStore = transaction.objectStore(STORE_DATASETS)
      } else {
        datasetStore = db.createObjectStore(STORE_DATASETS, { keyPath: 'id' })
      }
      if (datasetStore && !datasetStore.indexNames.contains('viewName')) {
        datasetStore.createIndex('viewName', 'viewName', { unique: true })
      }

      let historyStore
      if (db.objectStoreNames.contains(STORE_HISTORY)) {
        historyStore = transaction.objectStore(STORE_HISTORY)
      } else {
        historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' })
      }

      if (historyStore.indexNames.contains('pinned')) {
        historyStore.deleteIndex('pinned')
      }
      if (!historyStore.indexNames.contains('createdAt')) {
        historyStore.createIndex('createdAt', 'createdAt', { unique: false })
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
  const render = (text, className = '') => (
    <span
      className={`block max-w-[20rem] truncate whitespace-nowrap ${className}`.trim()}
      title={text}
    >
      {text}
    </span>
  )

  if (value === null || value === undefined) {
    return render('NULL', 'text-gray-500')
  }
  if (value instanceof Uint8Array) {
    const hex = `0x${Array.from(value).map((x) => x.toString(16).padStart(2, '0')).join('')}`
    return render(hex)
  }
  if (Array.isArray(value)) {
    const text = safeJsonStringify(value)
    return render(text)
  }
  if (typeof value === 'object') {
    const text = safeJsonStringify(value)
    return render(text)
  }
  const text = String(value)
  return render(text)
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
  const [expandedHistoryId, setExpandedHistoryId] = useState(null)
  const [cacheEnabled, setCacheEnabled] = useState(true)
  const [loadingFromCache, setLoadingFromCache] = useState(false)
  const [memoryLimitMb, setMemoryLimitMb] = useState(DEFAULT_MEMORY_LIMIT_MB)
  const [messages, setMessages] = useState([])
  const [wrapEnabled, setWrapEnabled] = useState(false)
  const [selectionText, setSelectionText] = useState('')
  const [cursorState, setCursorState] = useState({ head: 0, anchor: 0 })
  const [columnSearch, setColumnSearch] = useState('')
  const [openColumnGroups, setOpenColumnGroups] = useState({})
  const [columnPageByType, setColumnPageByType] = useState({})
  const [columnScrollTop, setColumnScrollTop] = useState(0)
  const [uploadOpen, setUploadOpen] = useState(true)
  const [sidebarSections, setSidebarSections] = useState({
    columns: true,
    history: true,
    notifications: true,
  })
  const [errorCopyStatus, setErrorCopyStatus] = useState('idle')
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
  const columnsPanelRef = useRef(null)
  const datasetReadyMessageIds = useRef(new Set())
  const lastSuccessfulQueryRef = useRef('')
  const featureFlags = useMemo(() => DEFAULT_FEATURE_FLAGS, [])
  const [schemaCache, setSchemaCache] = useState(() => ({
    status: 'idle',
    stale: false,
    error: null,
    tables: [],
    columnsByTable: {},
    tableLookup: {},
    aliases: {},
    functions: DUCKDB_FUNCTIONS.map((fn) => ({ ...fn, searchKeys: buildSearchKeys(fn.name) })),
    keywords: SQL_KEYWORDS.map((keyword) => ({
      name: keyword,
      searchKeys: buildSearchKeys(keyword),
    })),
    lastFingerprint: null,
  }))
  const [schemaScope, setSchemaScope] = useState({ tablesInScope: [], lastTableKey: null, statementRange: null })
  const [editorExtraExtensions, setEditorExtraExtensions] = useState([])
  const schemaCacheRef = useRef(schemaCache)
  const schemaScopeRef = useRef(schemaScope)
  const cursorStateRef = useRef(cursorState)
  const schemaRefreshTimerRef = useRef(null)
  const autocompleteModulesRef = useRef(null)
  const completionSourceRef = useRef(() => null)
  const functionCompletionCacheRef = useRef(new Map())
  const keywordOptionCacheRef = useRef(new Map())
  const aliasDebounceRef = useRef(null)
  const ensureAutocomplete = useCallback(async () => {
    if (!featureFlags.enableSqlAutocomplete) return
    if (autocompleteModulesRef.current) return
    const mod = await import('@codemirror/autocomplete')
    autocompleteModulesRef.current = mod
    setEditorExtraExtensions((prev) => {
      if (prev.length > 0) return prev
      const dynamicSource = (context) => completionSourceRef.current(context)
      return [
        mod.autocompletion({
          override: [dynamicSource],
          activateOnTyping: true,
          closeOnBlur: false,
        }),
        cmKeymap.of(mod.completionKeymap),
      ]
    })
  }, [featureFlags.enableSqlAutocomplete])

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

  const datasetFingerprint = useMemo(() => {
    if (datasets.length === 0) return 'empty'
    return datasets
      .map((ds) => `${ds.viewName}:${ds.schema?.length ?? 0}:${ds.createdAt instanceof Date ? ds.createdAt.getTime() : 0}`)
      .sort()
      .join('|')
  }, [datasets])

  const addMessage = useCallback((content, tone = 'info') => {
    const entry = { id: ensureUuid(), content, tone }
    setMessages((prev) => [...prev, entry])
    return entry.id
  }, [])

  const removeMessage = useCallback((id) => {
    datasetReadyMessageIds.current.delete(id)
    setMessages((prev) => prev.filter((msg) => msg.id !== id))
  }, [])

  const refreshSchemaMetadata = useCallback(
    async ({ reason = 'auto', silent = false } = {}) => {
      if (!featureFlags.enableSqlAutocomplete) return
      if (!duckState.conn) return
      if (schemaRefreshTimerRef.current) {
        window.clearTimeout(schemaRefreshTimerRef.current)
        schemaRefreshTimerRef.current = null
      }
      setSchemaCache((prev) => ({
        ...prev,
        status: silent ? prev.status : 'loading',
        stale: false,
        error: silent ? prev.error : null,
      }))
      try {
        const tablesResult = await duckState.conn.query(`
          SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
          ORDER BY table_schema, table_name
        `)
        const columnsResult = await duckState.conn.query(`
          SELECT table_schema, table_name, column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
          ORDER BY table_schema, ordinal_position
        `)
        const tableRows = tablesResult.toArray()
        const columnRows = columnsResult.toArray()
        const tableLookup = {}
        const columnsByTable = {}
        const tables = tableRows.map((row) => {
          const schemaName = stripQuotes(row.table_schema || 'main')
          const tableName = stripQuotes(row.table_name)
          const normalizedSchema = normalizeIdentifierForLookup(schemaName) || 'main'
          const normalizedTable = normalizeIdentifierForLookup(tableName)
          const key = `${normalizedSchema}.${normalizedTable}`
          const requiresSchema = normalizedSchema !== 'main'
          const quotedSchema = needsQuoting(schemaName) ? quoteIdentifier(schemaName) : schemaName
          const quotedTable = needsQuoting(tableName) ? quoteIdentifier(tableName) : tableName
          const applyName = requiresSchema ? `${quotedSchema}.${quotedTable}` : quotedTable
          const displayName = requiresSchema ? `${schemaName}.${tableName}` : tableName
          buildSearchKeys(tableName, requiresSchema ? schemaName : null).forEach((searchKey) => {
            tableLookup[normalizeIdentifierForLookup(searchKey)] = key
          })
          tableLookup[`${normalizedSchema}.${normalizedTable}`] = key
          columnsByTable[key] = []
          const tableType = String(row.table_type || '').toLowerCase().includes('view') ? 'view' : 'table'
          return {
            key,
            schema: schemaName,
            name: tableName,
            displayName,
            apply: applyName,
            type: tableType,
            searchKeys: buildSearchKeys(tableName, requiresSchema ? schemaName : null),
          }
        })
        columnRows.forEach((row) => {
          const schemaName = stripQuotes(row.table_schema || 'main')
          const tableName = stripQuotes(row.table_name)
          const normalizedSchema = normalizeIdentifierForLookup(schemaName) || 'main'
          const normalizedTable = normalizeIdentifierForLookup(tableName)
          const key = `${normalizedSchema}.${normalizedTable}`
          if (!columnsByTable[key]) return
          const columnName = stripQuotes(row.column_name)
          const quotedColumn = needsQuoting(columnName) ? quoteIdentifier(columnName) : columnName
          columnsByTable[key].push({
            name: columnName,
            quoted: quotedColumn,
            apply: quotedColumn,
            type: row.data_type,
            nullable: typeof row.is_nullable === 'string' ? row.is_nullable.toLowerCase() !== 'no' : row.is_nullable !== false,
            searchKeys: buildSearchKeys(columnName),
            lower: columnName.toLowerCase(),
          })
        })
        Object.values(columnsByTable).forEach((cols) => {
          cols.sort((a, b) => a.name.localeCompare(b.name))
        })
        setSchemaCache((prev) => ({
          ...prev,
          status: 'ready',
          stale: false,
          error: null,
          tables,
          columnsByTable,
          tableLookup,
          aliases: {},
          lastFingerprint: datasetFingerprint,
        }))
      } catch (error) {
        console.error('Schema metadata refresh failed', reason, error)
        setSchemaCache((prev) => ({
          ...prev,
          status: 'error',
          stale: true,
          error: error?.message || 'Failed to refresh schema metadata.',
        }))
      }
    },
    [datasetFingerprint, duckState.conn, featureFlags.enableSqlAutocomplete],
  )

  const scheduleSchemaRefresh = useCallback(
    (reason = 'auto', { immediate = false, force = false, silent = false } = {}) => {
      if (!featureFlags.enableSqlAutocomplete) return
      if (!duckState.conn) return
      const fingerprintMatches = schemaCacheRef.current.lastFingerprint === datasetFingerprint
      if (!force && !immediate && fingerprintMatches && schemaCacheRef.current.status === 'ready') {
        return
      }
      if (schemaRefreshTimerRef.current) {
        window.clearTimeout(schemaRefreshTimerRef.current)
        schemaRefreshTimerRef.current = null
      }
      if (immediate) {
        refreshSchemaMetadata({ reason, silent })
        return
      }
      setSchemaCache((prev) => ({
        ...prev,
        stale: true,
      }))
      schemaRefreshTimerRef.current = window.setTimeout(() => {
        schemaRefreshTimerRef.current = null
        refreshSchemaMetadata({ reason, silent })
      }, 400)
    },
    [datasetFingerprint, duckState.conn, featureFlags.enableSqlAutocomplete, refreshSchemaMetadata],
  )

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
    if (!featureFlags.enableSqlAutocomplete) return
    if (!duckState.conn) return
    scheduleSchemaRefresh('init', { immediate: true, silent: true })
  }, [duckState.conn, featureFlags.enableSqlAutocomplete, scheduleSchemaRefresh])

  useEffect(() => {
    if (!featureFlags.enableSqlAutocomplete) return
    if (!duckState.conn) return
    scheduleSchemaRefresh('fingerprint', { silent: true })
  }, [datasetFingerprint, duckState.conn, featureFlags.enableSqlAutocomplete, scheduleSchemaRefresh])

  useEffect(() => {
    if (!featureFlags.enableSqlAutocomplete) {
      setEditorExtraExtensions([])
    }
  }, [featureFlags.enableSqlAutocomplete])

  useEffect(() => {
    completionSourceRef.current = (context) => {
      if (!featureFlags.enableSqlAutocomplete) return null
      const modules = autocompleteModulesRef.current
      if (!modules) return null
      const schemaState = schemaCacheRef.current
      if (!schemaState) return null
      const scopeState = schemaScopeRef.current
      const doc = context.state.doc
      const pos = context.pos
      const snippet = doc.sliceString(Math.max(0, pos - 200), pos)
      const dotMatch = snippet.match(/([A-Za-z_][\w$]*|"[^"]+")\.([A-Za-z_0-9$]*)$/)
      const wordMatch = context.matchBefore(/[\w$]+/)
      let from = wordMatch ? wordMatch.from : pos
      let typed = wordMatch ? wordMatch.text : ''

      const unique = new Map()
      const addOption = (option) => {
        if (!option) return
        const key = `${option.section || 'default'}::${option.label}::${option.apply || option.label}`
        const existing = unique.get(key)
        if (!existing || (option.boost || 0) > (existing.boost || 0)) {
          unique.set(key, option)
        }
      }

      const buildColumnOptions = (columns, baseBoost, infoLabel, filterQuery) => {
        if (!columns || columns.length === 0) return
        const q = (filterQuery ?? '').toLowerCase()
        columns.forEach((column) => {
          let score = 0
          if (q) {
            const best = column.searchKeys.reduce((acc, key) => {
              const candidate = computeFuzzyScore(q, key)
              return candidate > acc ? candidate : acc
            }, -Infinity)
            if (best === -Infinity) return
            score = best
          }
          addOption({
            label: column.name,
            apply: column.apply,
            type: 'property',
            detail: column.type,
            section: 'Columns',
            info: infoLabel ? `${infoLabel} · ${column.type}` : column.type,
            boost: baseBoost + score,
          })
        })
      }

      const buildTableOptions = (filterQuery, baseBoost) => {
        const q = filterQuery.toLowerCase()
        schemaState.tables.forEach((table) => {
          let score = 0
          if (q) {
            const best = table.searchKeys.reduce((acc, key) => {
              const candidate = computeFuzzyScore(q, key)
              return candidate > acc ? candidate : acc
            }, -Infinity)
            if (best === -Infinity) return
            score = best
          }
          addOption({
            label: table.displayName,
            apply: table.apply,
            type: table.type === 'view' ? 'class' : 'namespace',
            detail: table.type === 'view' ? 'View' : 'Table',
            section: 'Tables/Views',
            boost: baseBoost + score,
          })
        })
      }

      const buildFunctionOptions = (filterQuery) => {
        const q = filterQuery.toLowerCase()
        schemaState.functions.forEach((fn) => {
          let base = functionCompletionCacheRef.current.get(fn.name)
          if (!base) {
            base = modules.snippetCompletion(fn.snippet, {
              label: fn.name,
              detail: fn.detail,
              type: 'function',
              section: 'Functions',
              info: fn.documentation,
            })
            functionCompletionCacheRef.current.set(fn.name, base)
          }
          let score = 0
          if (q) {
            const best = fn.searchKeys.reduce((acc, key) => {
              const candidate = computeFuzzyScore(q, key)
              return candidate > acc ? candidate : acc
            }, -Infinity)
            if (best === -Infinity) return
            score = best
          }
          addOption({ ...base, boost: 400 + score })
        })
      }

      const buildKeywordOptions = (filterQuery) => {
        const q = filterQuery.toLowerCase()
        schemaState.keywords.forEach((keyword) => {
          let base = keywordOptionCacheRef.current.get(keyword.name)
          if (!base) {
            base = {
              label: keyword.name,
              apply: `${keyword.name} `,
              type: 'keyword',
              detail: 'Keyword',
              section: 'Keywords',
            }
            keywordOptionCacheRef.current.set(keyword.name, base)
          }
          let score = 0
          if (q) {
            const best = keyword.searchKeys.reduce((acc, key) => {
              const candidate = computeFuzzyScore(q, key)
              return candidate > acc ? candidate : acc
            }, -Infinity)
            if (best === -Infinity) return
            score = best
          }
          addOption({ ...base, boost: 200 + score })
        })
      }

      const columnsByTable = schemaState.columnsByTable || {}
      const tablesInScope = scopeState.tablesInScope || []

      if (dotMatch) {
        const aliasRaw = dotMatch[1]
        const partial = dotMatch[2]
        const aliasKey = normalizeIdentifierForLookup(aliasRaw)
        const aliasEntry = schemaState.aliases[aliasKey]
        let sourceKey = aliasEntry?.target
        if (!sourceKey) {
          sourceKey = resolveTableKey(aliasRaw, schemaState.tableLookup)
        }
        if (!sourceKey && scopeState.lastTableKey) {
          sourceKey = scopeState.lastTableKey
        }
        const columns = sourceKey ? columnsByTable[sourceKey] || [] : []
        const infoLabel = aliasEntry?.source || stripQuotes(aliasRaw)
        if (columns.length > 0) {
          addOption({
            label: '*',
            apply: '*',
            type: 'keyword',
            detail: 'All columns',
            section: 'Columns',
            boost: 950,
          })
          buildColumnOptions(columns, 940, infoLabel, partial)
          const options = limitOptions(Array.from(unique.values()).sort((a, b) => (b.boost || 0) - (a.boost || 0)))
          return {
            from: pos - partial.length,
            options,
          }
        }
      }

      const statementStart = scopeState.statementRange?.start ?? 0
      const beforeCursor = doc.sliceString(statementStart, pos)
      const clauseMatch = beforeCursor.match(/\b(from|join|update|into)\s+([^\s]*)$/i)
      if (clauseMatch) {
        const partial = clauseMatch[2] || ''
        from = pos - partial.length
        buildTableOptions(partial, 880)
        const options = limitOptions(Array.from(unique.values()).sort((a, b) => (b.boost || 0) - (a.boost || 0)))
        return { from, options }
      }

      const clause = findLastClause(beforeCursor)

      if (clause === 'on' || clause === 'using') {
        if (tablesInScope.length >= 2) {
          const [first, ...rest] = tablesInScope
          let intersection = new Map((columnsByTable[first] || []).map((col) => [col.lower, col]))
          rest.forEach((key) => {
            const current = new Map((columnsByTable[key] || []).map((col) => [col.lower, col]))
            intersection = new Map([...intersection].filter(([name]) => current.has(name)))
          })
          buildColumnOptions(Array.from(intersection.values()), 930, 'Join match', typed)
        }
        tablesInScope.forEach((key) => {
          buildColumnOptions(columnsByTable[key], 820, null, typed)
        })
        buildFunctionOptions(typed)
        buildKeywordOptions(typed)
        const options = limitOptions(Array.from(unique.values()).sort((a, b) => (b.boost || 0) - (a.boost || 0)))
        return options.length > 0 ? { from, options } : null
      }

      if (['select', 'where', 'group by', 'order by', 'having'].includes(clause || '')) {
        Object.entries(schemaState.aliases).forEach(([aliasKey, aliasEntry]) => {
          if (!aliasEntry.target) return
          buildColumnOptions(columnsByTable[aliasEntry.target], 920, aliasEntry.source || aliasKey, typed)
        })
        if (scopeState.lastTableKey) {
          buildColumnOptions(columnsByTable[scopeState.lastTableKey], 880, null, typed)
        }
        tablesInScope.forEach((key) => {
          if (key === scopeState.lastTableKey) return
          buildColumnOptions(columnsByTable[key], 840, null, typed)
        })
        buildFunctionOptions(typed)
        buildKeywordOptions(typed)
        const options = limitOptions(Array.from(unique.values()).sort((a, b) => (b.boost || 0) - (a.boost || 0)))
        return options.length > 0 ? { from, options } : null
      }

      if (schemaState.tables.length > 0) {
        Object.entries(schemaState.aliases).forEach(([aliasKey, aliasEntry]) => {
          if (!aliasEntry.target) return
          buildColumnOptions(columnsByTable[aliasEntry.target], 820, aliasEntry.source || aliasKey, typed)
        })
        if (scopeState.lastTableKey) {
          buildColumnOptions(columnsByTable[scopeState.lastTableKey], 800, null, typed)
        }
        buildFunctionOptions(typed)
        buildKeywordOptions(typed)
        buildTableOptions(typed, 780)
      } else {
        buildFunctionOptions(typed)
        buildKeywordOptions(typed)
      }

      const options = limitOptions(Array.from(unique.values()).sort((a, b) => (b.boost || 0) - (a.boost || 0)))
      if (options.length === 0) return null
      return { from, options }
    }
  }, [featureFlags.enableSqlAutocomplete])

  useEffect(() => {
    duckStateRef.current = duckState
  }, [duckState])

  useEffect(() => {
    schemaCacheRef.current = schemaCache
  }, [schemaCache])

  useEffect(() => {
    schemaScopeRef.current = schemaScope
  }, [schemaScope])

  useEffect(() => {
    cursorStateRef.current = cursorState
  }, [cursorState])

  useEffect(() => {
    if (!featureFlags.enableSqlAutocomplete) return
    if (aliasDebounceRef.current) {
      window.clearTimeout(aliasDebounceRef.current)
      aliasDebounceRef.current = null
    }
    aliasDebounceRef.current = window.setTimeout(() => {
      aliasDebounceRef.current = null
      const analysis = extractAliasContext(query, cursorStateRef.current.head, schemaCacheRef.current)
      setSchemaCache((prev) => {
        const prevKeys = Object.keys(prev.aliases)
        const nextKeys = Object.keys(analysis.aliases)
        const sameLength = prevKeys.length === nextKeys.length
        const sameEntries = sameLength
          && nextKeys.every((key) => {
            const prevEntry = prev.aliases[key]
            const nextEntry = analysis.aliases[key]
            if (!prevEntry && !nextEntry) return true
            if (!prevEntry || !nextEntry) return false
            return prevEntry.target === nextEntry.target && prevEntry.type === nextEntry.type
          })
        if (sameEntries) return prev
        return { ...prev, aliases: analysis.aliases }
      })
      setSchemaScope((prev) => {
        const sameRange =
          prev.statementRange?.start === analysis.statementRange.start
          && prev.statementRange?.end === analysis.statementRange.end
        const sameTables =
          prev.tablesInScope.length === analysis.tablesInScope.length
          && prev.tablesInScope.every((value, idx) => value === analysis.tablesInScope[idx])
        if (sameRange && sameTables && prev.lastTableKey === analysis.lastTableKey && prev.beforeCursor === analysis.beforeCursor) {
          return prev
        }
        return analysis
      })
    }, 220)
    return () => {
      if (aliasDebounceRef.current) {
        window.clearTimeout(aliasDebounceRef.current)
        aliasDebounceRef.current = null
      }
    }
  }, [cursorState, featureFlags.enableSqlAutocomplete, query])

  useEffect(() => {
    return () => {
      const current = duckStateRef.current
      if (current.conn) current.conn.close().catch(() => {})
      if (current.db) current.db.terminate().catch(() => {})
      if (current.worker) current.worker.terminate()
      if (schemaRefreshTimerRef.current) {
        window.clearTimeout(schemaRefreshTimerRef.current)
        schemaRefreshTimerRef.current = null
      }
    }
  }, [])

  const loadCache = useCallback(async () => {
    if (!cacheEnabled) return
    if (!duckState.db || !duckState.conn) return
    setLoadingFromCache(true)
    try {
      const db = await ensureDb()
      const stored = await db.getAll(STORE_DATASETS)
      const storedHistory = await db.getAll(STORE_HISTORY)
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
      const initialHistory = storedHistory
        .filter((entry) => entry && entry.sql)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, MAX_HISTORY_ENTRIES)
        .map((entry) => ({ id: entry.id, sql: entry.sql, createdAt: entry.createdAt }))
      setHistory(initialHistory)
      if (initialHistory.length > 0) {
        lastSuccessfulQueryRef.current = initialHistory[0].sql
      }
      if (loadedDatasets.length > 0) {
        addMessage('Datasets restored from local cache.', 'success')
      }
      if (loadedDatasets.length > 0) {
        scheduleSchemaRefresh('cache-load', { immediate: true, silent: true })
      }
    } catch (error) {
      console.error('Cache load error', error)
      addMessage('Failed to restore cached datasets.', 'error')
    } finally {
      setLoadingFromCache(false)
    }
  }, [addMessage, cacheEnabled, duckState.conn, duckState.db, ensureDb, scheduleSchemaRefresh])

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

  useEffect(() => {
    if (!selectedDataset) {
      setOpenColumnGroups({})
      setColumnPageByType({})
      setColumnScrollTop(0)
      if (columnsPanelRef.current) columnsPanelRef.current.scrollTop = 0
      return
    }
    const firstType = selectedDataset.schema?.[0]?.type ?? null
    setOpenColumnGroups(firstType ? { [firstType]: true } : {})
    setColumnPageByType({})
    setColumnScrollTop(0)
    if (columnsPanelRef.current) columnsPanelRef.current.scrollTop = 0
  }, [selectedDataset?.id])

  useEffect(() => {
    setColumnPageByType({})
    if (columnsPanelRef.current) columnsPanelRef.current.scrollTop = 0
  }, [columnSearch])

  const columnCount = selectedDataset?.schema?.length ?? 0

  const columnGroups = useMemo(() => {
    if (!selectedDataset) return []
    const search = columnSearch.trim().toLowerCase()
    const groups = new Map()
    selectedDataset.schema.forEach((column) => {
      const type = column.type || 'Unknown'
      if (!groups.has(type)) groups.set(type, [])
      groups.get(type).push({
        ...column,
        nameLower: column.name.toLowerCase(),
        description: column.description || column.comment || '',
      })
    })
    const mapped = Array.from(groups.entries()).map(([type, columns]) => {
      const sorted = [...columns].sort((a, b) => a.name.localeCompare(b.name))
      const visible = search
        ? sorted.filter((item) => item.nameLower.includes(search) || (item.description || '').toLowerCase().includes(search))
        : sorted
      return {
        type,
        columns: sorted,
        visibleColumns: visible,
        total: sorted.length,
        hasMatches: visible.length > 0,
      }
    })
    mapped.sort((a, b) => a.type.localeCompare(b.type))
    if (!search) return mapped
    return mapped.filter((group) => group.hasMatches)
  }, [columnSearch, selectedDataset])

  const visibleColumnCount = useMemo(() => {
    return columnGroups.reduce((acc, group) => acc + group.visibleColumns.length, 0)
  }, [columnGroups])

  const toggleColumnGroup = useCallback((type) => {
    setOpenColumnGroups((prev) => ({ ...prev, [type]: !prev[type] }))
  }, [])

  const handleColumnPanelScroll = useCallback((event) => {
    setColumnScrollTop(event.currentTarget.scrollTop)
  }, [])

  const updateColumnPage = useCallback((type, nextPage) => {
    setColumnPageByType((prev) => ({ ...prev, [type]: nextPage }))
  }, [])

  const searchActive = columnSearch.trim().length > 0
  const showBackToTop = columnScrollTop > COLUMN_SCROLL_THRESHOLD
  const hasSelection = selectionText.trim().length > 0
  const runDisabled = queryStatus.state === 'running'

  const queryMetrics = useMemo(() => {
    if (queryStatus.state !== 'success') return []
    return [
      { label: 'Rows', value: queryStatus.rowCount.toLocaleString('en-US') },
      { label: 'Parse', value: `${queryStatus.parseMs.toFixed(2)} ms` },
      { label: 'Execution', value: `${queryStatus.execMs.toFixed(2)} ms` },
      { label: 'Memory', value: formatBytes(queryStatus.memoryApprox) },
    ]
  }, [queryStatus])

  const queryError = queryStatus.state === 'error' ? queryStatus : null
  const schemaRefreshing = schemaCache.status === 'loading'
  const schemaError = schemaCache.status === 'error'
  const schemaOutdated = schemaCache.stale
  const schemaStatusLabel = schemaRefreshing
    ? 'Refreshing schema…'
    : schemaError
      ? 'Schema error — Retry'
      : schemaOutdated
        ? 'Schema outdated — Refresh'
        : 'Schema ready'

  useEffect(() => {
    if (queryStatus.state !== 'error' && errorCopyStatus !== 'idle') {
      setErrorCopyStatus('idle')
    }
  }, [errorCopyStatus, queryStatus])

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
        const readyId = addMessage(`${file.name} is ready as view ${viewName}.`, 'success')
        datasetReadyMessageIds.current.add(readyId)
        scheduleSchemaRefresh('upload')
      } catch (error) {
        console.error('Failed to ingest file', error)
        reservedNamesRef.current.delete(viewName)
        addMessage(`Failed to ingest ${file.name}: ${error.message}`, 'error')
      }
    }
  }, [addMessage, csvOptions, duckState.conn, duckState.db, memoryLimitMb, persistDataset, scheduleSchemaRefresh, totalDatasetSize])

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
    scheduleSchemaRefresh('remove', { silent: true })
  }, [datasets, duckState.conn, duckState.db, removeDatasetFromCache, scheduleSchemaRefresh, selectedDatasetId])

  const sqlEditorRef = useRef(null)
  const handleEditorFocus = useCallback(() => {
    ensureAutocomplete()
  }, [ensureAutocomplete])

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
      lastSuccessfulQueryRef.current = sqlText
      if (datasetReadyMessageIds.current.size > 0) {
        const ids = new Set(datasetReadyMessageIds.current)
        datasetReadyMessageIds.current.clear()
        setMessages((prev) => prev.filter((message) => !ids.has(message.id)))
      }
      const historyEntry = { id: ensureUuid(), sql: sqlText, createdAt: finishedAt.toISOString() }
      setHistory((prev) => {
        const next = [historyEntry, ...prev]
        return next.slice(0, MAX_HISTORY_ENTRIES)
      })
      setExpandedHistoryId(historyEntry.id)
      if (cacheEnabled) {
        try {
          const db = await ensureDb()
          await db.put(STORE_HISTORY, historyEntry)
          const allEntries = await db.getAll(STORE_HISTORY)
          const sorted = allEntries
            .filter((entry) => entry && entry.sql)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          const excess = sorted.slice(MAX_HISTORY_ENTRIES)
          if (excess.length > 0) {
            await Promise.all(excess.map((entry) => db.delete(STORE_HISTORY, entry.id)))
          }
        } catch (error) {
          console.error('Failed to persist history entry', error)
        }
      }
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
    } finally {
      if (activeQueryRef.current === requestToken) {
        activeQueryRef.current = null
      }
    }
  }, [cacheEnabled, duckState.conn, duckState.db, ensureDb, exportResult, onQueryExecutedRef, query])

  const runSelection = useCallback(() => {
    const selection = sqlEditorRef.current?.getSelection()
    if (selection && selection.trim().length > 0) runQuery(selection)
    else runQuery()
  }, [runQuery])

  const handleSelectionChange = useCallback((value) => {
    setSelectionText(value)
  }, [])

  const handleCursorChange = useCallback((selection) => {
    setCursorState(selection)
  }, [])

  const handleSchemaRefreshClick = useCallback(() => {
    scheduleSchemaRefresh('manual', { immediate: true, force: true })
  }, [scheduleSchemaRefresh])

  const formatQuery = useCallback(() => {
    if (!query.trim()) return
    try {
      const formatted = formatSqlText(query, { language: 'postgresql' })
      setQuery(formatted)
      sqlEditorRef.current?.focus()
    } catch (error) {
      console.error('SQL formatting failed', error)
      addMessage(`Formatting failed: ${error.message}`, 'error')
    }
  }, [addMessage, query])

  const copySelectStatement = useCallback(async (viewName) => {
    try {
      await navigator.clipboard.writeText(`SELECT * FROM ${quoteIdentifier(viewName)} LIMIT 100;`)
      addMessage(`Copied SELECT template for ${viewName}.`, 'success')
    } catch (error) {
      addMessage('Clipboard copy failed. Please copy manually.', 'error')
    }
  }, [addMessage])

  const copyErrorMessage = useCallback(async () => {
    if (queryStatus.state !== 'error' || !queryStatus.message) return
    try {
      await navigator.clipboard.writeText(queryStatus.message)
      setErrorCopyStatus('success')
      window.setTimeout(() => setErrorCopyStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy error message', error)
      setErrorCopyStatus('error')
      window.setTimeout(() => setErrorCopyStatus('idle'), 4000)
    }
  }, [queryStatus])

  const clearHistory = useCallback(async () => {
    setHistory([])
    setExpandedHistoryId(null)
    lastSuccessfulQueryRef.current = ''
    try {
      const db = await ensureDb()
      await db.clear(STORE_HISTORY)
    } catch (error) {
      console.error('Failed to clear history', error)
    }
  }, [ensureDb])

  const restoreLastSuccessfulQuery = useCallback(() => {
    const text = lastSuccessfulQueryRef.current || history[0]?.sql || ''
    if (!text) return
    setQuery(text)
    sqlEditorRef.current?.focus()
  }, [history])

  const toggleCache = useCallback(async () => {
    const next = !cacheEnabled
    setCacheEnabled(next)
    if (!next) {
      setHistory([])
      setExpandedHistoryId(null)
      lastSuccessfulQueryRef.current = ''
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
        <div className='mx-auto grid h-20 w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6'>
          <div className='flex items-center gap-2'>
            <a
              href='/'
              className='inline-flex h-10 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
              aria-label='Back to tools'
            >
              <IconArrowLeft size={18} stroke={2} />
              <span className='hidden sm:inline'>Back to tools</span>
            </a>
          </div>
          <div className='flex flex-col items-center gap-1 text-center'>
            <h1 className='text-xl font-semibold text-gray-900 sm:text-2xl'>Query Explorer</h1>
            <p className='text-xs text-gray-600 sm:text-sm'>Run analytical SQL queries entirely in your browser against CSV, JSON Lines, or Parquet datasets.</p>
          </div>
          <div className='flex items-center justify-end gap-2'>
            <InstallPrompt />
            <a
              href='/settings'
              className='inline-flex h-10 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
            >
              <IconSettings size={16} stroke={2} />
              Edit Config
            </a>
          </div>
        </div>
      </header>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start'>
        <main className='order-1 min-w-0 flex-1 space-y-6 lg:col-start-2'>
          <div className='space-y-6'>
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
              <section className='rounded-xl border-2 border-black bg-white'>
                <button
                  type='button'
                  onClick={() => setUploadOpen((prev) => !prev)}
                  className='flex w-full items-center justify-between gap-2 border-b-2 border-black px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
                  aria-expanded={uploadOpen}
                >
                  <span className='flex items-center gap-2'>
                    <IconDatabaseImport size={16} />
                    Upload datasets
                  </span>
                  {uploadOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </button>
                {uploadOpen && (
                  <div className='space-y-4 px-4 pb-4 pt-3 text-sm text-gray-700'>
                    <p className='text-xs text-gray-600'>Upload files to register them as read-only DuckDB views in your browser.</p>
                    <label className='flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-black bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-white focus-within:ring-2 focus-within:ring-black'>
                      <IconDatabaseImport size={16} />
                      <span>Choose files</span>
                      <input
                        type='file'
                        className='hidden'
                        multiple
                        accept='.csv,.tsv,.txt,.ndjson,.jsonl,.json,.parquet'
                        onChange={handleFileInput}
                      />
                    </label>
                    <div className='grid gap-3 text-xs text-gray-700 sm:grid-cols-2'>
                      <div className='flex items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2'>
                        <span>Total size</span>
                        <span className='font-semibold text-gray-900'>{formatBytes(totalDatasetSize)}</span>
                      </div>
                      <div className='flex items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2'>
                        <label htmlFor='memoryLimit' className='font-medium text-gray-700'>Memory budget</label>
                        <div className='flex items-center gap-2'>
                          <input
                            id='memoryLimit'
                            type='number'
                            min={64}
                            step={64}
                            value={memoryLimitMb}
                            onChange={(event) => setMemoryLimitMb(Number(event.target.value))}
                            className='h-8 w-20 rounded-md border-2 border-black bg-gray-100 px-2 text-right text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                          />
                          <span>MB</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={toggleCache}
                      className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border-2 px-3 text-xs font-medium ${
                        cacheEnabled
                          ? 'border-black bg-gray-100 text-gray-900 hover:bg-gray-200'
                          : 'border-black bg-white text-gray-900 hover:bg-gray-100'
                      } focus:outline-none focus-visible:ring-2 focus-visible:ring-black`}
                    >
                      {cacheEnabled ? <IconCloudOff size={16} /> : <IconRestore size={16} />}
                      {cacheEnabled ? 'Enable private mode' : 'Re-enable cache'}
                    </button>
                    <details className='rounded-lg border-2 border-dashed border-black px-3 py-2 text-xs text-gray-700'>
                      <summary className='cursor-pointer text-sm font-semibold text-gray-700'>Advanced CSV options</summary>
                      <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <label className='flex flex-col gap-1'>
                          <span>Delimiter</span>
                          <input
                            type='text'
                            maxLength={1}
                            value={csvOptions.delimiter}
                            onChange={(event) => setCsvOptions((prev) => ({ ...prev, delimiter: event.target.value || ',' }))}
                            className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                          />
                        </label>
                        <label className='flex flex-col gap-1'>
                          <span>Encoding</span>
                          <input
                            type='text'
                            value={csvOptions.encoding}
                            onChange={(event) => setCsvOptions((prev) => ({ ...prev, encoding: event.target.value || 'utf-8' }))}
                            className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                          />
                        </label>
                        <label className='flex flex-col gap-1'>
                          <span>Quote</span>
                          <input
                            type='text'
                            maxLength={1}
                            value={csvOptions.quote}
                            onChange={(event) => setCsvOptions((prev) => ({ ...prev, quote: event.target.value || '"' }))}
                            className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                          />
                        </label>
                        <label className='flex flex-col gap-1'>
                          <span>Escape</span>
                          <input
                            type='text'
                            maxLength={1}
                            value={csvOptions.escape}
                            onChange={(event) => setCsvOptions((prev) => ({ ...prev, escape: event.target.value || csvOptions.quote }))}
                            className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                          />
                        </label>
                        <label className='flex flex-col gap-1'>
                          <span>Null string</span>
                          <input
                            type='text'
                            value={csvOptions.nullstr}
                            onChange={(event) => setCsvOptions((prev) => ({ ...prev, nullstr: event.target.value }))}
                            className='rounded-md border-2 border-black bg-gray-100 px-2 py-1 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                          />
                        </label>
                        <label className='flex items-center gap-2'>
                          <input
                            type='checkbox'
                            checked={csvOptions.header}
                            onChange={(event) => setCsvOptions((prev) => ({ ...prev, header: event.target.checked }))}
                            className='h-4 w-4 rounded border-2 border-black text-black focus:ring-black'
                          />
                          <span>File includes header row</span>
                        </label>
                      </div>
                    </details>
                  </div>
                )}
              </section>

              <section className='rounded-xl border-2 border-black bg-white'>
                <div className='border-b-2 border-black px-4 py-3'>
                  <div className='flex flex-col gap-1'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700'>
                        <IconDatabaseImport size={16} />
                        Datasets
                      </h2>
                      <div className='flex flex-wrap items-center gap-3 text-xs text-gray-600'>
                        <span>{datasets.length} dataset{datasets.length === 1 ? '' : 's'}</span>
                        <span aria-hidden='true'>•</span>
                        <span>Total {formatBytes(totalDatasetSize)}</span>
                        <span aria-hidden='true'>•</span>
                        <span>Budget {memoryLimitMb} MB</span>
                      </div>
                    </div>
                    {loadingFromCache && <p className='text-xs text-gray-600'>Restoring cached datasets…</p>}
                  </div>
                </div>
                <div className='space-y-4 px-4 py-4'>
                  {datasets.length === 0 ? (
                    <p className='rounded-lg border-2 border-dashed border-black px-4 py-3 text-sm text-gray-600'>No datasets yet. Upload a file to register it.</p>
                  ) : (
                    <ul className='space-y-3' role='list'>
                      {datasets.map((dataset) => {
                        const isActive = selectedDatasetId === dataset.id
                        const createdLabel = formatDateTimeJakarta(dataset.createdAt)
                        return (
                          <li key={dataset.id}>
                            <article
                              className={`rounded-xl border-2 px-3 py-3 ${
                                isActive ? 'border-black bg-gray-200' : 'border-black bg-white hover:bg-gray-100'
                              } transition-colors`}
                            >
                              <div className='flex flex-col gap-2'>
                                <button
                                  type='button'
                                  className='flex w-full items-center justify-between gap-3 text-left'
                                  onClick={() => setSelectedDatasetId(dataset.id)}
                                  aria-pressed={isActive}
                                >
                                  <h3 className='truncate text-sm font-semibold text-gray-900'>{dataset.viewName}</h3>
                                  <span className='shrink-0 rounded-full border-2 border-black px-2 py-0.5 text-[11px] uppercase text-gray-700'>{dataset.type}</span>
                                </button>
                                <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700'>
                                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600'>
                                    <span className='truncate' title={dataset.sourceFileName}>{dataset.sourceFileName}</span>
                                    <span aria-hidden='true'>•</span>
                                    <span>{createdLabel}</span>
                                    <span aria-hidden='true'>•</span>
                                    <span>{formatBytes(dataset.approxSize)}</span>
                                  </div>
                                  <div className='flex items-center gap-2'>
                                    <button
                                      type='button'
                                      onClick={() => copySelectStatement(dataset.viewName)}
                                      className='inline-flex items-center gap-1 rounded-lg border-2 border-black px-2 py-1 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                                      aria-label={`Copy SELECT statement for ${dataset.viewName}`}
                                    >
                                      <IconClipboard size={14} />
                                      Copy
                                    </button>
                                    <button
                                      type='button'
                                      onClick={() => removeDataset(dataset)}
                                      className='inline-flex items-center gap-1 rounded-lg border-2 border-black px-2 py-1 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                                      aria-label={`Remove ${dataset.viewName}`}
                                    >
                                      <IconTrash size={14} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {datasets.length > 0 && !selectedDatasetId && (
                    <p className='rounded-lg border-2 border-dashed border-black px-4 py-3 text-xs text-gray-600'>Select a dataset to inspect its columns.</p>
                  )}
                </div>
              </section>

              <section className='rounded-xl border-2 border-black bg-white'>
                <div className='flex flex-wrap items-center justify-between gap-2 border-b-2 border-black px-4 py-3'>
                  <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700'>
                    <IconPlayerPlay size={16} />
                    SQL Query
                  </h2>
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => runQuery()}
                      className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                      disabled={runDisabled}
                    >
                      <IconPlayerPlay size={16} />
                      Run
                    </button>
                    <button
                      type='button'
                      onClick={formatQuery}
                      className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                      disabled={query.trim().length === 0 || runDisabled}
                    >
                      <IconBraces size={16} />
                      Format SQL
                    </button>
                    <button
                      type='button'
                      onClick={() => setWrapEnabled((prev) => !prev)}
                      className={`inline-flex h-9 items-center gap-2 rounded-lg border-2 px-3 text-sm ${
                        wrapEnabled ? 'border-black bg-gray-200 text-gray-900' : 'border-black bg-white text-gray-900 hover:bg-gray-100'
                      } focus:outline-none focus-visible:ring-2 focus-visible:ring-black`}
                      aria-pressed={wrapEnabled}
                    >
                      <IconTextWrap size={16} />
                      Wrap
                    </button>
                    {featureFlags.enableSqlAutocomplete && (
                      <button
                        type='button'
                        onClick={handleSchemaRefreshClick}
                        className={`inline-flex h-9 items-center gap-2 rounded-lg border-2 px-3 text-xs ${
                          schemaError
                            ? 'border-black bg-white text-gray-900 hover:bg-gray-100'
                            : schemaRefreshing
                              ? 'border-black bg-gray-100 text-gray-700'
                              : 'border-black bg-white text-gray-900 hover:bg-gray-100'
                        } focus:outline-none focus-visible:ring-2 focus-visible:ring-black`}
                        disabled={schemaRefreshing}
                        aria-live='polite'
                      >
                        <IconRefresh size={16} className={schemaRefreshing ? 'animate-spin' : ''} />
                        {schemaStatusLabel}
                      </button>
                    )}
                  </div>
                  {hasSelection && (
                    <button
                      type='button'
                      onClick={runSelection}
                      className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                      disabled={runDisabled}
                    >
                      <IconPlayerPlay size={16} />
                      Run selection
                    </button>
                  )}
                </div>
                <p className='px-4 pt-4 text-xs text-gray-600'>Use Cmd/Ctrl + Enter to run the entire query. Shift + Cmd/Ctrl + Enter executes the current selection.</p>
                <div className='px-4 pb-4'>
                  <SqlEditor
                    ref={sqlEditorRef}
                    value={query}
                    onChange={setQuery}
                    onRun={() => runQuery()}
                    onRunSelection={runSelection}
                    onSelectionChange={handleSelectionChange}
                    onCursorChange={handleCursorChange}
                    onFocus={handleEditorFocus}
                    wrap={wrapEnabled}
                    extraExtensions={editorExtraExtensions}
                  />
                </div>
              </section>

              {queryError && (
                <div className='rounded-xl border-2 border-black bg-white px-4 py-4 text-sm text-gray-800'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <h3 className='text-sm font-semibold text-gray-900'>Query error</h3>
                      <p className='mt-2 text-sm text-gray-700'>{queryError.message}</p>
                      {typeof queryError.line === 'number' && (
                        <p className='mt-1 text-xs text-gray-600'>Line {queryError.line}, column {queryError.column}</p>
                      )}
                      {queryError.finishedAt && (
                        <p className='mt-1 text-xs text-gray-500'>Failed at {formatDateTimeJakarta(queryError.finishedAt)}.</p>
                      )}
                    </div>
                    <button
                      type='button'
                      onClick={copyErrorMessage}
                      className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-xs text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                    >
                      <IconClipboard size={14} />
                      Copy error
                    </button>
                  </div>
                  {errorCopyStatus === 'success' && <p className='mt-2 text-xs text-gray-500'>Copied to clipboard.</p>}
                  {errorCopyStatus === 'error' && <p className='mt-2 text-xs text-gray-500'>Copy failed. Please copy manually.</p>}
                </div>
              )}

              <section className='rounded-xl border-2 border-black bg-white'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3'>
                  <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700'>
                    <IconTable size={16} />
                    Query result
                  </h2>
                  {result && (
                    <div className='flex flex-wrap items-center gap-2'>
                      <button
                        type='button'
                        onClick={() => exportResult('csv')}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-xs text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                        disabled={queryStatus.state !== 'success'}
                      >
                        <IconDownload size={14} />
                        CSV
                      </button>
                      <button
                        type='button'
                        onClick={() => exportResult('ndjson')}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-xs text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                        disabled={queryStatus.state !== 'success'}
                      >
                        <IconDownload size={14} />
                        NDJSON
                      </button>
                      <button
                        type='button'
                        onClick={() => exportResult('parquet')}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-xs text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                        disabled={queryStatus.state !== 'success'}
                      >
                        <IconDownload size={14} />
                        Parquet
                      </button>
                    </div>
                  )}
                </div>
                <div className='space-y-4 px-4 py-4'>
                  <div className='space-y-1 text-sm text-gray-700'>
                    {queryStatus.state === 'idle' && <p>Waiting for a query.</p>}
                    {queryStatus.state === 'running' && queryStatus.startedAt && (
                      <p>Query running… started at {formatDateTimeJakarta(queryStatus.startedAt)}.</p>
                    )}
                    {queryStatus.state === 'success' && queryStatus.finishedAt && (
                      <p>Query succeeded at {formatDateTimeJakarta(queryStatus.finishedAt)}.</p>
                    )}
                  </div>
                  {queryMetrics.length > 0 && (
                    <dl className='grid grid-cols-2 gap-3 text-xs text-gray-700 sm:grid-cols-4'>
                      {queryMetrics.map((metric) => (
                        <div key={metric.label} className='rounded-lg border border-gray-300 px-3 py-2'>
                          <dt className='text-gray-500'>{metric.label}</dt>
                          <dd className='font-semibold text-gray-900'>{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
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
        <aside className='order-2 flex w-full flex-col gap-4 lg:col-start-1 lg:row-start-1'>
          <section className='rounded-xl border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('columns')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
              aria-expanded={sidebarSections.columns}
            >
              <span className='flex items-center gap-2'>
                <IconColumns3 size={16} />
                Columns
              </span>
              {sidebarSections.columns ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.columns && (
              <div className='space-y-3 px-4 pb-4 pt-3 text-xs text-gray-600'>
                {!selectedDataset && <p>Select a dataset to inspect its schema.</p>}
                {selectedDataset && (
                  <div className='space-y-3 text-sm text-gray-700'>
                    <div className='flex flex-col gap-2'>
                      <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span>{columnCount} columns</span>
                          {searchActive && (
                            <>
                              <span aria-hidden='true'>•</span>
                              <span>
                                {visibleColumnCount} match{visibleColumnCount === 1 ? '' : 'es'}
                              </span>
                            </>
                          )}
                        </div>
                        <span className='truncate font-medium text-gray-900' title={selectedDataset.viewName}>
                          {selectedDataset.viewName}
                        </span>
                      </div>
                      <label className='relative flex items-center'>
                        <IconSearch size={16} className='pointer-events-none absolute left-2 text-gray-500' />
                        <input
                          type='search'
                          value={columnSearch}
                          onChange={(event) => setColumnSearch(event.target.value)}
                          placeholder='Search columns'
                          className='w-full rounded-lg border-2 border-black bg-white py-1.5 pl-8 pr-2 text-xs text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                        />
                      </label>
                      {featureFlags.enableSqlAutocomplete && (
                        <div className='flex items-center justify-between gap-2'>
                          <button
                            type='button'
                            onClick={handleSchemaRefreshClick}
                            className='inline-flex h-8 items-center gap-2 rounded-lg border-2 border-black bg-white px-2 text-xs text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60'
                            disabled={schemaRefreshing}
                          >
                            <IconRefresh size={14} className={schemaRefreshing ? 'animate-spin' : ''} />
                            Refresh schema
                          </button>
                          <span className='text-[11px] text-gray-500'>{schemaStatusLabel}</span>
                        </div>
                      )}
                    </div>
                    <div
                      ref={columnsPanelRef}
                      onScroll={handleColumnPanelScroll}
                      className='max-h-[60vh] space-y-3 overflow-y-auto pr-1'
                    >
                      {columnGroups.length === 0 ? (
                        <p className='text-xs text-gray-500'>No columns match your search.</p>
                      ) : (
                        columnGroups.map((group) => {
                          const page = columnPageByType[group.type] ?? 0
                          const totalPages = Math.max(1, Math.ceil(group.visibleColumns.length / COLUMNS_PER_PAGE))
                          const safePage = Math.min(page, totalPages - 1)
                          const start = safePage * COLUMNS_PER_PAGE
                          const slice = group.visibleColumns.slice(start, start + COLUMNS_PER_PAGE)
                          const isOpen = openColumnGroups[group.type] || (searchActive && group.hasMatches)
                          return (
                            <div key={group.type} className='rounded-lg border border-gray-300'>
                              <button
                                type='button'
                                onClick={() => toggleColumnGroup(group.type)}
                                className='flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100'
                                aria-expanded={isOpen}
                              >
                                <span className='flex items-center gap-2'>
                                  <IconColumns3 size={14} />
                                  {group.type} ({group.visibleColumns.length}/{group.total})
                                </span>
                                {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                              </button>
                              {isOpen && (
                                <div className='space-y-2 border-t border-gray-200 px-3 py-3'>
                                  <ul className='space-y-1'>
                                    {slice.map((column) => {
                                      const title = `${column.name} (${column.type}${column.nullable === false ? ' NOT NULL' : ''})${column.description ? ` — ${column.description}` : ''}`
                                      return (
                                        <li key={column.name} className='flex items-start justify-between gap-3 rounded-md bg-white px-2 py-1.5 text-xs text-gray-700' title={title}>
                                          <span className='truncate font-medium text-gray-900'>{column.name}</span>
                                          <span className='shrink-0 rounded-full border border-gray-400 px-2 py-0.5 text-[10px] uppercase text-gray-600'>{column.type}</span>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                  {totalPages > 1 && (
                                    <div className='flex items-center justify-between text-[11px] text-gray-600'>
                                      <span>Page {safePage + 1} of {totalPages}</span>
                                      <div className='flex items-center gap-2'>
                                        <button
                                          type='button'
                                          onClick={() => updateColumnPage(group.type, Math.max(0, safePage - 1))}
                                          className='inline-flex items-center gap-1 rounded-lg border border-gray-400 px-2 py-1 disabled:opacity-40'
                                          disabled={safePage === 0}
                                          aria-label={`Previous page of ${group.type} columns`}
                                        >
                                          Prev
                                        </button>
                                        <button
                                          type='button'
                                          onClick={() => updateColumnPage(group.type, Math.min(totalPages - 1, safePage + 1))}
                                          className='inline-flex items-center gap-1 rounded-lg border border-gray-400 px-2 py-1 disabled:opacity-40'
                                          disabled={safePage >= totalPages - 1}
                                          aria-label={`Next page of ${group.type} columns`}
                                        >
                                          Next
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                    {showBackToTop && (
                      <button
                        type='button'
                        onClick={() => columnsPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-xs text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                      >
                        <IconArrowUp size={14} />
                        Back to top
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className='rounded-xl border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('history')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
              aria-expanded={sidebarSections.history}
            >
              <span className='flex items-center gap-2'>
                <IconHistory size={16} />
                History
              </span>
              {sidebarSections.history ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.history && (
              <div className='space-y-3 px-4 pb-4 pt-3 text-xs text-gray-600'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span>{history.length === 0 ? 'No queries yet.' : `${history.length} recent ${history.length === 1 ? 'query' : 'queries'}.`}</span>
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      type='button'
                      onClick={restoreLastSuccessfulQuery}
                      className='inline-flex h-8 items-center gap-2 rounded-lg border-2 border-black bg-white px-2 text-[11px] text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-40'
                      disabled={!lastSuccessfulQueryRef.current && history.length === 0}
                    >
                      Restore last successful query
                    </button>
                    {history.length > 0 && (
                      <button
                        type='button'
                        onClick={clearHistory}
                        className='inline-flex h-8 items-center gap-2 rounded-lg border-2 border-black bg-white px-2 text-[11px] text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
                      >
                        Clear history
                      </button>
                    )}
                  </div>
                </div>
                {history.length > 0 && (
                  <ul className='space-y-2'>
                    {history.map((entry) => {
                      const preview = entry.sql.replace(/\s+/g, ' ').trim()
                      const isExpanded = expandedHistoryId === entry.id
                      return (
                        <li key={entry.id} className='rounded-lg border-2 border-black bg-gray-100 p-3'>
                          <button
                            type='button'
                            className='w-full text-left'
                            onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                          >
                            <p className='truncate text-sm font-semibold text-gray-900'>{preview || 'Empty query'}</p>
                            <p className='mt-1 text-[11px] text-gray-500'>{formatDateTimeJakarta(new Date(entry.createdAt))}</p>
                          </button>
                          {isExpanded && (
                            <pre className='mt-2 max-h-40 overflow-auto rounded-md border border-gray-300 bg-white p-2 text-xs text-gray-700'>{entry.sql}</pre>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className='rounded-xl border-2 border-black bg-white'>
            <button
              type='button'
              onClick={() => toggleSidebarSection('notifications')}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100'
              aria-expanded={sidebarSections.notifications}
            >
              <span className='flex items-center gap-2'>
                <IconAlertCircle size={16} />
                Notifications
              </span>
              {sidebarSections.notifications ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </button>
            {sidebarSections.notifications && (
              <div className='space-y-3 px-4 pb-4 pt-3 text-xs text-gray-600'>
                {messages.length === 0 ? (
                  <p>No messages.</p>
                ) : (
                  <ul className='space-y-2'>
                    {messages.map((message) => (
                      <li key={message.id} className='flex items-start justify-between gap-3 rounded-lg border-2 border-black bg-gray-100 px-3 py-2 text-sm text-gray-700'>
                        <span className='flex-1'>{message.content}</span>
                        <button
                          type='button'
                          onClick={() => removeMessage(message.id)}
                          className='inline-flex h-8 items-center rounded-lg border-2 border-black px-2 text-[11px] text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
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
