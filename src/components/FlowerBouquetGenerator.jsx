import React, { useEffect, useMemo, useState } from 'react'
import { IconArrowLeft, IconDownload, IconSettings, IconWand } from '@tabler/icons-react'
import { getGeminiApiKey, getOpenAIApiKey } from '../lib/config.js'

const STORAGE_KEY = 'flowerBouquetForm'

const qtyOptions = ['1-2','2-3','3-5','4-6','5-7','6-10']
const flowerOptions = ['Rose','Gerbera','Spray rose','Lisianthus','Peony','Tulip','Hydrangea','Carnation','Chrysanthemum']
const occasionOptions = ['Neutral gift','Birthday','Anniversary','Wedding','Sympathy','Congratulations']
const arrangementOptions = ['Vase','Hand-tied']
const shapeOptions = ['Rounded','Asymmetric','Cascading']
const fillerOptions = ['Statice/Limonium (lilac)','Stock (white)','Baby\u2019s breath','Eucalyptus','None']
const vesselTypes = ['Clear glass cylinder','Glass bowl','Wrapped hand-tied']
const ribbonColors = ['Light pink','Ivory','White','None']
const backgroundOptions = ['White fabric backdrop','Plain light gray','Wood tabletop','Dark moody']
const ratioOptions = ['4:5','3:4','1:1']
const sizeOptions = ['1024x1280','1536x2048','2048x2560']
const avoidOptions = ['Random text on ribbon','Harsh shadows','Overly dense foliage','Deformed petals','Extra flower centers','Murky water']
const colorSuggestions = ['Pastel pink','White','Lilac','Soft peach','Cream']

const defaultForm = {
  occasion: 'Neutral gift',
  arrangement: 'Vase',
  shape: 'Rounded',
  size: { height: 55, width: 40 },
  mainColors: 'Pastel pink, White, Lilac',
  flowers: [
    { name: 'Rose', color: 'soft pink', qty: '5-7' },
    { name: 'Gerbera', color: 'light pink', qty: '2-3' },
    { name: 'Spray rose', color: 'white', qty: '6-10' },
    { name: 'Lisianthus', color: 'pink & white', qty: '4-6' },
  ],
  fillers: [],
  vessel: { type: 'Clear glass cylinder', ribbonColor: 'Light pink', ribbonText: '' },
  background: 'White fabric backdrop',
  output: { ratio: '4:5', size: '1024x1280' },
  avoid: ['Random text on ribbon','Harsh shadows','Overly dense foliage','Deformed petals'],
}

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

