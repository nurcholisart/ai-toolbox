import React, { useEffect, useRef, useState } from 'react'
import { IconUpload, IconPlayerPlay, IconDownload } from '@tabler/icons-react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export default function Mp4ToMp3() {
  const [ffmpeg, setFfmpeg] = useState(null)
  const [ready, setReady] = useState(false)
  const [healthOk, setHealthOk] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [mp3Url, setMp3Url] = useState('')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [coreProgress, setCoreProgress] = useState(0)
  const [corePhase, setCorePhase] = useState('')
  const loadedRef = useRef(false)
  const dropRef = useRef(null)
  const CORE_URL = '/ffmpeg/esm/ffmpeg-core.js'
  const WASM_URL = CORE_URL.replace(/\.js$/, '.wasm')

  const diagnoseEnv = async () => {
    const logsOut = []
    const push = (m) => logsOut.push(m)
    push('[diag] ——— Environment Diagnostics ———')
    try {
      push(`[diag] UserAgent: ${navigator.userAgent}`)
      push(`[diag] Platform: ${navigator.platform}`)
    } catch {}
    try {
      // Module worker support check
      let supportsModuleWorker = false
      try {
        const blob = new Blob(['export {};'], { type: 'text/javascript' })
        const url = URL.createObjectURL(blob)
        const w = new Worker(url, { type: 'module' })
        supportsModuleWorker = true
        w.terminate()
        URL.revokeObjectURL(url)
      } catch {}
      push(`[diag] Module Worker: ${supportsModuleWorker ? 'yes' : 'no'}`)
    } catch {}
    try {
      push(`[diag] crossOriginIsolated: ${String(window.crossOriginIsolated)}`)
      push(`[diag] SharedArrayBuffer: ${typeof SharedArrayBuffer !== 'undefined' ? 'available' : 'missing'}`)
      push(`[diag] WebAssembly: ${typeof WebAssembly !== 'undefined' ? 'available' : 'missing'}`)
    } catch {}
    try {
      const resJs = await fetch(CORE_URL, { method: 'HEAD', cache: 'no-store' })
      push(`[diag] Core JS (${CORE_URL}): ${resJs.status}`)
    } catch (e) {
      push(`[diag] Core JS fetch error: ${e?.message || 'unknown'}`)
    }
    try {
      const resWasm = await fetch(WASM_URL, { method: 'HEAD', cache: 'no-store' })
      push(`[diag] Core WASM (${WASM_URL}): ${resWasm.status}`)
    } catch (e) {
      push(`[diag] Core WASM fetch error: ${e?.message || 'unknown'}`)
    }
    push('[diag] ——— End Diagnostics ———')
    setLogs((p) => [...p, ...logsOut])
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e) => { e.preventDefault(); el.classList.add('bg-gray-100') }
    const onDragLeave = () => { el.classList.remove('bg-gray-100') }
    const onDrop = (e) => {
      e.preventDefault(); el.classList.remove('bg-gray-100')
      const files = e.dataTransfer.files
      if (!files || !files.length) return
      handleFile(files[0])
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

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const preflightCheck = async () => {
      try {
        setLogs((p) => [...p, `[info] Checking core availability: ${CORE_URL}`])
        const resJs = await fetch(CORE_URL, { method: 'HEAD', cache: 'no-store' })
        const resWasm = await fetch(WASM_URL, { method: 'HEAD', cache: 'no-store' })
        if (!resJs.ok) throw new Error(`Cannot access ${CORE_URL} (status ${resJs.status})`)
        if (!resWasm.ok) throw new Error(`Cannot access ${WASM_URL} (status ${resWasm.status})`)
        setHealthOk(true)
        return true
      } catch (e) {
        setHealthOk(false)
        setLogs((p) => [
          ...p,
          `[error] Preflight failed: ${e?.message || 'Unknown'}`,
          '[hint] Ensure files are in public/ffmpeg/esm and accessible via /ffmpeg/esm/*',
        ])
        return false
      }
    }

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

    const loadFfmpeg = async () => {
      try {
        setLogs((p) => [...p, '[info] Preparing FFmpeg…'])
        const instance = new FFmpeg()
        instance.on('log', ({ type, message }) => {
          if (!message?.startsWith('frame=')) setLogs((prev) => [...prev.slice(-100), `[${type}] ${message}`])
        })
        instance.on('progress', ({ progress: r }) => setProgress(Math.round((r || 0) * 100)))

        setLogs((p) => [...p, '[info] Downloading ffmpeg core… this may take a while'])
        setCorePhase('Downloading core (JS)')
        setCoreProgress(0)
        const jsUrl = await fetchAsBlobUrl(CORE_URL, (pct) => setCoreProgress(pct))

        setCorePhase('Downloading core (WASM)')
        setCoreProgress(0)
        const wasmUrl = await fetchAsBlobUrl(WASM_URL, (pct) => setCoreProgress(pct))

        setCorePhase('Loading FFmpeg')
        await instance.load({ coreURL: jsUrl, wasmURL: wasmUrl })
        URL.revokeObjectURL(jsUrl)
        URL.revokeObjectURL(wasmUrl)
        setFfmpeg(instance)
        setReady(true)
        setLogs((p) => [...p, '[success] FFmpeg is ready'])
        setCorePhase('')
        setCoreProgress(0)
      } catch (e) {
        setLogs((p) => [
          ...p,
          `[error] ${e?.message || 'Failed to initialize FFmpeg'}`,
          '[hint] Ensure not inside a sandboxed iframe, disable ad-blockers, and allow access to cdn.jsdelivr.net',
        ])
      }
    }

    ;(async () => {
      const ok = await preflightCheck()
      if (ok) await loadFfmpeg()
    })()
  }, [])

  const handleFile = (file) => {
    if (!file) return
    if (!/\.mp4$/i.test(file.name)) {
      setLogs((p) => [...p, '[warn] Only MP4 is supported for now'])
      return
    }
    setVideoFile(file)
    setMp3Url('')
    setProgress(0)
    setLogs([])
  }

  const onFileChange = (e) => handleFile(e.target.files?.[0])

  const convert = async () => {
    if (!videoFile || !ffmpeg) return
    setIsLoading(true)
    setMp3Url('')
    setLogs(['[info] Starting conversion…'])
    setProgress(0)
    try {
      const inputName = videoFile.name
      const outputName = 'output.mp3'
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile))
      await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-ab', '192k', outputName])
      const data = await ffmpeg.readFile(outputName)
      const blob = new Blob([data.buffer], { type: 'audio/mpeg' })
      setMp3Url(URL.createObjectURL(blob))
      setLogs((p) => [...p, '[success] Conversion complete'])
      try { await ffmpeg.deleteFile(inputName) } catch {}
      try { await ffmpeg.deleteFile(outputName) } catch {}
    } catch (e) {
      setLogs((p) => [...p, `[error] ${e?.message || 'Conversion failed'}`])
    } finally {
      setIsLoading(false)
      setProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white border-2 border-black rounded-xl shadow-md p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">MP4 to MP3 Converter</h1>
            {!ready && (
              <div className="inline-flex items-center text-sm text-gray-700">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2A10 10 0 002 12h2zm2 5.3A8 8 0 104 12H2a10 10 0 1010 10v-2a8 8 0 01-6-2.7z"></path>
                </svg>
                Loading FFmpeg…
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={diagnoseEnv}
              className="inline-flex items-center text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100"
            >
              Diagnose
            </button>
          </div>

          {!ready && corePhase && (
            <div className="space-y-1">
              <p className="text-sm">{corePhase}: {coreProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-black h-2 rounded-full" style={{ width: `${coreProgress}%` }}></div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {healthOk === false && (
              <div className="border-2 border-black rounded-lg p-3 bg-gray-50 text-sm text-gray-800">
                <p className="font-medium">Failed to check FFmpeg core files.</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Ensure files exist: <code>/public/ffmpeg/esm/ffmpeg-core.js</code> and <code>ffmpeg-core.wasm</code>.</li>
                  <li>Rebuild or hard refresh the page.</li>
                  <li>Check Network tab for 404/403.</li>
                </ul>
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      setLogs((p) => [...p, '[info] Running preflight again…'])
                      setHealthOk(null)
                      try {
                        const resJs = await fetch(CORE_URL, { method: 'HEAD', cache: 'no-store' })
                        const resWasm = await fetch(WASM_URL, { method: 'HEAD', cache: 'no-store' })
                        if (!resJs.ok || !resWasm.ok) throw new Error('Core is not accessible')
                        setHealthOk(true)
                        setLogs((p) => [...p, '[success] Preflight succeeded. Loading FFmpeg…'])
                        // try to load if not already
                        if (!ready && !ffmpeg) {
                          const instance = new FFmpeg()
                          instance.on('log', ({ type, message }) => {
                            if (!message?.startsWith('frame=')) setLogs((prev) => [...prev.slice(-100), `[${type}] ${message}`])
                          })
                          instance.on('progress', ({ progress: r }) => setProgress(Math.round((r || 0) * 100)))
                          await instance.load({ coreURL: CORE_URL })
                          setFfmpeg(instance)
                          setReady(true)
                        }
                      } catch (e) {
                        setHealthOk(false)
                        setLogs((p) => [...p, `[error] Retry preflight failed: ${e?.message || 'Unknown'}`])
                      }
                    }}
                    className="inline-flex items-center px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
            <label className="block text-sm">Step 1: Upload an MP4 file</label>
            <div ref={dropRef} className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-black rounded-lg cursor-pointer bg-white hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-700">
                  <IconUpload className="mb-1" size={22} />
                  <p className="text-sm"><span className="font-medium">Click to upload</span> or drag & drop</p>
                  <p className="text-xs">MP4 only</p>
                </div>
                <input type="file" className="hidden" accept="video/mp4" onChange={onFileChange} disabled={!ready || isLoading} />
              </label>
            </div>
            {videoFile && <p className="text-sm text-gray-700">Selected: {videoFile.name}</p>}
          </div>

          <div>
            <button onClick={convert} disabled={!videoFile || !ready || isLoading} className="w-full inline-flex items-center justify-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2A10 10 0 002 12h2zm2 5.3A8 8 0 104 12H2a10 10 0 1010 10v-2a8 8 0 01-6-2.7z"></path>
                  </svg>
                  Converting…
                </>
              ) : (
                <>
                  <IconPlayerPlay className="mr-2" size={18} />
                  Convert to MP3
                </>
              )}
            </button>
          </div>

          {(isLoading || mp3Url) && (
            <div className="space-y-3">
              {isLoading && (
                <div>
                  <p className="text-sm mb-1">Progress: {progress}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-black h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}
              {mp3Url && !isLoading && (
                <div className="text-center">
                  <a href={mp3Url} download={(videoFile?.name || 'audio').replace(/\.[^/.]+$/, '') + '.mp3'} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black border-2 border-black rounded-lg hover:bg-gray-100">
                    <IconDownload size={18} />
                    Download MP3
                  </a>
                </div>
              )}
            </div>
          )}

          {logs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">FFmpeg Log</h3>
              <pre className="bg-white border-2 border-black rounded-lg p-3 h-40 overflow-y-auto text-xs text-gray-700 whitespace-pre-wrap break-words">{logs.join('\n')}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
