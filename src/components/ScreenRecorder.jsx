import React, { useEffect, useRef, useState } from 'react'

export default function ScreenRecorder() {
  const [isSupported, setIsSupported] = useState(false)
  const [warning, setWarning] = useState('')
  const [useWebcam, setUseWebcam] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    const supported = !!navigator.mediaDevices?.getDisplayMedia
    setIsSupported(supported)
    if (!supported) setWarning("Screen recording isn't supported on this device.")
  }, [])

  const startRecording = async () => {
    if (!isSupported || recording) return
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      if (useWebcam && navigator.mediaDevices?.getUserMedia) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          camStream.getVideoTracks().forEach(t => displayStream.addTrack(t))
        } catch (err) {
          // ignore webcam errors
        }
      }
      const recorder = new MediaRecorder(displayStream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data?.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'recording.webm'
        a.click()
        URL.revokeObjectURL(url)
      }
      recorder.start()
      setRecording(true)
    } catch (err) {
      setWarning('Could not start screen recording.')
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    recorder.stop()
    recorder.stream.getTracks().forEach(t => t.stop())
    setRecording(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold mb-4">Screen Recorder</h1>
        {warning && <p className="mb-4 text-sm text-gray-600">{warning}</p>}
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            className="rounded border-2 border-black"
            checked={useWebcam}
            onChange={e => setUseWebcam(e.target.checked)}
            disabled={!navigator.mediaDevices?.getUserMedia}
          />
          Include webcam
        </label>
        <div className="flex gap-2">
          <button
            onClick={startRecording}
            disabled={!isSupported || recording}
            className="bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black rounded-lg px-4 py-2 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Start
          </button>
          {recording && (
            <button
              onClick={stopRecording}
              className="bg-white border-2 border-black text-black hover:bg-gray-100 rounded-lg px-4 py-2"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
