import React, { useEffect, useRef, useState } from 'react'
import { IconArrowLeft, IconDownload, IconSettings, IconWand } from '@tabler/icons-react'
import { getApiKey } from '../lib/config.js'

// Minimal helpers (kept local to avoid external deps)
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const fetchWithRetry = async (url, options, retries = 3, backoff = 800) => {
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      if (res.status === 429 && retries > 0) {
        await new Promise(r => setTimeout(r, backoff))
        return fetchWithRetry(url, options, retries - 1, backoff * 2)
      }
      const data = await res.json().catch(() => ({}))
      throw new Error(`Request failed ${res.status}: ${data.error?.message || 'Unknown error'}`)
    }
    return res.json()
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoff))
      return fetchWithRetry(url, options, retries - 1, backoff * 2)
    }
    throw err
  }
}

const removeBackground = async ({ apiKey, dataUrl }) => {
  // Extract mime and base64 payload from data URL
  const [meta, payload] = (dataUrl || '').split(',')
  const mime = (/^data:(.*?);base64/.exec(meta || '') || [,'image/png'])[1]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`
  const instruction = [
    'Remove the background from this photo.',
    'Return a PNG with a transparent background (alpha channel).',
    'Preserve the subject edges, hair details, and semi-transparent regions.',
    'Do not crop or resize; keep the original composition and aspect ratio.',
    'No drop shadows or outlines unless they are part of the subject.',
  ].join(' ')

  const payloadBody = {
    contents: [
      {
        parts: [
          { text: instruction },
          { inlineData: { mimeType: mime, data: payload } },
        ],
      },
    ],
  }

  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadBody),
  })

  const b64 = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data
  if (!b64) throw new Error('No image data returned by API')
  return `data:image/png;base64,${b64}`
}

export default function RemoveBackground() {
  const [apiKey, setApiKey] = useState('')
  const [inputImage, setInputImage] = useState('')
  const [outputImage, setOutputImage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const fileRef = useRef(null)

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

  const handleFile = async (file) => {
    if (!file) return
    if (!/\.(png|jpg|jpeg)$/i.test(file.name)) {
      setStatus('Please select a PNG or JPEG image.')
      return
    }
    setStatus('')
    const b64 = await toBase64(file)
    setInputImage(b64)
    setOutputImage('')
  }

  const onDropZone = {
    onDragOver: (e) => { e.preventDefault() },
    onDrop: (e) => {
      e.preventDefault()
      const f = e.dataTransfer?.files?.[0]
      if (f) handleFile(f)
    },
    onClick: () => fileRef.current?.click(),
  }

  const handleProcess = async () => {
    if (!inputImage) {
      setStatus('Please upload an image first.')
      return
    }
    if (!apiKey) {
      setStatus('API key not set. Open Settings to add your Gemini key.')
      return
    }
    setIsLoading(true)
    setStatus('Removing background…')
    try {
      const outUrl = await removeBackground({ apiKey, dataUrl: inputImage })
      setOutputImage(outUrl)
      setStatus('')
    } catch (err) {
      setStatus('Background removal failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadImage = async (href, name) => {
    try {
      const resp = await fetch(href)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()
    } catch {
      setStatus('Download failed.')
    }
  }

  const checkerboard = {
    backgroundImage: `
      linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
      linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
      linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
    `,
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
          >
            <IconArrowLeft size={18} stroke={2} />
            Back to tools
          </a>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
          >
            <IconSettings size={16} stroke={2} />
            Edit Config
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
            <h2 className="font-semibold mb-3">1. Upload Image</h2>
            <div
              className="w-full aspect-square border-2 border-dashed border-black rounded-xl flex items-center justify-center cursor-pointer hover:bg-gray-100"
              {...onDropZone}
            >
              {inputImage ? (
                <img src={inputImage} alt="input preview" className="w-full h-full object-contain rounded-xl p-2" />
              ) : (
                <div className="text-center text-gray-600">
                  <p className="font-medium">Click or drop to upload</p>
                  <p className="text-sm">PNG or JPG</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black rounded-lg px-4 py-2 text-sm"
              >
                Choose File
              </button>
              <button
                onClick={handleProcess}
                disabled={!inputImage || isLoading}
                className="inline-flex items-center gap-2 bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black rounded-lg px-4 py-2 text-sm disabled:opacity-60"
              >
                <IconWand size={18} />
                {isLoading ? 'Processing…' : 'Remove Background'}
              </button>
            </div>
            {status && (
              <div className="mt-3 text-sm text-gray-700">{status}</div>
            )}
          </div>

          <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
            <h2 className="font-semibold mb-3">2. Result</h2>
            <div className="w-full aspect-square rounded-xl overflow-hidden" style={checkerboard}>
              {outputImage ? (
                <img src={outputImage} alt="output" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">No result yet</div>
              )}
            </div>
            {outputImage && (
              <div className="mt-3">
                <button
                  onClick={() => downloadImage(outputImage, 'removed-background.png')}
                  className="inline-flex items-center gap-2 bg-white text-black border-2 border-black hover:bg-gray-100 rounded-lg px-4 py-2 text-sm"
                >
                  <IconDownload size={16} /> Download PNG
                </button>
              </div>
            )}
          </div>
        </div>

        {outputImage && (
          <p className="text-center text-xs text-gray-600 mt-6">Made with Gemini</p>
        )}
      </div>
    </div>
  )
}