const generateGeminiImage = async ({ apiKey, prompt }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`
  const payload = {
    contents: [
      { parts: [{ text: prompt }] },
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

const generateOpenAIImage = async ({ apiKey, prompt, size }) => {
  const payload = { model: 'gpt-image-1', prompt, size, response_format: 'b64_json' }
  const data = await fetchWithRetry('https://api.openai.com/v1/images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned by API')
  return `data:image/png;base64,${b64}`
}

export default function FlowerBouquetGenerator() {
  const [geminiKey, setGeminiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : defaultForm
  })
  const [image, setImage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const load = () => {
      setGeminiKey(getGeminiApiKey())
      setOpenaiKey(getOpenAIApiKey())
    }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  }, [form])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const updateNested = (key, field, value) => {
    setForm(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const handleSize = (dim, value) => {
    let v = parseInt(value, 10)
    if (isNaN(v)) v = 10
    if (v < 10) v = 10
    if (v > 120) v = 120
    updateNested('size', dim, v)
  }

  const addFlower = () => {
    setForm(prev => ({ ...prev, flowers: [...prev.flowers, { name: 'Rose', color: '', qty: '1-2' }] }))
  }

  const updateFlower = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      flowers: prev.flowers.map((f, i) => i === idx ? { ...f, [field]: value } : f),
    }))
  }

  const removeFlower = (idx) => {
    setForm(prev => ({ ...prev, flowers: prev.flowers.filter((_, i) => i !== idx) }))
  }

  const toggleArray = (arrField, value, single = false) => {
    setForm(prev => {
      let arr = prev[arrField]
      if (single) {
        arr = value === 'None' ? ['None'] : arr.includes('None') ? [value] : arr
      }
      if (arr.includes(value)) arr = arr.filter(v => v !== value)
      else arr = single && value === 'None' ? ['None'] : [...arr.filter(v => v !== 'None'), value]
      return { ...prev, [arrField]: arr }
    })
  }

  const vesselToggle = (field, value) => {
    setForm(prev => ({
      ...prev,
      vessel: { ...prev.vessel, [field]: value },
    }))
  }

  const prompt = useMemo(() => {
    const ribbon = form.vessel.ribbonColor === 'None'
      ? 'none'
      : `${form.vessel.ribbonColor}${form.vessel.ribbonText ? ' ' + form.vessel.ribbonText : ''}`
    const flowers = form.flowers.map(f => `${f.name} in ${f.color} (~${f.qty})`).join(', ')
    const fillers = form.fillers.includes('None') || form.fillers.length === 0 ? 'minimal' : form.fillers.join(', ')
    const main = `${form.occasion} flower bouquet, ${form.arrangement} in ${form.vessel.type} (ribbon ${ribbon}), shape ${form.shape}, size about ${form.size.height}cm tall × ${form.size.width}cm wide, color palette ${form.mainColors}. Include: ${flowers}. Fillers: ${fillers}. Greenery: airy, delicate, sparse. Realistic details: visible waterline in vase, natural slight petal imperfections, soft depth of field. Background: ${form.background}. Lighting: soft diffuse from left, gentle shadows. Photography: 85mm, aperture f/3.2, slight top-down 12°, studio composition center. Aspect ratio ${form.output.ratio}, resolution ${form.output.size}.`
    const negative = `Avoid: ${form.avoid.join(', ')}.`
    return `${main} ${negative}`
  }, [form])

  const handleGenerate = async () => {
    const key = provider === 'gemini' ? geminiKey : openaiKey
    if (!key) {
      setStatus(`API key not set. Open Settings to add your ${provider === 'gemini' ? 'Gemini' : 'OpenAI'} key.`)
      return
    }
    setIsLoading(true)
    setStatus('Generating…')
    try {
      const img = provider === 'gemini'
        ? await generateGeminiImage({ apiKey: key, prompt })
        : await generateOpenAIImage({ apiKey: key, prompt, size: form.output.size })
      setImage(img)
      setStatus('')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadImage = (url, name) => {
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = name
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(blobUrl)
        a.remove()
      })
      .catch(() => setStatus('Download failed.'))
  }

  const addColor = (c) => {
    if (form.mainColors.toLowerCase().includes(c.toLowerCase())) return
    updateField('mainColors', form.mainColors ? form.mainColors + ', ' + c : c)
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
          <div className="bg-white border-2 border-black rounded-xl shadow-md p-4 overflow-y-auto max-h-[80vh]">
            <h2 className="font-semibold mb-3">1. Bouquet Details</h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block mb-1 font-medium">Occasion</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={form.occasion} onChange={e => updateField('occasion', e.target.value)}>
                  {occasionOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium">Arrangement</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={form.arrangement} onChange={e => updateField('arrangement', e.target.value)}>
                  {arrangementOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium">Shape</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={form.shape} onChange={e => updateField('shape', e.target.value)}>
                  {shapeOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-1 font-medium">Height (cm)</label>
                  <input type="number" min="10" max="120" value={form.size.height} onChange={e => handleSize('height', e.target.value)} className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" />
                </div>
                <div className="flex-1">
                  <label className="block mb-1 font-medium">Width (cm)</label>
                  <input type="number" min="10" max="120" value={form.size.width} onChange={e => handleSize('width', e.target.value)} className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" />
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">Main colors</label>
                <input type="text" value={form.mainColors} onChange={e => updateField('mainColors', e.target.value)} className="w-full bg-white border-2 border-black rounded-lg px-2 py-1 mb-2" />
                <div className="flex flex-wrap gap-2">
                  {colorSuggestions.map(c => (
                    <button key={c} type="button" onClick={() => addColor(c)} className="bg-white border-2 border-black rounded-full px-2 py-1 text-xs">{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">Flowers</label>
                {form.flowers.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <select className="bg-white border-2 border-black rounded-lg px-2 py-1 flex-1" value={f.name} onChange={e => updateFlower(idx, 'name', e.target.value)}>
                      {flowerOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                    <input type="text" placeholder="soft pink / ivory / lilac" className="bg-white border-2 border-black rounded-lg px-2 py-1 flex-1" value={f.color} onChange={e => updateFlower(idx, 'color', e.target.value)} />
                    <select className="bg-white border-2 border-black rounded-lg px-2 py-1 w-24" value={f.qty} onChange={e => updateFlower(idx, 'qty', e.target.value)}>
                      {qtyOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                    <button type="button" onClick={() => removeFlower(idx)} className="bg-white border-2 border-black rounded-lg px-2 py-1 text-xs">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={addFlower} className="bg-white border-2 border-black rounded-lg px-3 py-1 text-sm">Add row</button>
              </div>
              <div>
                <label className="block mb-1 font-medium">Fillers</label>
                <div className="flex flex-col gap-1">
                  {fillerOptions.map(o => (
                    <label key={o} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={form.fillers.includes(o)} onChange={() => toggleArray('fillers', o, true)} />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">Vessel</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1 mb-2" value={form.vessel.type} onChange={e => vesselToggle('type', e.target.value)}>
                  {vesselTypes.map(o => <option key={o}>{o}</option>)}
                </select>
                <div className="flex gap-2 mb-2">
                  <select className="bg-white border-2 border-black rounded-lg px-2 py-1 flex-1" value={form.vessel.ribbonColor} onChange={e => vesselToggle('ribbonColor', e.target.value)}>
                    {ribbonColors.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <input type="text" placeholder="ribbon text" className="bg-white border-2 border-black rounded-lg px-2 py-1 flex-1" value={form.vessel.ribbonText} onChange={e => vesselToggle('ribbonText', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">Background</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={form.background} onChange={e => updateField('background', e.target.value)}>
                  {backgroundOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-1 font-medium">Aspect ratio</label>
                  <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={form.output.ratio} onChange={e => updateNested('output','ratio', e.target.value)}>
                    {ratioOptions.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block mb-1 font-medium">Resolution</label>
                  <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={form.output.size} onChange={e => updateNested('output','size', e.target.value)}>
                    {sizeOptions.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium">Avoid</label>
                <div className="flex flex-col gap-1">
                  {avoidOptions.map(o => (
                    <label key={o} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={form.avoid.includes(o)} onChange={() => toggleArray('avoid', o)} />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
            <h2 className="font-semibold mb-3">2. Preview & Generate</h2>
            <select value={provider} onChange={e => setProvider(e.target.value)} className="bg-white border-2 border-black rounded-lg px-2 py-1 mb-3">
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <textarea readOnly value={prompt} className="w-full h-48 bg-white border-2 border-black rounded-lg p-2 text-sm mb-3" />
            <button onClick={handleGenerate} disabled={isLoading} className="inline-flex items-center gap-2 bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black rounded-lg px-4 py-2">
              <IconWand size={18} />
              {isLoading ? 'Generating…' : 'Generate'}
            </button>
            {status && (
              <div className="mt-3 text-sm text-gray-700">{status}</div>
            )}
            {image && (
              <div className="mt-4">
                <div className="w-full aspect-[4/5] bg-gray-100 border-2 border-black rounded-lg overflow-hidden mb-2">
                  <img src={image} alt="bouquet" className="w-full h-full object-cover" />
                </div>
                <button onClick={() => downloadImage(image, 'bouquet.png')} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black hover:bg-gray-100 rounded-lg px-4 py-2 text-sm">
                  <IconDownload size={16} /> Download PNG
                </button>
              </div>
            )}
          </div>
        </div>
        {image && (
          <p className="text-center text-xs text-gray-600 mt-6">Made with {provider === 'gemini' ? 'Gemini' : 'OpenAI'}</p>
        )}
      </div>
    </div>
  )
}

