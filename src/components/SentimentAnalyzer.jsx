import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconUpload,
  IconFileDownload,
  IconChevronDown,
  IconAlertTriangle,
  IconInfoCircle,
  IconPlayerPlay,
  IconLoader2,
  IconTableExport,
} from '@tabler/icons-react'
import { getApiKey } from '../lib/config.js'

const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025'
const SHEETJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'

const DEFAULT_BASE_PROMPT = `You are a sentiment analysis expert. Analyze the provided text and assign sentiment scores.

**Definitions:**
* **Positive:** The overall tone is dominated by satisfaction, praise, or clearly good sentiment.
* **Neutral:** The text is mostly factual, mixed, weak, or has ambiguous sentiment.
* **Negative:** The overall tone is dominated by dissatisfaction, complaints, or strong negative emotion.

**Score Assignment:**
* You must provide 'positive', 'neutral', and 'negative' scores.
* Each score must be a number between 0 and 1, representing your confidence.
* The three scores should approximately sum to 1.0.
* For clearly positive feedback, 'positive' should be high (e.g., >= 0.8) and 'negative' low (e.g., <= 0.1).
* For clearly negative feedback, 'negative' should be high and 'positive' low.
* For mixed feedback, distribute the scores to reflect the mix.

**Reason:**
* You must provide a 'reason' (max 30 words).
* This should be a short, human-readable explanation of the main phrases or ideas that led to your scores.`

const DEFAULT_CONFIG = {
  textColumn: '',
  outputPositive: 'sentiment_positive',
  outputNeutral: 'sentiment_neutral',
  outputNegative: 'sentiment_negative',
  outputLabel: 'sentiment_label',
  outputReason: 'sentiment_reason',
  basePrompt: DEFAULT_BASE_PROMPT,
  customRules: '',
}

const StatusBanner = ({ status, hasErrors }) => {
  if (!status) return null
  return (
    <div className='flex items-center gap-2 bg-white border-2 border-black rounded-lg px-3 py-2 shadow-sm text-sm'>
      {hasErrors ? <IconAlertTriangle size={18} stroke={2} /> : <IconInfoCircle size={18} stroke={2} />}
      <span>{status}</span>
    </div>
  )
}

const FileUploader = ({ onFileChange, fileName, disabled }) => {
  return (
    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black rounded-lg px-4 py-6 bg-white shadow-sm cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}>
      <IconUpload size={28} stroke={2} />
      <span className='text-sm font-medium'>{fileName || 'Click to upload a CSV or Excel file'}</span>
      <span className='text-xs text-gray-700'>Accepted: .csv, .xls, .xlsx</span>
      <input
        type='file'
        className='hidden'
        onChange={onFileChange}
        accept='.csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        disabled={disabled}
      />
    </label>
  )
}

const InputField = ({ label, name, value, onChange, type = 'text' }) => (
  <label className='flex flex-col gap-1 text-sm'>
    <span className='font-semibold'>{label}</span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 shadow-sm focus:outline-none'
    />
  </label>
)

const TextareaField = ({ label, name, value, onChange, rows = 6, placeholder }) => (
  <label className='flex flex-col gap-1 text-sm'>
    <span className='font-semibold'>{label}</span>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 shadow-sm focus:outline-none font-mono text-xs'
    />
  </label>
)

