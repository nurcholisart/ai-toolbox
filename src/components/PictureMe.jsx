import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconArrowLeft, IconDownload, IconSettings, IconWand } from '@tabler/icons-react'
import { getApiKey } from '../lib/config.js'
import Disclosure from './Disclosure.jsx'

// Minimal helpers (no external deps)
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const cropImage = (imageUrl, aspectRatio) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = imageUrl
  img.onload = () => {
    const [tw, th] = aspectRatio.split(':').map(Number)
    const target = tw / th
    const ow = img.width
    const oh = img.height
    const oar = ow / oh

    let sx = 0, sy = 0, sw = ow, sh = oh
    if (oar > target) {
      sh = oh
      sw = oh * target
      sx = (ow - sw) / 2
    } else {
      sw = ow
      sh = ow / target
      sy = (oh - sh) / 2
    }

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    resolve(canvas.toDataURL('image/png'))
  }
  img.onerror = reject
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

const generateImage = async ({ apiKey, prompt, base64Image }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: base64Image } },
        ],
      },
    ],
  }

  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const b64 = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data
  if (!b64) throw new Error('No image data returned by API')
  return `data:image/png;base64,${b64}`
}

const templates = {
  decades: {
    name: 'Time Traveler',
    prompts: [
      { id: '1950s', base: 'A 1950s style portrait.' },
      { id: '1960s', base: 'A 1960s style portrait.' },
      { id: '1970s', base: 'A 1970s style portrait.' },
      { id: '1980s', base: 'An 1980s style portrait.' },
      { id: '1990s', base: 'A 1990s style portrait.' },
      { id: '2000s', base: 'A 2000s style portrait.' },
    ],
  },
  headshots: {
    name: 'Pro Headshots',
    prompts: [
      { id: 'Business Suit', base: 'wearing a dark business suit with a crisp white shirt' },
      { id: 'Smart Casual', base: 'wearing a smart-casual knit sweater over a collared shirt' },
      { id: 'Creative Pro', base: 'wearing a dark turtleneck' },
    ],
  },
  eightiesMall: {
    name: "'80s Mall Shoot",
    prompts: [
      { id: 'Smiling', base: 'a friendly, smiling pose' },
      { id: 'Serious', base: 'a serious, dramatic pose' },
      { id: 'Over the Shoulder', base: 'looking back over their shoulder' },
    ],
  },
}

const instructionFor = (template, p) => {
  switch (template) {
    case 'decades':
      return `Maintain the exact facial features, likeness, perceived gender, framing, and composition of the person in the provided photo. Change hair, clothing, accessories, and background to match the style of the ${p.id}. Do not alter core facial structure.`
    case 'headshots':
      return `Maintain the exact facial features and likeness. Transform the image into a professional headshot: ${p.base}. Background should be clean, neutral, out-of-focus. Do not alter core facial structure.`
    case 'eightiesMall':
      return `Maintain the exact facial features and likeness. Transform the image into a single 1980s mall studio photo. For this specific photo, the person should be in ${p.base}. Hair, clothing, background, and lighting should match the 80s style. Do not alter core facial structure.`
    default:
      return p.base
  }
}

