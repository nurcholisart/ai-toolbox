import React, { useState, useMemo } from 'react'
import { IconUpload, IconFile, IconX } from '@tabler/icons-react'

const parseGoSum = (content) => {
  try {
    const packages = new Map()
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 2) continue
      const name = parts[0]
      let version = parts[1]
      if (version.endsWith('/go.mod')) version = version.replace('/go.mod', '')
      const key = `${name.toLowerCase()}@${version}`
      packages.set(key, { name: name.toLowerCase(), version })
    }
    if (!packages.size) return { error: 'No modules found. Is this a valid go.sum file?' }
    return { type: 'go.sum', packages: Array.from(packages.values()) }
  } catch (e) {
    return { error: `Parse error: ${e.message}` }
  }
}

const OSV_API_BATCH_URL = 'https://api.osv.dev/v1/querybatch'
const BATCH_SIZE = 500

const queryOsv = async (packages, onProgress) => {
  const chunks = []
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    chunks.push(packages.slice(i, i + BATCH_SIZE))
  }
  const results = []
  for (let i = 0; i < chunks.length; i++) {
    onProgress({ current: i + 1, total: chunks.length })
    const res = await fetch(OSV_API_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: chunks[i].map((p) => ({
          package: { name: p.name, ecosystem: 'Go' },
          version: p.version,
        })),
      }),
    })
    const data = await res.json()
    results.push(
      ...data.results.map((r, idx) => ({
        name: chunks[i][idx].name,
        version: chunks[i][idx].version,
        vulns: r.vulns || [],
        status: r.vulns && r.vulns.length ? 'vulnerable' : 'no vulnerabilities',
      })),
    )
  }
  return results
}

function InputArea({ setLockfileContent, setFileName, fileName }) {
  const [inputType, setInputType] = useState('paste')
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => setLockfileContent(e.target.result)
    reader.readAsText(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
      e.dataTransfer.clearData()
    }
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  return (
    <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
      <div className="flex border-b-2 border-black mb-4">
        <button
          onClick={() => setInputType('paste')}
          className={
            inputType === 'paste'
              ? 'px-4 py-2 -mb-px font-medium border-b-2 border-black'
              : 'px-4 py-2 -mb-px font-medium text-gray-600'
          }
        >
          Paste Text
        </button>
        <button
          onClick={() => setInputType('upload')}
          className={
            inputType === 'upload'
              ? 'px-4 py-2 -mb-px font-medium border-b-2 border-black'
              : 'px-4 py-2 -mb-px font-medium text-gray-600'
          }
        >
          Upload File
        </button>
      </div>
      {inputType === 'paste' ? (
        <textarea
          className="w-full h-48 p-3 font-mono text-sm bg-white border-2 border-black rounded-lg focus:outline-none"
          placeholder="Paste go.sum content here..."
          onChange={(e) => {
            setLockfileContent(e.target.value)
            setFileName('')
          }}
        />
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={
            isDragging
              ? 'relative w-full h-48 p-3 border-2 border-dashed border-black rounded-lg flex flex-col items-center justify-center bg-gray-100'
              : 'relative w-full h-48 p-3 border-2 border-dashed border-black rounded-lg flex flex-col items-center justify-center'
          }
        >
          <IconUpload className="h-6 w-6 text-gray-600" />
          <p className="mt-2 text-gray-600">
            {fileName ? (
              <span className="flex items-center bg-gray-100 p-2 rounded-lg">
                <IconFile className="h-5 w-5 mr-2" /> {fileName}
              </span>
            ) : (
              'Drag & drop a file or click to select'
            )}
          </p>
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => handleFile(e.target.files[0])}
            accept=".sum"
          />
        </div>
      )}
    </div>
  )
}

function ResultsTable({ results, filterText, setFilterText }) {
  const filtered = useMemo(() => {
    if (!filterText) return results
    const q = filterText.toLowerCase()
    return results.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.version.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.vulns.some((v) => v.id.toLowerCase().includes(q)),
    )
  }, [results, filterText])

  const exportCsv = () => {
    const headers = ['Package', 'Version', 'Status', 'Advisories']
    const rows = filtered.map((item) => [
      item.name,
      item.version,
      item.status,
      item.vulns.map((v) => v.id).join(' '),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'go-sum-scan-results.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (!filtered.length) return <p className="mt-4 text-sm text-gray-600">No results.</p>

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <input
          type="text"
          placeholder="Filter results..."
          className="w-1/2 p-2 bg-white border-2 border-black rounded-lg text-sm"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button
          onClick={exportCsv}
          className="bg-white border-2 border-black text-black rounded-lg px-3 py-1 text-sm hover:bg-gray-100"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-2 border-black rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left border-b-2 border-black">Package</th>
              <th className="px-4 py-2 text-left border-b-2 border-black">Version</th>
              <th className="px-4 py-2 text-left border-b-2 border-black">Status</th>
              <th className="px-4 py-2 text-left border-b-2 border-black">Advisories</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-mono">{item.name}</td>
                <td className="px-4 py-2 font-mono">{item.version}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-800">
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-2 space-x-1">
                  {item.vulns.length > 0 ? (
                    item.vulns.map((v) => (
                      <a
                        key={v.id}
                        href={`https://osv.dev/vulnerability/${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-gray-800"
                      >
                        {v.id}
                      </a>
                    ))
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function GoSumScanner() {
  const [lockfileContent, setLockfileContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const handleScan = async () => {
    setError('')
    setResults([])
    const parsed = parseGoSum(lockfileContent)
    if (!parsed || parsed.error) {
      setError(parsed?.error || 'Could not parse lockfile.')
      return
    }
    setIsLoading(true)
    try {
      const res = await queryOsv(parsed.packages, setProgress)
      setResults(res)
    } catch (e) {
      setError(e.message)
    }
    setIsLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-3xl font-bold mb-2">go.sum Scanner</h1>
      <p className="text-gray-600 mb-4">
        Paste or upload a go.sum file to check for known vulnerabilities. Only module names and versions are sent to OSV.dev.
      </p>
      <InputArea
        setLockfileContent={setLockfileContent}
        setFileName={setFileName}
        fileName={fileName}
      />
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleScan}
          className="bg-black text-white rounded-lg px-4 py-2 hover:bg-gray-800 focus:ring-2 focus:ring-black"
          disabled={isLoading || !lockfileContent}
        >
          {isLoading ? 'Scanning...' : 'Scan'}
        </button>
        {isLoading && (
          <span className="text-sm text-gray-600">
            Batch {progress.current} of {progress.total}
          </span>
        )}
      </div>
      {error && (
        <div className="mt-4 p-3 bg-gray-200 text-black rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}
      {results.length > 0 && (
        <ResultsTable results={results} filterText={filter} setFilterText={setFilter} />
      )}
    </div>
  )
}

