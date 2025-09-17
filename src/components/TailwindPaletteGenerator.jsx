import React, { useEffect, useMemo, useState } from 'react'
import { IconArrowLeft, IconClipboard, IconRefresh, IconShare, IconWorld, IconPhoto, IconPlus, IconMinus } from '@tabler/icons-react'
import { familiesFromParams, generateRamp, makeTailwindConfigJSON, makeCssVars, makeTailwindV4Theme, safePairingsSummary, wcagBadgesForFamily } from '../lib/palette.js'
import { parseColorToOklch, stepsDefault, oklchToHex, formatOklch } from '../lib/colors.js'
import { readParams, writeParams, debounce } from '../lib/url.js'
import { extractImageColors, fetchSiteColors } from '../lib/extract.js'
import { extractBrandColorsWithGemini } from '../lib/geminiBrand.js'
import { getApiKey } from '../lib/config.js'

const defaultState = () => ({
  families: ['primary','accent','neutral','info'],
  bases: {
    primary: '#6750A4',
    accent: '#03DAC6',
    neutral: '#6B7280',
    info: '#3B82F6',
  },
  site: '',
  img: '',
  company: '',
  mode: 'light',
  algo: 'oklch',
  chroma: 0.12,
  steps: stepsDefault,
  contrastTarget: 'AA',
  vibe: '',
  export: 'both',
  useGrounding: true,
})

const copy = async (text) => {
  try { await navigator.clipboard.writeText(text) } catch {}
}

const ShareUrl = ({ className = '' }) => {
  const onShare = async () => copy(window.location.href)
  return (
    <button onClick={onShare} className={`inline-flex items-center gap-2 bg-black text-white rounded-lg px-3 py-1 hover:bg-gray-800 focus:ring-2 focus:ring-black ${className}`}>
      <IconShare size={16} /> Share URL
    </button>
  )
}