const SentimentCell = ({ value, label }) => {
  if (typeof value !== 'number') return <span>{value}</span>

  const width = Math.max(4, value * 100)
  const baseColor =
    label === 'positive' ? 'bg-gray-900' : label === 'negative' ? 'bg-gray-600' : 'bg-gray-400'

  return (
    <div className='flex items-center gap-2'>
      <span className='font-mono text-xs w-12 text-right'>{value.toFixed(3)}</span>
      <div className='w-full bg-gray-200 rounded-full h-2'>
        <div className={`${baseColor} h-2 rounded-full`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

const Collapsible = ({ title, children }) => {
  const [open, setOpen] = useState(false)
  return (
    <section className='border-2 border-black rounded-lg p-3 bg-white shadow-sm'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='w-full flex items-center justify-between text-left'
      >
        <span className='font-semibold text-sm'>{title}</span>
        <IconChevronDown
          size={18}
          stroke={2}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`grid gap-3 mt-3 transition-all ${open ? 'max-h-screen' : 'max-h-0 overflow-hidden'}`}>
        {children}
      </div>
    </section>
  )
}

export default function SentimentAnalyzer() {
  const [fileName, setFileName] = useState('')
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [rowErrors, setRowErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [sheetReady, setSheetReady] = useState(!!(typeof window !== 'undefined' && window.XLSX))

  useEffect(() => {
    if (sheetReady) return
    const script = document.createElement('script')
    script.src = SHEETJS_CDN
    script.async = true
    script.onload = () => setSheetReady(true)
    script.onerror = () => setStatus('Failed to load the file parser. Please refresh and try again.')
    document.body.appendChild(script)
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [sheetReady])

  useEffect(() => {
    if (headers.length > 0) {
      setConfig((prev) => ({ ...prev, textColumn: headers[0] }))
    } else {
      setConfig(DEFAULT_CONFIG)
    }
  }, [headers])

  const allOutputColumns = useMemo(
    () => [
      config.outputPositive,
      config.outputNeutral,
      config.outputNegative,
      config.outputLabel,
      config.outputReason,
    ],
    [config],
  )

  const tableHeaders = useMemo(() => {
    const original = new Set(headers)
    const extras = allOutputColumns.filter((header) => header && !original.has(header))
    return [...headers, ...extras]
  }, [headers, allOutputColumns])

  const handleConfigChange = (event) => {
    const { name, value } = event.target
    setConfig((prev) => ({ ...prev, [name]: value }))
  }

  const resetState = () => {
    setFileName('')
    setData([])
    setHeaders([])
    setRowErrors({})
    setStatus('')
  }

  const parseFile = (file) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = window.XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length < 2) throw new Error('File has no data rows.')

        const fileHeaders = rows[0]
        const body = rows.slice(1).map((row, index) => {
          const rowData = { __rowId: index }
          fileHeaders.forEach((header, idx) => {
            rowData[header] = row[idx] ?? ''
          })
          return rowData
        })

        setHeaders(fileHeaders)
        setData(body)
        setRowErrors({})
        setStatus('Ready to analyze. Configure the text column and outputs.')
      } catch (err) {
        console.error('File parsing error:', err)
        setStatus(`Failed to parse file: ${err.message}`)
        resetState()
      }
    }
    reader.onerror = () => {
      setStatus('Error reading file. Please try again with a different file.')
      resetState()
    }
    reader.readAsBinaryString(file)
  }

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (!sheetReady) {
      setStatus('Parser is still loading. Please wait a moment and retry.')
      return
    }
    setFileName(selected.name)
    parseFile(selected)
    event.target.value = null
  }

  const callGeminiAPI = useCallback(async (text, basePrompt, customRules) => {
    const apiKey = getApiKey()
    if (!apiKey) return { error: 'Gemini API key not set. Open Settings to add your key.' }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

    let prompt = `${basePrompt}\n\n`
    if (customRules) {
      prompt += `**Additional user rules (override defaults on conflict):**\n${customRules}\n\n`
    }
    prompt += `**Text to Analyze:**\n"${text}"`

    const schema = {
      type: 'OBJECT',
      properties: {
        positive: { type: 'NUMBER', description: 'Confidence score (0.0 to 1.0) for positive sentiment.' },
        neutral: { type: 'NUMBER', description: 'Confidence score (0.0 to 1.0) for neutral sentiment.' },
        negative: { type: 'NUMBER', description: 'Confidence score (0.0 to 1.0) for negative sentiment.' },
        reason: { type: 'STRING', description: 'Brief explanation (max 30 words) for the scores.' },
      },
      required: ['positive', 'neutral', 'negative', 'reason'],
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      },
    }

    let attempts = 0
    let delay = 1000
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          const result = await response.json()
          const candidate = result.candidates?.[0]
          const jsonText = candidate?.content?.parts?.[0]?.text
          if (!jsonText) {
            const finish = candidate?.finishReason || result.promptFeedback?.blockReason || 'No content returned'
            return { error: `Model returned no content (${finish}).` }
          }
          return { data: JSON.parse(jsonText) }
        }

        if (response.status === 429 || response.status >= 500) {
          attempts += 1
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2
          continue
        }

        const message = await response.text()
        return { error: `API error ${response.status}: ${message}` }
      } catch (err) {
        attempts += 1
        if (attempts >= maxAttempts) {
          return { error: `Network error after retries: ${err.message}` }
        }
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
      }
    }

    return { error: 'Failed analysis after retries.' }
  }, [])

  const runAnalysis = async () => {
    if (!config.textColumn || data.length === 0) {
      setStatus('Upload a file and select a text column before running analysis.')
      return
    }

    setIsLoading(true)
    setRowErrors({})
    setStatus('Starting analysis…')

    const prepared = data.map((row) => ({ id: row.__rowId, text: row[config.textColumn] }))
    let updatedData = data.map((row) => {
      const withOutputs = { ...row }
      tableHeaders.forEach((header) => {
        if (!(header in withOutputs)) withOutputs[header] = ''
      })
      return withOutputs
    })

    const errors = {}
    let processed = 0

    for (const row of prepared) {
      setStatus(`Processing row ${processed + 1} of ${prepared.length}…`)

      const { data: analysis, error } = await callGeminiAPI(
        row.text,
        config.basePrompt,
        config.customRules,
      )

      const index = updatedData.findIndex((item) => item.__rowId === row.id)

      if (error) {
        errors[row.id] = error
      } else if (analysis) {
        try {
          let { positive, neutral, negative } = analysis
          const total = positive + neutral + negative
          if (total > 0) {
            positive /= total
            neutral /= total
            negative /= total
          }

          let label = 'NEUTRAL'
          if (positive > negative && positive > neutral) label = 'POSITIVE'
          else if (negative > positive && negative > neutral) label = 'NEGATIVE'

          updatedData[index] = {
            ...updatedData[index],
            [config.outputPositive]: positive,
            [config.outputNeutral]: neutral,
            [config.outputNegative]: negative,
            [config.outputLabel]: label,
            [config.outputReason]: analysis.reason,
          }
        } catch (err) {
          errors[row.id] = `Failed to process response: ${err.message}`
        }
      }

      processed += 1
    }

    setData(updatedData)
    setRowErrors(errors)
    setStatus(`Analysis complete. ${processed} rows processed. ${Object.keys(errors).length} errors.`)
    setIsLoading(false)
  }

  const exportData = (format) => {
    if (!sheetReady) {
      setStatus('Parser not ready. Please wait a moment.')
      return
    }
    if (data.length === 0) {
      setStatus('No data to export.')
      return
    }

    const cleanRows = data.map((row) => {
      const copy = {}
      tableHeaders.forEach((header) => {
        copy[header] = row[header]
      })
      return copy
    })

    try {
      const worksheet = window.XLSX.utils.json_to_sheet(cleanRows, { header: tableHeaders })
      const workbook = window.XLSX.utils.book_new()
      window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Sentiment Analysis')
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      window.XLSX.writeFile(workbook, `sentiment_analysis_export.${ext}`)
    } catch (err) {
      setStatus(`Failed to export file: ${err.message}`)
    }
  }

  return (
    <main className='min-h-screen bg-gray-50 py-6'>
      <div className='w-full space-y-6'>
        <header className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <div>
            <h1 className='text-3xl font-bold'>Sentiment Analyzer</h1>
            <p className='text-gray-700 text-sm'>Batch sentiment scoring with Gemini and CSV/Excel uploads.</p>
          </div>
          <div className='flex items-center gap-3 flex-wrap'>
            <button
              type='button'
              onClick={() => exportData('csv')}
              disabled={isLoading || data.length === 0}
              className='inline-flex items-center gap-2 bg-white border-2 border-black text-black rounded-lg px-3 py-2 text-sm shadow-sm disabled:opacity-50'
            >
              <IconTableExport size={18} stroke={2} />
              Export CSV
            </button>
            <button
              type='button'
              onClick={() => exportData('excel')}
              disabled={isLoading || data.length === 0}
              className='inline-flex items-center gap-2 bg-white border-2 border-black text-black rounded-lg px-3 py-2 text-sm shadow-sm disabled:opacity-50'
            >
              <IconFileDownload size={18} stroke={2} />
              Export Excel
            </button>
            <button
              type='button'
              onClick={runAnalysis}
              disabled={isLoading || data.length === 0 || !config.textColumn}
              className='inline-flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2 text-sm shadow-sm disabled:opacity-50'
            >
              {isLoading ? <IconLoader2 size={18} stroke={2} className='animate-spin' /> : <IconPlayerPlay size={18} stroke={2} />}
              {isLoading ? 'Running…' : 'Run Analysis'}
            </button>
          </div>
        </header>

        <StatusBanner status={status} hasErrors={Object.keys(rowErrors).length > 0} />

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-4'>
          <section className='lg:col-span-1 space-y-4'>
            <div className='bg-white border-2 border-black rounded-xl p-4 shadow-md space-y-3'>
              <h2 className='text-lg font-semibold'>Upload Data</h2>
              <FileUploader onFileChange={handleFileChange} fileName={fileName} disabled={!sheetReady} />
              {!sheetReady && (
                <div className='flex items-center gap-2 text-sm text-gray-700'>
                  <IconLoader2 size={16} stroke={2} className='animate-spin' />
                  <span>Loading file parser…</span>
                </div>
              )}
            </div>

            <div className='bg-white border-2 border-black rounded-xl p-4 shadow-md space-y-3'>
              <h2 className='text-lg font-semibold'>Configure Analysis</h2>
              <label className='flex flex-col gap-1 text-sm'>
                <span className='font-semibold'>Text column to analyze</span>
                <div className='relative'>
                  <select
                    name='textColumn'
                    value={config.textColumn}
                    onChange={handleConfigChange}
                    disabled={headers.length === 0}
                    className='w-full appearance-none bg-white border-2 border-black rounded-lg px-3 py-2 pr-10 shadow-sm focus:outline-none'
                  >
                    <option value='' disabled>
                      {headers.length === 0 ? 'No headers found' : 'Select a column'}
                    </option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  <IconChevronDown
                    size={18}
                    stroke={2}
                    className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-800'
                  />
                </div>
              </label>

              <Collapsible title='Output column names'>
                <div className='grid grid-cols-2 gap-3'>
                  <InputField
                    label='Positive score'
                    name='outputPositive'
                    value={config.outputPositive}
                    onChange={handleConfigChange}
                  />
                  <InputField
                    label='Neutral score'
                    name='outputNeutral'
                    value={config.outputNeutral}
                    onChange={handleConfigChange}
                  />
                  <InputField
                    label='Negative score'
                    name='outputNegative'
                    value={config.outputNegative}
                    onChange={handleConfigChange}
                  />
                  <InputField
                    label='Top label'
                    name='outputLabel'
                    value={config.outputLabel}
                    onChange={handleConfigChange}
                  />
                  <InputField
                    label='Reason'
                    name='outputReason'
                    value={config.outputReason}
                    onChange={handleConfigChange}
                  />
                </div>
              </Collapsible>

              <Collapsible title='Prompt settings'>
                <TextareaField
                  label='Base system prompt'
                  name='basePrompt'
                  value={config.basePrompt}
                  onChange={handleConfigChange}
                  rows={10}
                />
                <TextareaField
                  label='Custom rules (optional)'
                  name='customRules'
                  value={config.customRules}
                  onChange={handleConfigChange}
                  rows={5}
                  placeholder="Example: Treat any mention of 'bug' as negative regardless of tone."
                />
              </Collapsible>
            </div>
          </section>

          <section className='lg:col-span-3 bg-white border-2 border-black rounded-xl p-4 shadow-md flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <h2 className='text-lg font-semibold'>Data preview</h2>
              <span className='text-sm text-gray-700'>Showing first 20 rows</span>
            </div>
            <div className='overflow-auto border-2 border-dashed border-black rounded-lg h-full'>
              {data.length > 0 ? (
                <table className='min-w-full divide-y divide-gray-200 text-sm'>
                  <thead className='bg-gray-100'>
                    <tr>
                      {tableHeaders.map((header) => (
                        <th
                          key={header}
                          scope='col'
                          className='px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-800'
                        >
                          {header.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-200'>
                    {data.slice(0, 20).map((row) => {
                      const error = rowErrors[row.__rowId]
                      return (
                        <tr key={row.__rowId} className={error ? 'bg-gray-100' : ''}>
                          {tableHeaders.map((header) => {
                            const value = row[header]
                            let display = value

                            if (typeof value === 'number' && allOutputColumns.includes(header) && header !== config.outputLabel) {
                              const label =
                                header === config.outputPositive
                                  ? 'positive'
                                  : header === config.outputNegative
                                  ? 'negative'
                                  : 'neutral'
                              display = <SentimentCell value={value} label={label} />
                            }

                            if (header === config.textColumn && error) {
                              display = (
                                <div className='flex items-center gap-2'>
                                  <span className='truncate'>{value}</span>
                                  <span className='text-xs text-gray-800'>
                                    <IconAlertTriangle size={14} stroke={2} className='inline-block mr-1' />
                                    {error}
                                  </span>
                                </div>
                              )
                            }

                            return (
                              <td key={header} className='px-3 py-2 align-top max-w-xs truncate'>
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className='p-6 text-center text-gray-700'>Upload a CSV or Excel file to get started.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
