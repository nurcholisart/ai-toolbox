import React, { useEffect, useRef, useState } from 'react'

export default function ScreenRecorder() {
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showCam, setShowCam] = useState(false)
  const [useMic, setUseMic] = useState(false)
  const [enableAnnotate, setEnableAnnotate] = useState(false)
  const [enableZoom, setEnableZoom] = useState(false)
  const [chunks, setChunks] = useState([])
  const [mimeType, setMimeType] = useState('video/webm;codecs=vp8,opus')
  const [notice, setNotice] = useState('')
  const [time, setTime] = useState(0)
  const [error, setError] = useState('')
  const screenVideoRef = useRef(null)
  const camVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const recorderRef = useRef(null)
  const rafRef = useRef(null)
  const streamsRef = useRef({})

  const [bubble, setBubble] = useState({ x: 20, y: 20, size: 160, drag: false, resize: false })

  const shapesRef = useRef([])
  const undoneRef = useRef([])
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#ff0000')
  const [size, setSize] = useState(2)
  const drawingRef = useRef(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomSelRef = useRef(null)

  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  const formatTime = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${m}:${sec}`
  }

  const drawShapes = (ctx) => {
    shapesRef.current.forEach((sh) => {
      ctx.strokeStyle = sh.color
      ctx.lineWidth = sh.size
      ctx.fillStyle = sh.color
      if (sh.type === 'pen') {
        ctx.beginPath()
        sh.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
        ctx.stroke()
      }
      if (sh.type === 'rect') {
        const { x, y, w, h } = sh
        ctx.strokeRect(x, y, w, h)
      }
      if (sh.type === 'arrow') {
        const { x1, y1, x2, y2 } = sh
        const headlen = 10
        const angle = Math.atan2(y2 - y1, x2 - x1)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
        ctx.closePath()
        ctx.fill()
      }
      if (sh.type === 'text') {
        ctx.font = `${sh.size * 6}px sans-serif`
        ctx.fillText(sh.text, sh.x, sh.y)
      }
    })
  }

  const draw = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const screenVideo = screenVideoRef.current
    if (screenVideo && screenVideo.readyState >= 2) {
      const vw = screenVideo.videoWidth
      const vh = screenVideo.videoHeight
      const sw = vw / zoom
      const sh = vh / zoom
      ctx.drawImage(screenVideo, pan.x, pan.y, sw, sh, 0, 0, canvas.width, canvas.height)
    }
    drawShapes(ctx)
    if (showCam) {
      const camVideo = camVideoRef.current
      if (camVideo && camVideo.readyState >= 2) {
        const { x, y, size } = bubble
        ctx.save()
        ctx.beginPath()
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(camVideo, x, y, size, size)
        ctx.restore()
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(x + size - 12, y + size - 12, 12, 12)
      }
    }
    rafRef.current = requestAnimationFrame(draw)
  }

  const start = async () => {
    setError('')
    setNotice('')
    let type = 'video/webm;codecs=vp8,opus'
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      type = 'video/mp4'
    } else {
      setNotice('MP4 unsupported, using WebM')
    }
    setMimeType(type)
    setChunks([])
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true })
      streamsRef.current.display = display
      const screenVideo = screenVideoRef.current
      screenVideo.srcObject = display
      await screenVideo.play()
      const canvas = canvasRef.current
      canvas.width = screenVideo.videoWidth
      canvas.height = screenVideo.videoHeight

      let cam = null
      if (showCam || useMic) {
        cam = await navigator.mediaDevices.getUserMedia({ video: showCam, audio: useMic })
        streamsRef.current.cam = cam
        if (showCam && cam.getVideoTracks()[0]) {
          camVideoRef.current.srcObject = new MediaStream([cam.getVideoTracks()[0]])
          await camVideoRef.current.play()
        }
      }

      const canvasStream = canvas.captureStream(30)
      const tracks = [canvasStream.getVideoTracks()[0]]
      if (display.getAudioTracks()[0]) tracks.push(display.getAudioTracks()[0])
      if (useMic && cam && cam.getAudioTracks()[0]) tracks.push(cam.getAudioTracks()[0])
      const mixed = new MediaStream(tracks)
      const rec = new MediaRecorder(mixed, { mimeType: type, videoBitsPerSecond: 5_000_000 })
      recorderRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size) setChunks((p) => [...p, e.data]) }
      rec.onstop = () => {}
      rec.start()
      setRecording(true)
      setPaused(false)
      setTime(0)
      rafRef.current = requestAnimationFrame(draw)
    } catch (e) {
      setError(e.message || 'Permission denied')
    }
  }

  const stop = () => {
    recorderRef.current?.stop()
    Object.values(streamsRef.current).forEach((s) => s && s.getTracks().forEach((t) => t.stop()))
    cancelAnimationFrame(rafRef.current)
    setRecording(false)
    setPaused(false)
    const blob = new Blob(chunks, { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = mimeType === 'video/mp4' ? 'recording.mp4' : 'recording.webm'
    a.click()
    URL.revokeObjectURL(url)
  }

  const pause = () => {
    recorderRef.current?.pause()
    setPaused(true)
  }
  const resume = () => {
    recorderRef.current?.resume()
    setPaused(false)
  }

  const handlePointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (enableZoom) {
      zoomSelRef.current = { x, y }
      return
    }
    if (showCam) {
      const b = bubble
      const inside = x >= b.x && x <= b.x + b.size && y >= b.y && y <= b.y + b.size
      const onHandle = x >= b.x + b.size - 12 && y >= b.y + b.size - 12
      if (onHandle) {
        setBubble({ ...b, resize: true })
        return
      }
      if (inside) {
        setBubble({ ...b, drag: true, offsetX: x - b.x, offsetY: y - b.y })
        return
      }
    }
    if (!enableAnnotate) return
    const base = { color, size }
    if (tool === 'pen') {
      drawingRef.current = { ...base, type: 'pen', points: [{ x, y }] }
      shapesRef.current.push(drawingRef.current)
    } else if (tool === 'rect') {
      drawingRef.current = { ...base, type: 'rect', x, y, w: 0, h: 0 }
      shapesRef.current.push(drawingRef.current)
    } else if (tool === 'arrow') {
      drawingRef.current = { ...base, type: 'arrow', x1: x, y1: y, x2: x, y2: y }
      shapesRef.current.push(drawingRef.current)
    } else if (tool === 'text') {
      const text = prompt('Enter text')
      if (text) {
        shapesRef.current.push({ ...base, type: 'text', text, x, y })
      }
    } else if (tool === 'eraser') {
      const idx = shapesRef.current.findIndex((sh) => {
        if (sh.type === 'text') return Math.abs(sh.x - x) < 20 && Math.abs(sh.y - y) < 20
        if (sh.type === 'rect') return x >= sh.x && x <= sh.x + sh.w && y >= sh.y && y <= sh.y + sh.h
        if (sh.type === 'arrow') return Math.hypot(sh.x1 - x, sh.y1 - y) < 10 || Math.hypot(sh.x2 - x, sh.y2 - y) < 10
        if (sh.type === 'pen') return sh.points.some((p) => Math.hypot(p.x - x, p.y - y) < 5)
        return false
      })
      if (idx >= 0) shapesRef.current.splice(idx, 1)
    }
  }

  const handlePointerMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (enableZoom && zoomSelRef.current) {
      // just preview, handled on up
      return
    }
    if (bubble.drag) {
      setBubble((b) => ({ ...b, x: x - b.offsetX, y: y - b.offsetY }))
      return
    }
    if (bubble.resize) {
      setBubble((b) => ({ ...b, size: Math.max(50, x - b.x, y - b.y) }))
      return
    }
    if (!enableAnnotate) return
    const cur = drawingRef.current
    if (!cur) return
    if (cur.type === 'pen') cur.points.push({ x, y })
    if (cur.type === 'rect') { cur.w = x - cur.x; cur.h = y - cur.y }
    if (cur.type === 'arrow') { cur.x2 = x; cur.y2 = y }
  }

  const handlePointerUp = (e) => {
    if (enableZoom && zoomSelRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x2 = e.clientX - rect.left
      const y2 = e.clientY - rect.top
      const sel = zoomSelRef.current
      const x = Math.min(sel.x, x2)
      const y = Math.min(sel.y, y2)
      const w = Math.abs(x2 - sel.x)
      const h = Math.abs(y2 - sel.y)
      const video = screenVideoRef.current
      const vx = (x / canvasRef.current.width) * video.videoWidth
      const vy = (y / canvasRef.current.height) * video.videoHeight
      const vw = (w / canvasRef.current.width) * video.videoWidth
      const vh = (h / canvasRef.current.height) * video.videoHeight
      setPan({ x: vx, y: vy })
      setZoom(canvasRef.current.width / w)
      zoomSelRef.current = null
      return
    }
    if (bubble.drag || bubble.resize) {
      setBubble((b) => ({ ...b, drag: false, resize: false }))
      return
    }
    drawingRef.current = null
  }

  const undo = () => {
    if (!shapesRef.current.length) return
    const sh = shapesRef.current.pop()
    undoneRef.current.push(sh)
  }
  const redo = () => {
    if (!undoneRef.current.length) return
    const sh = undoneRef.current.pop()
    shapesRef.current.push(sh)
  }
  const clear = () => {
    shapesRef.current = []
    undoneRef.current = []
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '+' || e.key === '=') setZoom((z) => z * 1.1)
      if (e.key === '-' || e.key === '_') setZoom((z) => z / 1.1)
      if (['ArrowLeft', 'a'].includes(e.key)) setPan((p) => ({ ...p, x: p.x - 20 }))
      if (['ArrowRight', 'd'].includes(e.key)) setPan((p) => ({ ...p, x: p.x + 20 }))
      if (['ArrowUp', 'w'].includes(e.key)) setPan((p) => ({ ...p, y: p.y - 20 }))
      if (['ArrowDown', 's'].includes(e.key)) setPan((p) => ({ ...p, y: p.y + 20 }))
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          className="bg-black text-white px-3 py-1 rounded-lg disabled:opacity-50"
          onClick={start}
          disabled={!isSecure || recording}
        >
          Start
        </button>
        <button
          className="bg-white border-2 border-black px-3 py-1 rounded-lg disabled:opacity-50"
          onClick={paused ? resume : pause}
          disabled={!recording}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          className="bg-white border-2 border-black px-3 py-1 rounded-lg disabled:opacity-50"
          onClick={stop}
          disabled={!recording}
        >
          Stop & Download
        </button>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={showCam} onChange={(e) => setShowCam(e.target.checked)} />
          Show Webcam
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={useMic} onChange={(e) => setUseMic(e.target.checked)} />
          Mic
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={enableAnnotate} onChange={(e) => setEnableAnnotate(e.target.checked)} />
          Annotate
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={enableZoom} onChange={(e) => setEnableZoom(e.target.checked)} />
          Zoom
        </label>
        {recording && (
          <div className="flex items-center gap-1 ml-4">
            <span className="record-dot" />
            <span className="text-sm">{formatTime(time)}</span>
          </div>
        )}
        <span className="ml-4 text-sm text-gray-600">{mimeType}</span>
      </div>
      {!isSecure && (
        <div className="text-sm text-red-600 mb-2">Use HTTPS or localhost to enable screen capture.</div>
      )}
      {notice && <div className="text-sm text-gray-600 mb-2">{notice}</div>}
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {enableAnnotate && (
        <div className="flex items-center gap-2 mb-2">
          <select className="border-2 border-black rounded-lg" value={tool} onChange={(e) => setTool(e.target.value)}>
            <option value="pen">Pen</option>
            <option value="arrow">Arrow</option>
            <option value="rect">Rectangle</option>
            <option value="text">Text</option>
            <option value="eraser">Eraser</option>
          </select>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="border-2 border-black rounded-lg w-10 h-10" />
          <input type="range" min="1" max="10" value={size} onChange={(e) => setSize(Number(e.target.value))} />
          <button className="bg-white border-2 border-black px-2 py-1 rounded-lg" onClick={undo}>Undo</button>
          <button className="bg-white border-2 border-black px-2 py-1 rounded-lg" onClick={redo}>Redo</button>
          <button className="bg-white border-2 border-black px-2 py-1 rounded-lg" onClick={clear}>Clear</button>
        </div>
      )}
      <div className="border-2 border-black rounded-lg overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          className="w-full h-auto annotation-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
      <video ref={screenVideoRef} className="hidden" />
      <video ref={camVideoRef} className="hidden" />
    </div>
  )
}
