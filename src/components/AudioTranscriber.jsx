import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconArrowLeft, IconSettings, IconUpload, IconPlayerStop, IconCopy, IconDownload } from '@tabler/icons-react'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'

export default function AudioTranscriber() {
  const [audioFile, setAudioFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [activeTab, setActiveTab] = useState('markdown')

  const abortControllerRef = useRef(null)
  const dropRef = useRef(null)

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
      el.classList.add('bg-gray-100')
    }
    const onDragLeave = () => {
      el.classList.remove('bg-gray-100')
    }
    const onDrop = (e) => {
      e.preventDefault()
      el.classList.remove('bg-gray-100')
      const files = e.dataTransfer.files
      if (!files || !files.length) return
      handleIncomingFile(files[0])
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])

  const updateStatus = (msg) => setStatus(msg)

  const handleIncomingFile = (file) => {
    if (!file) return

    setAudioFile(null)
    setTranscript('')
    setStatus('')
    setFileName('')

    const MAX_FILE_SIZE_MB = 25
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateStatus(`File is too large. Max ${MAX_FILE_SIZE_MB} MB.`)
      return
    }

    const audioUrl = URL.createObjectURL(file)
    const audioEl = new Audio(audioUrl)
    audioEl.onloadedmetadata = () => {
      URL.revokeObjectURL(audioUrl)
      const MAX_DURATION_MIN = 60
      if (audioEl.duration > MAX_DURATION_MIN * 60) {
        updateStatus(`Audio is too long. Max ${MAX_DURATION_MIN} minutes.`)
        return
      }
      setAudioFile(file)
      setFileName(file.name)
    }
    audioEl.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      updateStatus('Could not read audio metadata. Unsupported or corrupted file.')
    }
  }

  const handleFileChange = (e) => handleIncomingFile(e.target.files?.[0])

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const res = String(reader.result || '')
        const base64 = res.split(',')[1] || ''
        resolve({ base64, mimeType: file.type || 'audio/mpeg' })
      }
      reader.onerror = (err) => reject(err)
    })

  const handleTranscribe = useCallback(async () => {
    if (!audioFile) {
      updateStatus('Please select an audio file first.')
      return
    }
    if (!apiKey) {
      updateStatus('API key not set. Open Settings to add your Gemini key.')
      return
    }

    abortControllerRef.current = new AbortController()
    setIsLoading(true)
    setTranscript('')
    updateStatus('Uploading audio…')

    try {
      const { base64, mimeType } = await fileToBase64(audioFile)
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`

      const userPrompt = 'Transcribe this audio file. Format as GitHub Flavored Markdown with clear headings, paragraphs, and add speaker labels like "Speaker 1:" if multiple speakers are detected.'

      const payload = {
        contents: [
          {
            parts: [
              { text: userPrompt },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
      }

      let retries = 3
      let delay = 1000
      for (let i = 0; i < retries; i++) {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        })
        if (resp.ok) {
          const result = await resp.json()
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (!text) throw new Error('Invalid response format from API.')
          setTranscript(text)
          updateStatus('Transcription complete.')
          return
        }
        if (resp.status === 429 || resp.status >= 500) {
          updateStatus('API busy. Retrying…')
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
    } catch (e) {
      if (e?.name === 'AbortError') updateStatus('Transcription cancelled.')
      else updateStatus(e?.message || 'An error occurred.')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [audioFile, apiKey])

  const handleCancel = () => {
    abortControllerRef.current?.abort()
  }

  const handleCopy = async () => {
    if (!transcript) return
    try {
      await navigator.clipboard.writeText(transcript)
      updateStatus('Copied to clipboard.')
      setTimeout(() => setStatus(''), 1500)
    } catch {
      updateStatus('Failed to copy.')
    }
  }

  const handleDownload = () => {
    if (!transcript) return
    const blob = new Blob([transcript], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcription.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const previewHtml = useMemo(() => transcript, [transcript])

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Audio Transcriber</h1>
            <p className="text-gray-600 mt-2">Upload an audio file and get a structured Markdown transcript using Gemini.</p>
          </div>

          <div className="flex flex-col items-center justify-center space-y-4 mb-8">
            <label
              ref={dropRef}
              htmlFor="audio-file"
              className="flex flex-col items-center justify-center w-full max-w-lg p-8 text-center bg-white border-2 border-dashed border-black rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-300"
            >
              <IconUpload size={40} stroke={1.5} className="text-gray-500" />
              <p className="mt-4 text-lg text-gray-600">Drag & drop your audio here</p>
              <p className="mt-1 text-sm text-gray-500">or <span className="text-gray-900 font-semibold">click to browse</span></p>
              <p className="mt-2 text-sm text-gray-700">MP3, WAV, M4A (Max 25MB, 60 mins)</p>
              {fileName && <p className="mt-2 text-sm font-medium text-gray-800">{fileName}</p>}
              <input id="audio-file" type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            </label>

            <button
              onClick={handleTranscribe}
              disabled={isLoading}
              className="bg-black text-white font-semibold py-2 px-6 rounded-md shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing…' : 'Transcribe Audio'}
            </button>

            {isLoading && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-2 px-4 rounded-md hover:bg-gray-100 focus:outline-none"
              >
                <IconPlayerStop size={18} stroke={2} /> Cancel
              </button>
            )}
          </div>

          <div className="text-center min-h-[2rem] mb-4">
            {status && <span className="text-gray-800 font-medium">{status}</span>}
          </div>

          {transcript && (
            <div className="w-full bg-white rounded-lg border-2 border-black">
              <div className="border-b border-black/20 px-4">
                <nav className="-mb-px flex items-center gap-2">
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
                    onClick={handleCopy}
                    className="ml-auto inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition duration-300"
                  >
                    <IconCopy size={16} stroke={2} /> Copy
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black transition duration-300"
                  >
                    <IconDownload size={16} stroke={2} /> Download
                  </button>
                </nav>
              </div>
              <div className="p-4">
                {activeTab === 'markdown' && (
                  <textarea
                    readOnly
                    className="w-full h-96 p-3 font-mono text-sm bg-white border-2 border-black rounded-md focus:outline-none"
                    value={previewHtml}
                  />
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
