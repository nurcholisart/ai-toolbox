import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconUpload, IconCopy, IconDownload, IconPlayerStop, IconLoader2 } from '@tabler/icons-react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'

// Meeting Transcription
// Flow:
// 1) Accept audio/video up to 1GB
// 2) Convert to mp3 when needed (video: mp4/webm/mov/wav; audio: mp3 okay, otherwise convert)
// 3) Split mp3 into <= 900s segments
// 4) Transcribe each via Gemini and combine to GFM

export default function MeetingTranscription() {
  const [ffmpeg, setFfmpeg] = useState(null)
  const [ready, setReady] = useState(false)
  const [healthOk, setHealthOk] = useState(null)
  const [coreProgress, setCoreProgress] = useState(0)
  const [corePhase, setCorePhase] = useState('')

  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [language, setLanguage] = useState('English')
  const [resultMd, setResultMd] = useState('')
  const [apiKey, setApiKey] = useState('')

  const abortRef = useRef(null)
  const dropRef = useRef(null)
  const CORE_URL = '/ffmpeg/esm/ffmpeg-core.js'
  const WASM_URL = CORE_URL.replace(/\.js$/, '.wasm')

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

  // Drag & drop wiring
  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e) => { e.preventDefault(); el.classList.add('bg-gray-100') }
    const onDragLeave = () => { el.classList.remove('bg-gray-100') }
    const onDrop = (e) => {
      e.preventDefault(); el.classList.remove('bg-gray-100')
      const files = e.dataTransfer.files
      if (!files || !files.length) return
      handleIncoming(files[0])
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

  // Preflight + load FFmpeg core as blob URLs with progress
  useEffect(() => {
    let mounted = true
    const fetchAsBlobUrl = async (url, onProgress) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to download ${url} (status ${res.status})`)
      const total = Number(res.headers.get('content-length') || 0)
      if (!res.body || !total || !res.body.getReader) {
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      }
      const reader = res.body.getReader()
      const chunks = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        onProgress && onProgress(Math.round((received / total) * 100))
      }
      const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' })
      return URL.createObjectURL(blob)
    }

    const preflight = async () => {
      try {
        const resJs = await fetch(CORE_URL, { method: 'HEAD', cache: 'no-store' })
        const resWasm = await fetch(WASM_URL, { method: 'HEAD', cache: 'no-store' })
        if (!resJs.ok || !resWasm.ok) throw new Error('FFmpeg core not accessible')
        if (!mounted) return
        setHealthOk(true)
      } catch (e) {
        if (!mounted) return
        setHealthOk(false)
      }
    }

    const loadCore = async () => {
      try {
        setCorePhase('Downloading core (JS)')
        setCoreProgress(0)
        const jsUrl = await fetchAsBlobUrl(CORE_URL, (p) => setCoreProgress(p))
        setCorePhase('Downloading core (WASM)')
        setCoreProgress(0)
        const wasmUrl = await fetchAsBlobUrl(WASM_URL, (p) => setCoreProgress(p))
        const inst = new FFmpeg()
        inst.on('progress', ({ progress }) => { /* noop or could wire */ })
        setCorePhase('Loading FFmpeg')
        await inst.load({ coreURL: jsUrl, wasmURL: wasmUrl })
        URL.revokeObjectURL(jsUrl)
        URL.revokeObjectURL(wasmUrl)
        if (!mounted) return
        setFfmpeg(inst)
        setReady(true)
        setCorePhase('')
        setCoreProgress(0)
      } catch (e) {
        if (!mounted) return
        setHealthOk(false)
      }
    }

    ;(async () => {
      await preflight()
      if (healthOk !== false) await loadCore()
    })()

    return () => { mounted = false }
  }, [])

  const updateStatus = (m) => setStatus(m)

  const handleIncoming = (f) => {
    if (!f) return
    setFile(null)
    setFileName('')
    setResultMd('')
    setStatus('')
    const MAX_MB = 1024
    if (f.size > MAX_MB * 1024 * 1024) {
      updateStatus(`File is too large. Max ${MAX_MB}MB.`)
      return
    }
    const ok = /\.(mp3|mp4|webm|mov|wav)$/i.test(f.name)
    if (!ok) {
      updateStatus('Unsupported file. Use mp3, mp4, webm, mov, or wav.')
      return
    }
    setFile(f)
    setFileName(f.name)
  }

  const onFileChange = (e) => handleIncoming(e.target.files?.[0])

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onload = () => {
        const res = String(reader.result || '')
        resolve(res.split(',')[1] || '')
      }
      reader.onerror = (err) => reject(err)
    })

  const fileToBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(f)
      reader.onload = () => {
        const res = String(reader.result || '')
        resolve(res.split(',')[1] || '')
      }
      reader.onerror = (err) => reject(err)
    })

  const getAudioDuration = (blob) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const a = new Audio(url)
      a.onloadedmetadata = () => {
        const d = a.duration
        URL.revokeObjectURL(url)
        if (!isFinite(d) || !d) return reject(new Error('Could not read audio duration'))
        resolve(d)
      }
      a.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load audio metadata'))
      }
      // Safari might require play() then pause immediately, but skip for now
    })

  const transcribeChunk = async (chunkBlob, idx, total) => {
    const base64 = await blobToBase64(chunkBlob)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`
    const lang = language
    const prompt = `Transcribe this audio segment. Output only GitHub Flavored Markdown. Use clear paragraphs and, if multiple speakers are detected, label as "Speaker 1:", "Speaker 2:". Respond in ${lang}.`
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'audio/mpeg', data: base64 } },
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
        signal: abortRef.current?.signal,
      })
      if (resp.ok) {
        const result = await resp.json()
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (!text) throw new Error('Invalid response from API.')
        return text
      }
      if (resp.status === 429 || resp.status >= 500) {
        updateStatus(`API busy for segment ${idx + 1}/${total}. Retrying…`)
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

  const handleProcess = async () => {
    if (!file) {
      updateStatus('Please select a file first.')
      return
    }
    if (!apiKey) {
      updateStatus('API key not set. Open Settings to add your Gemini key.')
      return
    }
    if (!ready || !ffmpeg) {
      updateStatus('FFmpeg is not ready yet. Please wait a moment.')
      return
    }

    setIsProcessing(true)
    setResultMd('')
    abortRef.current = new AbortController()
    try {
      updateStatus('Preparing audio…')

      const ext = (file.name.split('.').pop() || '').toLowerCase()
      const isAudioMp3 = ext === 'mp3'
      const isVideoish = /^(mp4|webm|mov|wav)$/.test(ext)

      let mp3Blob = null

      if (isAudioMp3) {
        mp3Blob = file
      } else if (isVideoish || !isAudioMp3) {
        // Convert to MP3 via ffmpeg
        const inputName = file.name
        const outputName = 'output.mp3'
        await ffmpeg.writeFile(inputName, await fetchFile(file))
        // re-encode to a sane bitrate to keep chunks small
        await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-ab', '128k', outputName])
        const data = await ffmpeg.readFile(outputName)
        mp3Blob = new Blob([data.buffer], { type: 'audio/mpeg' })
        try { await ffmpeg.deleteFile(inputName) } catch {}
        try { await ffmpeg.deleteFile(outputName) } catch {}
      }

      // Determine duration
      updateStatus('Analyzing audio duration…')
      const totalSec = await getAudioDuration(mp3Blob)

      // Split into <= 900s chunks
      const MAX_CHUNK = 900 // seconds
      const chunks = []
      const inputName = 'full.mp3'
      await ffmpeg.writeFile(inputName, await fetchFile(mp3Blob))

      const totalChunks = Math.max(1, Math.ceil(totalSec / MAX_CHUNK))
      for (let i = 0; i < totalChunks; i++) {
        const start = i * MAX_CHUNK
        const dur = Math.min(MAX_CHUNK, Math.max(0, Math.ceil(totalSec - start)))
        const out = `chunk_${i}.mp3`
        updateStatus(`Splitting audio… ${i + 1}/${totalChunks}`)
        // re-encode each chunk for accurate trims across formats
        await ffmpeg.exec([
          '-ss', String(start),
          '-t', String(dur),
          '-i', inputName,
          '-acodec', 'libmp3lame', '-ab', '128k',
          out,
        ])
        const buf = await ffmpeg.readFile(out)
        chunks.push(new Blob([buf.buffer], { type: 'audio/mpeg' }))
        try { await ffmpeg.deleteFile(out) } catch {}
      }
      try { await ffmpeg.deleteFile(inputName) } catch {}

      // Transcribe each chunk
      const parts = []
      for (let i = 0; i < chunks.length; i++) {
        updateStatus(`Transcribing segment ${i + 1}/${chunks.length}…`)
        const text = await transcribeChunk(chunks[i], i, chunks.length)
        parts.push(text)
      }

      // Combine results
      updateStatus('Combining results…')
      const combined = parts
        .map((t, i) => `## Segment ${i + 1}\n\n${t.trim()}`)
        .join('\n\n')
      setResultMd(`# Meeting Transcription\n\n- Source: ${fileName}\n- Language: ${language}\n- Segments: ${parts.length}\n\n${combined}`)
      updateStatus('Done.')
    } catch (e) {
      if (e?.name === 'AbortError') updateStatus('Cancelled.')
      else updateStatus(e?.message || 'An error occurred.')
    } finally {
      setIsProcessing(false)
      abortRef.current = null
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleCopy = async () => {
    if (!resultMd) return
    try {
      await navigator.clipboard.writeText(resultMd)
      updateStatus('Copied to clipboard.')
      setTimeout(() => setStatus(''), 1500)
    } catch {
      updateStatus('Failed to copy.')
    }
  }

  const handleDownload = () => {
    if (!resultMd) return
    const blob = new Blob([resultMd], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (fileName || 'meeting')
      .replace(/\.[^/.]+$/, '') + '.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const previewValue = useMemo(() => resultMd, [resultMd])

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Meeting Transcription</h1>
              <p className="text-gray-600 mt-1 text-sm">Upload audio or video, convert to MP3, split into 15-minute chunks, and transcribe to Markdown.</p>
            </div>
            {!ready && (
              <div className="inline-flex items-center text-sm text-gray-700">
                <IconLoader2 className="animate-spin -ml-1 mr-2" size={16} />
                Loading FFmpeg… {corePhase && `${corePhase} ${coreProgress ? `(${coreProgress}%)` : ''}`}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-800 mb-1">Output Language</label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Indonesia">Bahasa Indonesia</option>
              </select>
            </div>
            <div className="flex items-end text-sm text-gray-600">
              <p>Limitations: Max file size 1GB. Segments up to 900s each.</p>
            </div>
          </div>

          {healthOk === false && (
            <div className="border-2 border-black rounded-lg p-3 bg-gray-50 text-sm text-gray-800 mb-4">
              <p className="font-medium">Could not access FFmpeg core files.</p>
              <p>Ensure files exist at <code>/public/ffmpeg/esm/ffmpeg-core.js</code> and <code>.wasm</code>. Reload the page.</p>
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-4 mb-6">
            <label
              ref={dropRef}
              htmlFor="meeting-file"
              className="flex flex-col items-center justify-center w-full max-w-lg p-8 text-center bg-white border-2 border-dashed border-black rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-300"
            >
              <IconUpload size={40} stroke={1.5} className="text-gray-500" />
              <p className="mt-4 text-lg text-gray-600">Drag & drop your audio or video here</p>
              <p className="mt-1 text-sm text-gray-500">mp3, mp4, webm, mov, wav (Max 1GB)</p>
              {fileName && <p className="mt-2 text-sm font-medium text-gray-800">{fileName}</p>}
              <input id="meeting-file" type="file" accept="audio/*,video/*" className="hidden" onChange={onFileChange} />
            </label>

            <button
              onClick={handleProcess}
              disabled={!file || isProcessing}
              className="bg-black text-white font-semibold py-2 px-6 rounded-md shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing…' : 'Transcribe Meeting'}
            </button>

            {isProcessing && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-2 px-4 rounded-md hover:bg-gray-100 focus:outline-none"
              >
                <IconPlayerStop size={18} stroke={2} /> Cancel
              </button>
            )}
          </div>

          <div className="text-center min-h-[1.5rem] mb-4">
            {status && <span className="text-gray-800 font-medium">{status}</span>}
          </div>

          {resultMd && (
            <div className="w-full bg-white rounded-lg border-2 border-black">
              <div className="border-b border-black/20 px-4 flex items-center gap-2">
                <span className="py-3 px-0 text-sm font-medium">Markdown</span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={handleCopy} className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none">
                    <IconCopy size={16} stroke={2} /> Copy
                  </button>
                  <button onClick={handleDownload} className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none">
                    <IconDownload size={16} stroke={2} /> Download
                  </button>
                </div>
              </div>
              <div className="p-4">
                <textarea
                  readOnly
                  className="w-full h-96 p-3 font-mono text-sm bg-white border-2 border-black rounded-md focus:outline-none"
                  value={previewValue}
                />
              </div>
            </div>
          )}
          <Disclosure />
        </div>
      </div>
    </div>
  )
}