export default function TailwindPaletteGenerator() {
  const [state, setState] = useState(defaultState())
  const [warnings, setWarnings] = useState([])
  const [aiStatus, setAiStatus] = useState('')

  // Load from URL
  useEffect(() => {
    try {
      const p = readParams()
      const fams = familiesFromParams(p)
      const bases = { ...defaultState().bases }
      for (const f of fams) {
        const v = p.get(f)
        if (v) bases[f] = v
      }
      const site = p.get('site') || ''
      const img = p.get('img') || ''
      const company = p.get('company') || ''
      const mode = p.get('mode') || 'light'
      const algo = p.get('algo') || 'oklch'
      const chroma = p.get('chroma') ? Number(p.get('chroma')) : defaultState().chroma
      const contrastTarget = p.get('contrastTarget') || 'AA'
      const vibe = p.get('vibe') || ''
      const exp = p.get('export') || 'both'
      const useGrounding = p.get('ground') ? p.get('ground') !== '0' : true
      setState((s) => ({ ...s, families: fams, bases, site, img, company, mode, algo, chroma, contrastTarget, vibe, export: exp, useGrounding }))
    } catch {}
  }, [])

  // Sync URL on changes (debounced)
  const syncUrl = useMemo(() => debounce((s) => {
    const p = new URLSearchParams()
    if (s.families?.length) p.set('families', s.families.join(','))
    for (const f of s.families) if (s.bases[f]) p.set(f, s.bases[f])
    if (s.site) p.set('site', s.site)
    if (s.img) p.set('img', s.img)
    if (s.company) p.set('company', s.company)
    if (s.mode && s.mode !== 'light') p.set('mode', s.mode)
    if (s.algo && s.algo !== 'oklch') p.set('algo', s.algo)
    if (s.chroma != null && s.chroma !== 0.12) p.set('chroma', String(s.chroma))
    if (s.contrastTarget && s.contrastTarget !== 'AA') p.set('contrastTarget', s.contrastTarget)
    if (s.vibe) p.set('vibe', s.vibe)
    if (s.export && s.export !== 'both') p.set('export', s.export)
    if (!s.useGrounding) p.set('ground', '0')
    writeParams(p)
  }, 400), [])

  useEffect(() => { syncUrl(state) }, [state, syncUrl])

  // Apply data-theme for preview
  useEffect(() => {
    if (state.mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    return () => document.documentElement.removeAttribute('data-theme')
  }, [state.mode])

  const ramps = useMemo(() => {
    const res = {}
    for (const f of state.families) {
      const ramp = generateRamp(state.bases[f] || '#777777', { algo: state.algo, chroma: state.chroma, steps: state.steps })
      if (ramp) res[f] = ramp
    }
    return res
  }, [state])

  const onAddFamily = () => {
    const remain = ['primary','secondary','accent','neutral','info','success','warning','error'].filter((f) => !state.families.includes(f))
    if (!remain.length) return
    const f = remain[0]
    setState((s) => ({ ...s, families: [...s.families, f], bases: { ...s.bases, [f]: '#777777' } }))
  }
  const onRemoveFamily = (f) => {
    setState((s) => ({ ...s, families: s.families.filter((x) => x !== f) }))
  }

  const onProbeSite = async () => {
    setWarnings([])
    if (!state.site) return
    if (getApiKey()) {
      setAiStatus('Asking Gemini…')
      const { colors, notes, warnings: ww } = await extractBrandColorsWithGemini({ site: state.site, company: state.company, max: state.families.length, useGrounding: state.useGrounding, vibe: state.vibe })
      setAiStatus('')
      if (ww?.length) setWarnings((w) => [...w, ...ww])
      if (notes) setWarnings((w) => [...w, `AI notes: ${notes}`])
      if (colors?.length) {
        setState((s) => {
          const bases = { ...s.bases }
          let i = 0
          for (const f of s.families) {
            if (colors[i]) bases[f] = colors[i]
            i++
          }
          return { ...s, bases }
        })
      }
      return
    }
    const { colors, warnings } = await fetchSiteColors(state.site)
    if (warnings?.length) setWarnings((w) => [...w, ...warnings])
    if (colors?.length) {
      // Apply first colors to families in order
      setState((s) => {
        const bases = { ...s.bases }
        let i = 0
        for (const f of s.families) {
          if (colors[i]) bases[f] = colors[i]
          i++
        }
        return { ...s, bases }
      })
    }
  }

  const onProbeImg = async () => {
    setWarnings([])
    if (!state.img) return
    if (getApiKey()) {
      setAiStatus('Asking Gemini…')
      const { colors, notes, warnings: ww } = await extractBrandColorsWithGemini({ imageUrl: state.img, company: state.company, max: state.families.length, useGrounding: state.useGrounding, vibe: state.vibe })
      setAiStatus('')
      if (ww?.length) setWarnings((w) => [...w, ...ww])
      if (notes) setWarnings((w) => [...w, `AI notes: ${notes}`])
      if (colors?.length) {
        setState((s) => {
          const bases = { ...s.bases }
          let i = 0
          for (const f of s.families) {
            if (colors[i]) bases[f] = colors[i]
            i++
          }
          return { ...s, bases }
        })
      }
      return
    }
    const { colors, warnings } = await extractImageColors(state.img)
    if (warnings?.length) setWarnings((w) => [...w, ...warnings])
    if (colors?.length) {
      setState((s) => {
        const bases = { ...s.bases }
        let i = 0
        for (const f of s.families) {
          if (colors[i]) bases[f] = colors[i]
          i++
        }
        return { ...s, bases }
      })
    }
  }

  const onAiSuggest = async () => {
    setWarnings([])
    if (!getApiKey()) {
      setWarnings((w) => [...w, 'Gemini API key not set. Open Settings to add your key.'])
      return
    }
    setAiStatus('Asking Gemini…')
    const { colors, notes, warnings: ww } = await extractBrandColorsWithGemini({ site: state.site, company: state.company, imageUrl: state.img, max: state.families.length, useGrounding: state.useGrounding, vibe: state.vibe })
    setAiStatus('')
    if (ww?.length) setWarnings((w) => [...w, ...ww])
    if (notes) setWarnings((w) => [...w, `AI notes: ${notes}`])
    if (colors?.length) {
      setState((s) => {
        const bases = { ...s.bases }
        let i = 0
        for (const f of s.families) {
          if (colors[i]) bases[f] = colors[i]
          i++
        }
        return { ...s, bases }
      })
    } else {
      setWarnings((w) => [...w, 'No colors suggested by AI.'])
    }
  }

  const twJson = useMemo(() => makeTailwindConfigJSON(ramps), [ramps])
  const cssVars = useMemo(() => makeCssVars(ramps, state.mode), [ramps, state.mode])
  const twV4 = useMemo(() => makeTailwindV4Theme(ramps), [ramps])

  // Choose families for preview usage with sensible fallbacks
  const previewFamilies = useMemo(() => {
    const fams = state.families || []
    const primary = fams.includes('primary') ? 'primary' : (fams[0] || 'primary')
    const neutral = fams.includes('neutral') ? 'neutral' : (fams.includes('primary') ? 'primary' : (fams[0] || 'primary'))
    const accent = fams.includes('accent') ? 'accent' : (fams.find((f) => f !== primary) || primary)
    const info = fams.includes('info') ? 'info' : (fams.find((f) => f !== primary && f !== accent) || primary)
    return { primary, neutral, accent, info }
  }, [state.families])

  // Steps for light/dark preview
  const previewSteps = useMemo(() => {
    const isDark = state.mode === 'dark'
    return {
      bg: isDark ? 900 : 50,
      fg: isDark ? 50 : 900,
      border: isDark ? 700 : 200,
      primaryBg: 600,
      primaryBgHover: 700,
      accentText: 700,
      infoBg: isDark ? 900 : 100,
      infoFg: isDark ? 100 : 800,
    }
  }, [state.mode])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <a href="/" className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm">
            <IconArrowLeft size={18} stroke={2} /> Back to tools
          </a>
          <div className="flex items-center gap-2">
            <ShareUrl />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border-2 border-black rounded-xl shadow-md p-4 md:col-span-1">
            <h2 className="font-semibold mb-2">Controls</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Families</span>
                <button onClick={onAddFamily} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconPlus size={14}/>Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.families.map((f) => (
                  <span key={f} className="inline-flex items-center gap-2 border-2 border-black rounded-lg px-2 py-1 bg-white text-sm">
                    {f}
                    <button onClick={() => onRemoveFamily(f)} className="text-gray-600 hover:text-black"><IconMinus size={14}/></button>
                  </span>
                ))}
              </div>

              {state.families.map((f) => (
                <div key={f} className="space-y-1">
                  <label className="text-sm">{f} base color</label>
                  <input
                    className="w-full bg-white border-2 border-black rounded-lg px-2 py-1"
                    placeholder="#6750A4 | hsl(250 50% 50%) | oklch(0.65 0.18 280)"
                    value={state.bases[f] || ''}
                    onChange={(e) => setState((s) => ({ ...s, bases: { ...s.bases, [f]: e.target.value } }))}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">Mode</label>
                  <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={state.mode} onChange={(e) => setState((s) => ({ ...s, mode: e.target.value }))}>
                    <option value="light">light</option>
                    <option value="dark">dark</option>
                    <option value="system">system</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm">Algo</label>
                  <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={state.algo} onChange={(e) => setState((s) => ({ ...s, algo: e.target.value }))}>
                    <option value="oklch">oklch</option>
                    <option value="lch">lch</option>
                    <option value="lab">lab</option>
                    <option value="hsl">hsl</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm">Chroma (0–0.4)</label>
                <input type="number" step="0.01" min="0" max="0.4" className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={state.chroma}
                  onChange={(e) => setState((s) => ({ ...s, chroma: Math.max(0, Math.min(0.4, Number(e.target.value))) }))} />
              </div>

              <div>
                <label className="text-sm">Contrast target</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={state.contrastTarget} onChange={(e) => setState((s) => ({ ...s, contrastTarget: e.target.value }))}>
                  <option>AA</option>
                  <option>AAA</option>
                </select>
              </div>

              <div>
                <label className="text-sm">Export panels</label>
                <select className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={state.export} onChange={(e) => setState((s) => ({ ...s, export: e.target.value }))}>
                  <option value="both">json + css</option>
                  <option value="json">json</option>
                  <option value="css">css</option>
                  <option value="v4">tailwind v4</option>
                  <option value="all">all</option>
                </select>
              </div>

              <div>
                <label className="text-sm">Vibe (hint)</label>
                <input className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" value={state.vibe} onChange={(e) => setState((s) => ({ ...s, vibe: e.target.value }))} placeholder="corporate, playful, minimal, neon" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="text-sm">Company/Brand name</label>
                  <input className="w-full bg-white border-2 border-black rounded-lg px-2 py-1" placeholder="e.g., Stripe, NASA" value={state.company} onChange={(e) => setState((s) => ({ ...s, company: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm">Website URL</label>
                  <div className="flex gap-2">
                    <input className="flex-1 bg-white border-2 border-black rounded-lg px-2 py-1" placeholder="https://example.com" value={state.site} onChange={(e) => setState((s) => ({ ...s, site: e.target.value }))} />
                    <button onClick={onProbeSite} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconWorld size={16}/>Probe</button>
                  </div>
                </div>
                <div>
                  <label className="text-sm">Image URL</label>
                  <div className="flex gap-2">
                    <input className="flex-1 bg-white border-2 border-black rounded-lg px-2 py-1" placeholder="https://example.com/logo.png" value={state.img} onChange={(e) => setState((s) => ({ ...s, img: e.target.value }))} />
                    <button onClick={onProbeImg} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconPhoto size={16}/>Extract</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <input id="grounding" type="checkbox" checked={state.useGrounding} onChange={(e) => setState((s) => ({ ...s, useGrounding: e.target.checked }))} className="h-4 w-4 border-2 border-black rounded" />
                    <label htmlFor="grounding">Use Google Search Grounding</label>
                  </div>
                  <button onClick={onAiSuggest} className="inline-flex items-center gap-2 bg-black text-white rounded-lg px-3 py-1 hover:bg-gray-800 focus:ring-2 focus:ring-black">
                    AI Suggest
                  </button>
                </div>
                {aiStatus && <div className="text-sm text-gray-800">{aiStatus}</div>}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setState(defaultState())} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconRefresh size={16}/>Reset</button>
                <div className="text-sm text-gray-600">State saved to URL</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            {warnings.length > 0 && (
              <div className="border-2 border-black rounded-xl p-3 bg-white text-sm text-gray-800">
                <strong>Warnings:</strong>
                <ul className="list-disc list-inside">
                  {warnings.map((w, i) => (<li key={i}>{w}</li>))}
                </ul>
              </div>
            )}

            <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
              <h2 className="font-semibold mb-3">Swatches</h2>
              <div className="grid gap-4">
                {state.families.map((f) => (
                  <div key={f}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{f}</div>
                      <div className="text-sm text-gray-600">{formatOklch(parseColorToOklch(state.bases[f]) || { l: 0.65, c: 0.12, h: 260 })}</div>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {stepsDefault.map((s) => (
                        <div key={s} className="rounded-lg border border-gray-200 overflow-hidden">
                          <div className="h-14" style={{ backgroundColor: ramps[f]?.[s]?.hex || '#eee' }} />
                          <div className="p-1 text-[10px] text-center text-gray-700">{s}
                            <div className="truncate" title={ramps[f]?.[s]?.hex}><button className="underline" onClick={() => copy(ramps[f]?.[s]?.hex || '')}>{ramps[f]?.[s]?.hex}</button></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-700">
                      Safe pairings: {safePairingsSummary(f, ramps, state.contrastTarget).join(', ') || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
              <h2 className="font-semibold mb-3">Contrast (WCAG)</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {state.families.map((f) => (
                  <div key={f} className="border-2 border-black rounded-lg p-2">
                    <div className="font-medium mb-1">{f}</div>
                    <div className="space-y-1 text-sm">
                      {wcagBadgesForFamily(f, ramps).map((p, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span>{p.label}</span>
                          <span className="inline-flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-gray-100 border border-black text-xs">{p.ratio}:1</span>
                            <span className={`px-2 py-0.5 rounded border text-xs ${p.AA ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-black'}`}>AA</span>
                            <span className={`px-2 py-0.5 rounded border text-xs ${p.AAA ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-black'}`}>AAA</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`grid gap-6 ${state.export === 'all' ? 'md:grid-cols-3' : state.export === 'both' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {(state.export === 'both' || state.export === 'json') && (
              <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Tailwind config JSON</h2>
                  <button onClick={() => copy(twJson)} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconClipboard size={16}/>Copy</button>
                </div>
                <pre className="bg-white border-2 border-black rounded-lg p-2 overflow-auto text-xs whitespace-pre-wrap">{twJson}</pre>
              </div>
              )}
              {(state.export === 'both' || state.export === 'css') && (
              <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">CSS variables</h2>
                  <button onClick={() => copy(cssVars)} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconClipboard size={16}/>Copy</button>
                </div>
                <pre className="bg-white border-2 border-black rounded-lg p-2 overflow-auto text-xs whitespace-pre-wrap">{cssVars}</pre>
              </div>
              )}
              {(state.export === 'v4' || state.export === 'all') && (
              <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Tailwind v4 @theme</h2>
                  <button onClick={() => copy(twV4)} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconClipboard size={16}/>Copy</button>
                </div>
                <pre className="bg-white border-2 border-black rounded-lg p-2 overflow-auto text-xs whitespace-pre-wrap">{twV4}</pre>
              </div>
              )}
            </div>

            <div className="bg-white border-2 border-black rounded-xl shadow-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">HTML preview</h2>
                <button onClick={() => copy(`<div class=\"grid gap-3 p-6 bg-neutral-50 text-neutral-900\">\n  <button class=\"px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700\">Primary</button>\n  <p class=\"text-accent-700\">Accent text</p>\n  <div class=\"p-4 rounded border border-neutral-200\">\n    <span class=\"bg-info-100 text-info-800 px-2 py-1 rounded\">Info badge</span>\n  </div>\n</div>`)} className="inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-2 py-1 hover:bg-gray-100"><IconClipboard size={16}/>Copy</button>
              </div>
              <div
                className="grid gap-3 p-6 rounded-lg border-2 border-black"
                style={{
                  backgroundColor: ramps[previewFamilies.neutral]?.[previewSteps.bg]?.hex || '#f9fafb',
                  color: ramps[previewFamilies.neutral]?.[previewSteps.fg]?.hex || '#111827',
                  borderColor: ramps[previewFamilies.neutral]?.[previewSteps.border]?.hex || '#e5e7eb',
                }}
              >
                <button
                  className="px-4 py-2 rounded"
                  style={{
                    backgroundColor: ramps[previewFamilies.primary]?.[previewSteps.primaryBg]?.hex || '#000000',
                    color: '#ffffff',
                  }}
                >
                  Primary
                </button>
                <p
                  style={{ color: ramps[previewFamilies.accent]?.[previewSteps.accentText]?.hex || '#374151' }}
                >
                  Accent text
                </p>
                <div
                  className="p-4 rounded border-2"
                  style={{ borderColor: ramps[previewFamilies.neutral]?.[previewSteps.border]?.hex || '#e5e7eb' }}
                >
                  <span
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor: ramps[previewFamilies.info]?.[previewSteps.infoBg]?.hex || '#f3f4f6',
                      color: ramps[previewFamilies.info]?.[previewSteps.infoFg]?.hex || '#1f2937',
                    }}
                  >
                    Info badge
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
