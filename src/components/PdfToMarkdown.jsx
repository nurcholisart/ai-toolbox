import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'
import { marked } from 'marked'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function PdfToMarkdown() {
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [markdown, setMarkdown] = useState('')
  const [activeTab, setActiveTab] = useState('markdown')

  const dropRef = useRef(null)
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    marked.setOptions({ gfm: true, breaks: true })
  }, [])

  useEffect(() => {
    const load = () => setApiKey(getApiKey())
    load()
    const onCfg = () => load()
    window.addEventListener('ai-toolbox:config-updated', onCfg)
    window.addEventListener('storage', onCfg)
    return () => {
      window.removeEventListener('ai-toolbox:config-updated', onCfg)
      window.removeEventListener('storage', onCfg)
    }
  }, [])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return

    const onDragOver = (e) => {
      e.preventDefault()
      el.classList.add('border-black', 'bg-gray-100')
    }
    const onDragLeave = () => {
      el.classList.remove('border-black', 'bg-gray-100')
    }
    const onDrop = (e) => {
      e.preventDefault()
      el.classList.remove('border-black', 'bg-gray-100')
      const files = e.dataTransfer.files
      if (!files || !files.length) return
      const f = files[0]
      if (f.type !== 'application/pdf') {
        updateStatus('Please drop a valid PDF file.', 'error')
        setFile(null)
        setFileName('')
        return
      }
      setFile(f)
      setFileName(f.name)
      if (status.type === 'error') setStatus({ type: '', message: '' })
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [status.type])

  const updateStatus = (message, type) => setStatus({ message, type })

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) {
      setFile(null)
      setFileName('')
      return
    }
    if (f.type !== 'application/pdf') {
      updateStatus('Please select a valid PDF file.', 'error')
      setFile(null)
      setFileName('')
      return
    }
    setFile(f)
    setFileName(f.name)
    if (status.type === 'error') setStatus({ type: '', message: '' })
  }

  const extractTextFromPDF = async (file) => {
    const buf = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(buf))
    const pdf = await loadingTask.promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      const pageText = tc.items.map((item) => item.str).join(' ')
      text += pageText + '\n\n'
    }
    return text
  }

  const convertToMarkdown = async (text) => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`

    const systemPrompt = 'You are an expert in document formatting. Convert the following text, which was extracted from a PDF, into clean, well-structured, and readable GitHub Flavored Markdown (GFM). Retain the original meaning and structure, including headings, lists, paragraphs, tables, and code blocks. Do not add any extra commentary or introductory text. Just provide the raw markdown output.'

    const payload = {
      contents: [
        {
          parts: [
            {
              text: `Please convert the following text to GitHub Flavored Markdown:\n\n---\n\n${text}`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    }

    let retries = 3
    let delay = 1000
    for (let i = 0; i < retries; i++) {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (resp.ok) {
        const result = await resp.json()
        const candidate = result.candidates?.[0]
        const textOut = candidate?.content?.parts?.[0]?.text
        if (!textOut) throw new Error('Invalid response structure from API.')
        return textOut
      }
      if (resp.status === 429 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, delay))
        delay *= 2
        continue
      }
      let msg = `HTTP error ${resp.status}`
      try {
        const err = await resp.json()
        msg = err.error?.message || msg
      } catch {}
      throw new Error(msg)
    }
    throw new Error('API request failed after multiple retries.')
  }

  const handleConvert = async () => {
    if (!file) {
      updateStatus('Please select a PDF file first.', 'error')
      return
    }
    if (!apiKey) {
      updateStatus('API key not set. Open Settings to add your Gemini key.', 'error')
      return
    }
    setIsLoading(true)
    setMarkdown('')
    updateStatus('Extracting text from PDF...', 'loading')
    try {
      const text = await extractTextFromPDF(file)
      if (!text.trim()) throw new Error('Could not extract any text from the PDF. It might be an image-based PDF.')
      updateStatus('Converting to Markdown with Gemini...', 'loading')
      const md = await convertToMarkdown(text)
      setMarkdown(md)
      updateStatus('Conversion successful!', 'success')
      setActiveTab('markdown')
    } catch (e) {
      console.error(e)
      updateStatus(e.message || 'An error occurred.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!markdown) return
    try {
      await navigator.clipboard.writeText(markdown)
      updateStatus('Markdown copied to clipboard!', 'success')
      setTimeout(() => setStatus({ type: '', message: '' }), 2000)
    } catch {
      updateStatus('Failed to copy to clipboard.', 'error')
    }
  }

  const previewHtml = useMemo(() => (markdown ? marked.parse(markdown) : ''), [markdown])

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">PDF to Markdown Converter</h1>
            <p className="text-gray-600 mt-2">Upload a PDF and convert its content to Markdown using Gemini.</p>
          </div>

        <div className="flex flex-col items-center justify-center space-y-4 mb-8">
          <label
            ref={dropRef}
            htmlFor="pdf-file"
            className="flex flex-col items-center justify-center w-full max-w-lg p-8 text-center bg-white border-2 border-dashed border-black rounded-lg cursor-pointer hover:border-black transition-colors duration-300"
          >
            <svg className="w-12 h-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="mt-4 text-lg text-gray-600">Drag & drop your PDF here</p>
            <p className="mt-1 text-sm text-gray-500">
              or <span className="text-gray-900 font-semibold">click to browse</span>
            </p>
            <p className="mt-2 text-sm font-medium text-gray-700">{fileName}</p>
            <input id="pdf-file" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          </label>
          <button
            onClick={handleConvert}
            disabled={isLoading}
            className="bg-black text-white font-semibold py-2 px-6 rounded-md shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing…' : 'Convert to Markdown'}
          </button>
        </div>

        <div className="text-center min-h-[2rem] mb-4">
          {status.message && (
            <span
              className={
                status.type === 'success'
                  ? 'text-gray-800 font-medium'
                  : status.type === 'error'
                  ? 'text-gray-800 font-medium'
                  : 'text-gray-800 font-medium'
              }
            >
              {status.type === 'loading' && (
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 inline text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {status.message}
            </span>
          )}
        </div>

        {markdown && (
          <div className="w-full bg-white rounded-lg border-2 border-black">
            <div className="border-b-2 border-black">
              <nav className="-mb-px flex space-x-4 p-2" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('markdown')}
                  className={
                    activeTab === 'markdown'
                      ? 'text-black whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-black'
                      : 'text-gray-600 hover:text-gray-800 whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-transparent'
                  }
                >
                  Markdown
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={
                    activeTab === 'preview'
                      ? 'text-black whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-black'
                      : 'text-gray-600 hover:text-gray-800 whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-transparent'
                  }
                >
                  Preview
                </button>
                <button
                  onClick={handleCopy}
                  className="ml-auto bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition duration-300"
                >
                  Copy Markdown
                </button>
              </nav>
            </div>
            <div className="p-4">
              {activeTab === 'markdown' ? (
                <textarea
                  readOnly
                  className="w-full h-96 p-3 font-mono text-sm bg-white border-2 border-black rounded-md focus:outline-none"
                  value={markdown}
                />
              ) : (
                <div className="h-96 overflow-y-auto bg-white p-3 border-2 border-black rounded-md">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              )}
            </div>
          </div>
        )}
        <Disclosure />
        </div>
      </div>
    </div>
  )
}
