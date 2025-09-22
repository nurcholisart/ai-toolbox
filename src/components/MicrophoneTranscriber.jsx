import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconMicrophone, IconPlayerStop, IconUpload, IconCopy, IconDownload } from '@tabler/icons-react'
import { marked } from 'marked'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'

const MAX_SECONDS = 15 * 60 // 15 minutes

export default function MicrophoneTranscriber() {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [mimeType, setMimeType] = useState('audio/webm')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [markdown, setMarkdown] = useState('')
  const [activeTab, setActiveTab] = useState('markdown')

  const mediaStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const sourceRef = useRef(null)
  const [level, setLevel] = useState(0)
  const canvasRef = useRef(null)
  const resizeHandlerRef = useRef(null)

  useEffect(() => {
    marked.setOptions({ gfm: true, breaks: true })
  }, [])

  // Set Open Graph / Twitter meta for this route
  useEffect(() => {
    const title = 'Microphone Transcriber — Toolbox'
    const description = 'Record your voice up to 15 minutes and transcribe to clean GitHub Flavored Markdown with Gemini.'
    const image = `${window.location.origin}/og/microphone-transcriber.svg`
    const url = `${window.location.origin}/microphone-transcriber`

    document.title = title
    const setMeta = (attr, name, content) => {
      if (!content) return
      let q
      if (attr === 'property') q = `meta[property="${name}"]`
      else q = `meta[name="${name}"]`
      let tag = document.head.querySelector(q)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute(attr, name)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }

    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', 'Toolbox')
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', image)
    setMeta('property', 'og:url', url)

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', image)
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

  const resetRecordingState = () => {
    setIsRecording(false)
    setElapsed(0)
    chunksRef.current = []
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recorderRef.current) { try { recorderRef.current.stop() } catch {} recorderRef.current = null }
    // Cleanup audio meter
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    try { sourceRef.current && sourceRef.current.disconnect() } catch {}
    analyserRef.current = null
    sourceRef.current = null
    if (audioCtxRef.current) { try { audioCtxRef.current.close() } catch {} audioCtxRef.current = null }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Microphone not supported in this browser.')
      return
    }
    setMarkdown('')
    setAudioBlob(null)
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl('') }
    setStatus('Requesting microphone…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // Pick a supported mime type for audio; fall back to browser default
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]
      let chosen = ''
      for (const c of candidates) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) { chosen = c; break }
      }
      const rec = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined)
      setMimeType(chosen || rec.mimeType || 'audio/webm')
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chosen || rec.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setStatus('Recording complete. Ready to transcribe.')
      }
      rec.start(1000) // collect chunks every second
      recorderRef.current = rec
      setIsRecording(true)
      setStatus('Recording…')
      setElapsed(0)
      // Initialize audio level meter
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        const ctx = new Ctx()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        sourceRef.current = source
        const data = new Uint8Array(analyser.frequencyBinCount)
        const setupCanvas = () => {
          const canvas = canvasRef.current
          if (!canvas) return
          const dpr = window.devicePixelRatio || 1
          const rect = canvas.getBoundingClientRect()
          canvas.width = Math.max(1, Math.floor(rect.width * dpr))
          canvas.height = Math.max(1, Math.floor(rect.height * dpr))
          const ctx2d = canvas.getContext('2d')
          ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        setupCanvas()
        const onResize = () => setupCanvas()
        window.addEventListener('resize', onResize)
        resizeHandlerRef.current = onResize

        const loop = () => {
          analyser.getByteTimeDomainData(data)
          // Compute RMS from time-domain data (0-255 centered at 128)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          // Smooth and clamp
          setLevel((prev) => {
            const smoothed = prev * 0.8 + rms * 0.2
            return Math.max(0, Math.min(1, smoothed))
          })

          // Draw waveform
          const canvas = canvasRef.current
          if (canvas) {
            const ctx2d = canvas.getContext('2d')
            const rect = canvas.getBoundingClientRect()
            const w = rect.width
            const h = rect.height
            ctx2d.clearRect(0, 0, w, h)
            // Background is white via CSS; optional center line
            ctx2d.strokeStyle = '#000'
            ctx2d.lineWidth = 2
            ctx2d.beginPath()
            const slice = w / data.length
            for (let i = 0; i < data.length; i++) {
              const x = i * slice
              const v = data[i] / 255 // 0..1
              const y = v * h
              if (i === 0) ctx2d.moveTo(x, y)
              else ctx2d.lineTo(x, y)
            }
            ctx2d.stroke()
          }
          rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
      } catch {}
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1
          if (next >= MAX_SECONDS) {
            stopRecording()
          }
          return next
        })
      }, 1000)
    } catch (e) {
      setStatus(e?.message || 'Could not access microphone.')
    }
  }

  const stopRecording = () => {
    if (!isRecording) return
    try { recorderRef.current?.stop() } catch {}
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setIsRecording(false)
    // Do not stop tracks immediately; let onstop fire to assemble blob
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    // Cleanup audio meter
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    try { sourceRef.current && sourceRef.current.disconnect() } catch {}
    analyserRef.current = null
    sourceRef.current = null
    if (audioCtxRef.current) { try { audioCtxRef.current.close() } catch {} audioCtxRef.current = null }
    if (resizeHandlerRef.current) { window.removeEventListener('resize', resizeHandlerRef.current); resizeHandlerRef.current = null }
  }

  const formatTime = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const res = String(r.result || '')
      resolve(res.split(',')[1] || '')
    }
    r.onerror = reject
    r.readAsDataURL(blob)
  })

  const handleTranscribe = async () => {
    if (!audioBlob) { setStatus('Record audio first.'); return }
    if (!apiKey) { setStatus('API key not set. Open Settings to add your Gemini key.'); return }
    setIsTranscribing(true)
    setStatus('Uploading audio…')
    setMarkdown('')
    try {
      const base64 = await blobToBase64(audioBlob)
      const model = 'gemini-2.5-flash-preview-05-20'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const prompt = 'Transcribe this audio into clean, well-structured GitHub Flavored Markdown (GFM). Use paragraphs and lists when helpful. If multiple speakers are detected, label them as "Speaker 1:", "Speaker 2:". Return only the Markdown.'
      const payload = {
        contents: [{ parts: [ { text: prompt }, { inlineData: { mimeType, data: base64 } } ] }],
      }
      let retries = 3
      let delay = 1000
      for (let i = 0; i < retries; i++) {
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (resp.ok) {
          const data = await resp.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (!text) throw new Error('Invalid response format from API.')
          setMarkdown(text)
          setActiveTab('markdown')
          setStatus('Transcription complete.')
          return
        }
        if (resp.status === 429 || resp.status >= 500) {
          setStatus('API busy. Retrying…')
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
          continue
        }
        let msg = `HTTP error ${resp.status}`
        try { const err = await resp.json(); msg = err.error?.message || msg } catch {}
        throw new Error(msg)
      }
      throw new Error('API request failed after multiple retries.')
    } catch (e) {
      setStatus(e?.message || 'An error occurred.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleCopy = async () => {
    if (!markdown) return
    try { await navigator.clipboard.writeText(markdown); setStatus('Copied to clipboard.') }
    catch { setStatus('Failed to copy.') }
  }

  const handleDownload = () => {
    if (!markdown) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcription.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const previewHtml = useMemo(() => (markdown ? marked.parse(markdown) : ''), [markdown])

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border-2 border-black shadow-md p-6 sm:p-8">
          <header className="mb-6 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Microphone Transcriber</h1>
            <p className="text-gray-600 mt-2">Record up to 15 minutes, send to Gemini, and get a clean Markdown transcript.</p>
          </header>

          <section aria-label="Recorder" className="mb-6">
            <div className="flex flex-col items-center gap-6">
              {/* Big timer (elapsed) */}
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
                {formatTime(elapsed)}
              </div>
              <div className="text-sm text-gray-600">Remaining {formatTime(Math.max(0, MAX_SECONDS - elapsed))} of 15:00</div>

              {audioUrl && (
                <div className="w-full max-w-xl">
                  <audio controls src={audioUrl} className="w-full" />
                  <div className="mt-1 text-sm text-gray-700">
                    <span>Type: {mimeType}</span>
                    {audioBlob && <span> · Size: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB</span>}
                  </div>
                </div>
              )}

              {/* Input waveform */}
              {isRecording && (
                <div className="w-full max-w-3xl">
                  <canvas ref={canvasRef} className="w-full h-20" />
                </div>
              )}

              {/* Primary circular mic/stop button */}
              <div className="mt-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    aria-label="Start recording"
                    className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <IconMicrophone size={28} stroke={2} />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    aria-label="Stop recording"
                    className="w-20 h-20 rounded-full bg-white border-2 border-black text-black flex items-center justify-center hover:bg-gray-100 focus:outline-none"
                  >
                    <IconPlayerStop size={28} stroke={2} />
                  </button>
                )}
              </div>
            </div>
          </section>

          <section aria-label="Actions" className="mb-6 flex items-center gap-3 justify-center">
            <button
              onClick={handleTranscribe}
              disabled={!audioBlob || isTranscribing}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            >
              {isTranscribing ? 'Transcribing…' : 'Transcribe'}
            </button>
            <button
              onClick={() => { resetRecordingState(); setAudioBlob(null); setAudioUrl(''); setMarkdown(''); setStatus('') }}
              className="bg-white border-2 border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100 focus:outline-none"
            >
              Reset
            </button>
          </section>

          <div className="min-h-[1.5rem] mb-4 text-center">
            {status && <span className="text-gray-800 font-medium">{status}</span>}
          </div>

          {markdown && (
            <section aria-label="Output" className="w-full bg-white rounded-lg border-2 border-black">
              <div className="border-b-2 border-black">
                <nav className="-mb-px flex space-x-4 p-2" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('markdown')}
                    className={activeTab === 'markdown' ? 'text-black whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-black' : 'text-gray-600 hover:text-gray-800 whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-transparent'}
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={activeTab === 'preview' ? 'text-black whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-black' : 'text-gray-600 hover:text-gray-800 whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 border-transparent'}
                  >
                    Preview
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={handleCopy} className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none">
                      <IconCopy size={16} stroke={2} /> Copy
                    </button>
                    <button onClick={handleDownload} className="inline-flex items-center gap-2 bg-white border-2 border-black text-black font-semibold py-1 px-3 rounded text-sm hover:bg-gray-100 focus:outline-none">
                      <IconDownload size={16} stroke={2} /> Download
                    </button>
                  </div>
                </nav>
              </div>
              <div className="p-4">
                {activeTab === 'markdown' ? (
                  <textarea readOnly className="w-full h-96 p-3 font-mono text-sm bg-white border-2 border-black rounded-md focus:outline-none" value={markdown} />
                ) : (
                  <div className="h-96 overflow-y-auto bg-white p-3 border-2 border-black rounded-md">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}
              </div>
            </section>
          )}

          <Disclosure />
        </div>
      </div>
    </div>
  )
}