export default function PictureMe() {
  const [apiKey, setApiKey] = useState('')
  const [uploadedImage, setUploadedImage] = useState('')
  const [template, setTemplate] = useState('decades')
  const [isLoading, setIsLoading] = useState(false)
  const [images, setImages] = useState([])
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

  const tmpl = useMemo(() => templates[template], [template])

  const handleFile = async (file) => {
    if (!file) return
    if (!/\.(png|jpg|jpeg)$/i.test(file.name)) {
      setStatus('Please select a PNG or JPEG image.')
      return
    }
    setStatus('')
    const b64 = await toBase64(file)
    setUploadedImage(b64)
    setImages([])
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

  const handleGenerate = async () => {
    if (!uploadedImage) {
      setStatus('Please upload a photo first.')
      return
    }
    if (!apiKey) {
      setStatus('API key not set. Open Settings to add your Gemini key.')
      return
    }
    setStatus('Generating…')
    setIsLoading(true)
    setImages(tmpl.prompts.map(p => ({ id: p.id, status: 'pending', url: '' })))
    try {
      const base64Payload = uploadedImage.split(',')[1]
      for (let i = 0; i < tmpl.prompts.length; i++) {
        const p = tmpl.prompts[i]
        try {
          const url = await generateImage({
            apiKey,
            prompt: instructionFor(template, p),
            base64Image: base64Payload,
          })
          setImages(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'success', url } : it))
        } catch (err) {
          setImages(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'failed' } : it))
        }
      }
      setStatus('')
    } catch (err) {
      setStatus('Generation failed. Please try again.')
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

  const handleDownload = async (imgUrl, id, ratio) => {
    const framed = await cropImage(imgUrl, ratio)
    const filename = `gemini-canvas-${id.toLowerCase().replace(/\s+/g, '-')}-${ratio.replace(':', 'x')}.png`
    await downloadImage(framed, filename)
  }

  const availableRatios = ['1:1', '9:16']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between">
          <a
            href="#"
            className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
          >
            <IconArrowLeft size={18} stroke={2} />
            Back to tools
          </a>
          <a
            href="#/settings"
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
            <h2 className="font-semibold mb-3">1. Your Photo</h2>
            <div
              className="w-full aspect-square border-2 border-dashed border-black rounded-xl flex items-center justify-center cursor-pointer hover:bg-gray-100"
              {...onDropZone}
            >
              {uploadedImage ? (
                <img src={uploadedImage} alt="preview" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="text-center text-gray-600">
                  <p className="font-medium">Click or drop to upload</p>
                  <p className="text-sm">PNG or JPG</p>
                </div>
              )}
            </div>
            <div className="mt-3">
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
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
            <h2 className="font-semibold mb-3">2. Choose a Theme</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(templates).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setTemplate(key)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-sm ${template === key ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:bg-gray-100'}`}
                >
                  {val.name}
                </button>
              ))}
            </div>

            <div className="bg-gray-50 border-2 border-black rounded-lg p-3">
              <p className="text-sm font-medium">This theme will generate multiple variations:</p>
              <ul className="list-disc ml-5 mt-2 text-sm text-gray-700">
                {tmpl.prompts.map(p => (
                  <li key={p.id}>{p.id}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black rounded-lg px-4 py-2"
              >
                <IconWand size={18} />
                {isLoading ? 'Generating…' : 'Generate Photos'}
              </button>
            </div>

            {status && (
              <div className="mt-3 text-sm text-gray-700">{status}</div>
            )}
          </div>
        </div>

        {(isLoading || images.length > 0) && (
          <div className="mt-8">
            <h3 className="font-semibold mb-3">Your Generated Photos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {images.map((img, idx) => (
                <div key={`${img.id}-${idx}`} className="bg-white border-2 border-black rounded-xl shadow-md p-3">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {img.status === 'pending' && (
                      <div className="text-gray-500 text-sm">Generating…</div>
                    )}
                    {img.status === 'failed' && (
                      <div className="text-gray-500 text-sm">Failed</div>
                    )}
                    {img.status === 'success' && (
                      <img src={img.url} alt={img.id} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm font-medium">{img.id}</p>
                    {img.status === 'success' && (
                      <div className="flex items-center gap-2">
                        {availableRatios.map(ratio => (
                          <button
                            key={ratio}
                            onClick={() => handleDownload(img.url, img.id, ratio)}
                            className="inline-flex items-center gap-1 bg-white text-black border-2 border-black hover:bg-gray-100 rounded-lg px-2 py-1 text-xs"
                            title={`Download ${ratio}`}
                          >
                            <IconDownload size={14} /> {ratio}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!isLoading && images.length > 0 && (
              <p className="text-center text-xs text-gray-600 mt-6">Made with Gemini</p>
            )}
          </div>
        )}
        <Disclosure />
      </div>
    </div>
  )
}
