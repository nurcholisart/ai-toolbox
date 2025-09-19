import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconCamera, IconSettings, IconX, IconTrash, IconPlus } from '@tabler/icons-react'

// Monochrome dot fills (dark grays for contrast with white text)
const DOT_GRAYS = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']

const storageKey = 'hillChartTasksV1'
const configStorageKey = 'hillChartConfigV1'

export default function HillChart() {
  const svgRef = useRef(null)
  const pathRef = useRef(null)
  const containerRef = useRef(null)
  // Initialize from localStorage synchronously to avoid StrictMode races
  const [tasks, setTasks] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      const arr = Array.isArray(parsed) ? parsed : []
      // migrate legacy tasks that used `name`
      return arr.map((t) => ({
        ...t,
        title: typeof t.title === 'string' ? t.title : (typeof t.name === 'string' ? t.name : ''),
        notes: typeof t.notes === 'string' ? t.notes : '',
      }))
    } catch {
      return []
    }
  })
  const [isDragging, setIsDragging] = useState(false)
  const activeTaskIdRef = useRef(null)
  const pathLenRef = useRef(0)
  const [tick, setTick] = useState(0) // for forcing recompute when layout/size ready
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(configStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          title: typeof parsed.title === 'string' ? parsed.title : '',
          margin: Number.isFinite(parsed.margin) ? parsed.margin : 24,
          includeCaptions: parsed.includeCaptions !== false,
          includeTaskList: !!parsed.includeTaskList,
        }
      }
      // migrate legacy title if present
      const legacyTitle = localStorage.getItem('hillChartTitleV1') || ''
      return { title: legacyTitle, margin: 24, includeCaptions: true, includeTaskList: false }
    } catch {
      return { title: '', margin: 24, includeCaptions: true, includeTaskList: false }
    }
  })
  const [showConfig, setShowConfig] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const configDialogRef = useRef(null)
  const addDialogRef = useRef(null)
  const editDialogRef = useRef(null)
  const [formTitle, setFormTitle] = useState(config.title)
  const [formMargin, setFormMargin] = useState(config.margin)
  const [formIncludeCaptions, setFormIncludeCaptions] = useState(config.includeCaptions)
  const [formIncludeTaskList, setFormIncludeTaskList] = useState(config.includeTaskList)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuDialogRef = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Note: we no longer load in an effect; state hydrates from localStorage above

  // Measure path length once SVG is ready, then force a recompute
  useEffect(() => {
    const p = pathRef.current
    if (p) {
      pathLenRef.current = p.getTotalLength()
      setTick((t) => t + 1)
    }
    // Also schedule a next-frame tick so getScreenCTM is valid post-layout
    const raf = requestAnimationFrame(() => setTick((t) => t + 1))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Save tasks to localStorage when they change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(tasks)) } catch {}
  }, [tasks])

  // Persist config when it changes
  useEffect(() => {
    try { localStorage.setItem(configStorageKey, JSON.stringify(config)) } catch {}
  }, [config])

  // Re-render on resize to keep dot positions accurate
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Sync HTML dialog modals with state (semantic dialogs)
  useEffect(() => {
    const el = configDialogRef.current
    if (!el) return
    try {
      if (showConfig) {
        if (!el.open) el.showModal()
      } else if (el.open) {
        el.close()
      }
    } catch {}
  }, [showConfig])

  useEffect(() => {
    const el = addDialogRef.current
    if (!el) return
    try {
      if (showAddModal) {
        if (!el.open) el.showModal()
      } else if (el.open) {
        el.close()
      }
    } catch {}
  }, [showAddModal])

  useEffect(() => {
    const el = editDialogRef.current
    if (!el) return
    try {
      if (editingId != null) {
        if (!el.open) el.showModal()
      } else if (el.open) {
        el.close()
      }
    } catch {}
  }, [editingId])

  const addTask = (input) => {
    // Accept string (legacy) or object { title, notes }
    const title = typeof input === 'string' ? input : input?.title
    const notes = typeof input === 'string' ? '' : (input?.notes || '')
    const t = String(title || '').trim()
    if (!t) return
    setTasks((prev) => ([
      ...prev,
      {
        id: Date.now(),
        title: t,
        notes: String(notes || ''),
        position: 0, // 0..1 along the path
        color: DOT_GRAYS[prev.length % DOT_GRAYS.length],
      },
    ]))
  }

  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id))
  const deleteAllTasks = () => {
    if (tasks.length === 0) return
    const ok = window.confirm('Delete all tasks? This cannot be undone.')
    if (!ok) return
    setTasks([])
  }

  const getPixelFromViewBox = (vx, vy) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = vx
    pt.y = vy
    const screen = pt.matrixTransform(svg.getScreenCTM())
    const rect = svg.getBoundingClientRect()
    return { x: screen.x - rect.left, y: screen.y - rect.top }
  }

  const getNearestLength = (viewBoxX, viewBoxY) => {
    const p = pathRef.current
    const total = pathLenRef.current
    if (!p || !total) return 0
    let best = 0
    let bestD = Infinity
    // sample step 2 units; good balance of precision/perf for this size
    for (let i = 0; i <= total; i += 2) {
      const pt = p.getPointAtLength(i)
      const dx = pt.x - viewBoxX
      const dy = pt.y - viewBoxY
      const d = dx * dx + dy * dy
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  const onStartDrag = (e, id) => {
    setIsDragging(true)
    activeTaskIdRef.current = id
    document.body.style.cursor = 'grabbing'
  }

  const onMove = (e) => {
    if (!isDragging || activeTaskIdRef.current == null) return
    const svg = svgRef.current
    if (!svg) return
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX)
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY)
    if (clientX == null || clientY == null) return

    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const inv = svg.getScreenCTM().inverse()
    const v = pt.matrixTransform(inv)
    const nearest = getNearestLength(v.x, v.y)
    const pos = Math.max(0, Math.min(1, nearest / (pathLenRef.current || 1)))
    setTasks((prev) => prev.map((t) => (t.id === activeTaskIdRef.current ? { ...t, position: pos } : t)))
    if (e.type === 'touchmove') e.preventDefault()
  }

  const onEndDrag = () => {
    if (!isDragging) return
    setIsDragging(false)
    activeTaskIdRef.current = null
    document.body.style.cursor = 'default'
  }

  useEffect(() => {
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onEndDrag)
    window.addEventListener('touchend', onEndDrag)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onEndDrag)
      window.removeEventListener('touchend', onEndDrag)
    }
  }, [isDragging])

  // Close task action menu when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!openMenuId) return
      const el = e.target
      const insideMenu = el.closest && (el.closest('[data-task-menu]') || el.closest('[data-task-menu-trigger]'))
      if (!insideMenu) setOpenMenuId(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [openMenuId])

  const [taskTitle, setTaskTitle] = useState('')
  const [taskNotes, setTaskNotes] = useState('')
  const onSubmit = (e) => {
    e.preventDefault()
    const title = String(taskTitle || '').trim()
    if (!title) { window.alert('Title is required'); return }
    addTask({ title, notes: taskNotes })
    setTaskTitle('')
    setTaskNotes('')
    setShowAddModal(false)
  }

  // Edit task helpers
  const startEdit = (task) => {
    setEditingId(task.id)
    setEditTitle(String(task.title || task.name || ''))
    setEditNotes(String(task.notes || ''))
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditNotes('')
  }
  const saveEdit = () => {
    if (editingId == null) return
    const title = String(editTitle || '').trim()
    if (!title) {
      window.alert('Title is required')
      return
    }
    const notes = String(editNotes || '')
    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, title, notes } : t)))
    cancelEdit()
  }

  // Toggle and position the task action menu
  const toggleMenu = (e, task) => {
    const target = e?.currentTarget || null
    const rect = target ? target.getBoundingClientRect() : null
    setOpenMenuId((prev) => (prev === task.id ? null : task.id))
    if (rect) setMenuPos({ x: rect.left + rect.width + 8, y: rect.top + rect.height / 2 })
  }

  // Close global task menu with Escape
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape') setOpenMenuId(null)
    }
    if (openMenuId != null) {
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [openMenuId])

  // After opening, measure and clamp menu within viewport; flip to left if needed
  useEffect(() => {
    if (openMenuId == null) return
    const raf = requestAnimationFrame(() => {
      const dlg = menuDialogRef.current
      if (!dlg) return
      const d = dlg.getBoundingClientRect()
      const margin = 8
      let x = menuPos.x
      let y = menuPos.y
      // Clamp horizontally; if overflow right, try left of trigger using approx width
      if (x + d.width > window.innerWidth - margin) {
        x = Math.max(margin, window.innerWidth - d.width - margin)
      }
      // Clamp vertical center so the box stays on-screen considering translateY(-50%)
      const half = d.height / 2
      if (y - half < margin) y = margin + half
      if (y + half > window.innerHeight - margin) y = window.innerHeight - margin - half
      setMenuPos((prev) => (prev.x !== x || prev.y !== y ? { x, y } : prev))
    })
    return () => cancelAnimationFrame(raf)
  }, [openMenuId])
  
  // Truncate inline dot label to 24 chars, avoid splitting words
  const truncateName = (s, max = 24) => {
    if (!s) return ''
    if (s.length <= max) return s
    const seg = s.slice(0, max)
    const lastSpace = seg.lastIndexOf(' ')
    if (lastSpace > 0) {
      const base = seg.slice(0, lastSpace).replace(/[\s\.,;:!\-]+$/g, '')
      return base ? base + '…' : seg.slice(0, max - 1) + '…'
    }
    return seg.slice(0, max - 1) + '…'
  }

  // Pre-compute pixel positions
  const dots = useMemo(() => {
    const p = pathRef.current
    if (!p) return []
    return tasks.map((t) => {
      const pt = p.getPointAtLength(t.position * (pathLenRef.current || 0))
      const px = getPixelFromViewBox(pt.x, pt.y)
      return { id: t.id, name: (t.title || t.name || ''), color: t.color, left: px.x, top: px.y }
    })
  }, [tasks, tick])

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6'>
        <header className='text-center mb-6'>
          <h1 className='text-3xl sm:text-4xl font-bold text-black'>Hill Chart</h1>
          <p className='text-gray-600 mt-2'>
            Hill Chart shows certainty, not time: left is uphill (figuring it out), right is downhill (execution). Move dots as confidence grows; crossing the peak means the approach is known.
          </p>
        </header>

        <main className='bg-white border-2 border-black rounded-xl shadow-md p-6 sm:p-8'>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4'>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => {
                  setFormTitle(config.title)
                  setFormMargin(config.margin)
                  setFormIncludeCaptions(config.includeCaptions)
                  setFormIncludeTaskList(config.includeTaskList)
                  setShowConfig(true)
                }}
                className='bg-white border-2 border-black text-black rounded-lg px-3 py-1.5 hover:bg-gray-100'
                aria-label='Configure hill chart'
              >
                <span className='inline-flex items-center gap-2'>
                  <IconSettings className='w-4 h-4' />
                  Configure
                </span>
              </button>
            </div>
            <button
              type='button'
              onClick={() => {
                const el = containerRef.current
                if (!el) return
                const rect = el.getBoundingClientRect()
                const dpr = window.devicePixelRatio || 1
                const title = config.title || ''
                const margin = Math.max(8, Math.min(64, Number(config.margin) || 24))
                const titleHeight = title ? 32 : 0
                const captionHeight = config.includeCaptions ? 28 : 0
                // task list dynamic height if included
                const fontBase = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", "Helvetica Neue", Arial'
                let taskListHeight = 0
                let taskListMetrics = null
                if (config.includeTaskList) {
                  // Estimate heights (heading + single-line items)
                  const headingH = 20
                  const gapTop = 8
                  const itemH = 22
                  const items = Math.max(1, tasks.length) // include placeholder if empty
                  taskListHeight = gapTop + headingH + items * itemH + 8
                  taskListMetrics = { headingH, gapTop, itemH }
                }

                const canvas = document.createElement('canvas')
                const exportW = Math.max(1, rect.width + margin * 2)
                const exportH = Math.max(1, rect.height + margin * 2 + titleHeight + captionHeight + taskListHeight)
                canvas.width = Math.round(exportW * dpr)
                canvas.height = Math.round(exportH * dpr)
                const ctx = canvas.getContext('2d')
                if (!ctx) return

                // draw using CSS pixel coordinates
                ctx.scale(dpr, dpr)
                const width = exportW
                const height = exportH
                const chartX = margin
                const chartY = margin + titleHeight
                const chartW = rect.width
                const chartH = rect.height
                const captionY = chartY + chartH + 6
                const taskListY = chartY + chartH + (config.includeCaptions ? (6 + 16) : 0)

                // background
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, width, height)

                // title
                if (title) {
                  const fontBase = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", "Helvetica Neue", Arial'
                  ctx.fillStyle = '#000000'
                  ctx.font = `700 18px ${fontBase}`
                  ctx.textAlign = 'left'
                  ctx.textBaseline = 'top'
                  ctx.fillText(title, margin, margin)
                }

                // hill path (scale from 800x200 viewBox)
                const sx = chartW / 800
                const sy = chartH / 200
                ctx.save()
                ctx.translate(chartX, chartY)
                ctx.scale(sx, sy)
                ctx.beginPath()
                ctx.moveTo(0, 180)
                ctx.bezierCurveTo(200, 180, 200, 20, 400, 20)
                ctx.bezierCurveTo(600, 20, 600, 180, 800, 180)
                ctx.strokeStyle = '#4b5563'
                ctx.lineWidth = 4
                ctx.stroke()
                ctx.restore()

                // center dashed line
                ctx.beginPath()
                ctx.setLineDash([6, 6])
                ctx.moveTo(chartX + chartW / 2, chartY)
                ctx.lineTo(chartX + chartW / 2, chartY + chartH)
                ctx.strokeStyle = '#374151'
                ctx.lineWidth = 2
                ctx.stroke()
                ctx.setLineDash([])

                // dots and inline labels
                // reuse fontBase declared above
                const radius = 16
;(Array.isArray(dots) ? dots : []).forEach((d, i) => {
                  // dot
                  ctx.beginPath()
                  ctx.arc(chartX + d.left, chartY + d.top, radius, 0, Math.PI * 2)
                  ctx.fillStyle = d.color || '#111111'
                  ctx.fill()
                  ctx.lineWidth = 2
                  ctx.strokeStyle = '#ffffff'
                  ctx.stroke()

                  // number
                  ctx.fillStyle = '#ffffff'
                  ctx.font = `700 14px ${fontBase}`
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  ctx.fillText(String(i + 1), chartX + d.left, chartY + d.top)

                  // name
                  ctx.fillStyle = '#4b5563'
                  ctx.font = `500 12px ${fontBase}`
                  ctx.textAlign = 'left'
                  ctx.textBaseline = 'middle'
                  const label = (typeof d.name === 'string' ? d.name : '')
                  const txt = label.length <= 24 ? label : (() => {
                    const seg = label.slice(0, 24)
                    const last = seg.lastIndexOf(' ')
                    if (last > 0) {
                      const base = seg.slice(0, last).replace(/[\s\.,;:!\-]+$/g, '')
                      return base ? base + '…' : seg.slice(0, 23) + '…'
                    }
                    return seg.slice(0, 23) + '…'
                  })()
                  ctx.fillText(txt, chartX + d.left + radius + 12, chartY + d.top)
                })

                // captions under the chart (optional)
                if (config.includeCaptions) {
                  ctx.strokeStyle = '#e5e7eb'
                  ctx.lineWidth = 1
                  ctx.beginPath()
                  ctx.moveTo(chartX, chartY + chartH + 0.5)
                  ctx.lineTo(chartX + chartW, chartY + chartH + 0.5)
                  ctx.stroke()

                  ctx.fillStyle = '#6b7280'
                  ctx.font = `600 12px ${fontBase}`
                  ctx.textBaseline = 'top'

                  // left caption
                  ctx.textAlign = 'left'
                  ctx.fillText('↑ Uphill (Figuring it out)', chartX, captionY)

                  // right caption
                  ctx.textAlign = 'right'
                  ctx.fillText('↓ Downhill (Execution)', chartX + chartW, captionY)
                }

                // task list area (optional)
                if (config.includeTaskList) {
                  // separator line
                  ctx.strokeStyle = '#e5e7eb'
                  ctx.lineWidth = 1
                  ctx.beginPath()
                  ctx.moveTo(chartX, chartY + chartH + (config.includeCaptions ? 28 : 0) + 0.5)
                  ctx.lineTo(chartX + chartW, chartY + chartH + (config.includeCaptions ? 28 : 0) + 0.5)
                  ctx.stroke()

                  let y = taskListY + (config.includeCaptions ? 12 : 8)
                  // heading
                  ctx.fillStyle = '#111111'
                  ctx.font = `700 14px ${fontBase}`
                  ctx.textAlign = 'left'
                  ctx.textBaseline = 'top'
                  ctx.fillText('Tasks', chartX, y)
                  y += taskListMetrics ? taskListMetrics.headingH : 20

                  // function to truncate text to fit width
                  const fitText = (text, maxWidth) => {
                    let t = String(text || '')
                    if (!t) return ''
                    // quick accept
                    if (ctx.measureText(t).width <= maxWidth) return t
                    // binary search truncate with ellipsis
                    let lo = 0, hi = t.length
                    while (lo < hi) {
                      const mid = Math.floor((lo + hi) / 2)
                      const candidate = t.slice(0, mid) + '…'
                      if (ctx.measureText(candidate).width <= maxWidth) lo = mid + 1
                      else hi = mid
                    }
                    const cut = Math.max(1, lo - 1)
                    return t.slice(0, cut) + '…'
                  }

                  ctx.font = `500 13px ${fontBase}`
                  const itemH = taskListMetrics ? taskListMetrics.itemH : 22
                  const smallR = 9
                  const list = tasks.length ? tasks : [{ title: 'No tasks yet.' }]
                  list.forEach((t, idx) => {
                    const titleRaw = String((t.title || t.name || ''))
                    const notesRaw = String(t?.notes || '').trim()
                    const hasNotes = !!(tasks.length && notesRaw)
                    const xText = chartX + (tasks.length ? smallR * 2 + 8 : 0)
                    const maxTextWidth = chartW - (xText - chartX) - 6

                    // Fit title + notes within available width, taking into account
                    // bold font for title and regular font for notes.
                    const measure = (titleText, notesText) => {
                      ctx.font = `700 13px ${fontBase}`
                      const wTitle = ctx.measureText(titleText).width
                      ctx.font = `500 13px ${fontBase}`
                      const wSep = notesText ? ctx.measureText(' - ').width : 0
                      const wNotes = notesText ? ctx.measureText(notesText).width : 0
                      return wTitle + wSep + wNotes
                    }

                    const truncateWithFont = (text, targetWidth, font) => {
                      ctx.font = font
                      if (ctx.measureText(text).width <= targetWidth) return text
                      let lo = 0, hi = text.length
                      while (lo < hi) {
                        const mid = Math.floor((lo + hi) / 2)
                        const candidate = text.slice(0, mid) + '…'
                        if (ctx.measureText(candidate).width <= targetWidth) lo = mid + 1
                        else hi = mid
                      }
                      const cut = Math.max(1, lo - 1)
                      return text.slice(0, cut) + '…'
                    }

                    let titleText = titleRaw
                    let notesText = hasNotes ? notesRaw : ''
                    if (measure(titleText, notesText) > maxTextWidth) {
                      // Try truncating notes first
                      if (notesText) {
                        const wTitle = (() => { ctx.font = `700 13px ${fontBase}`; return ctx.measureText(titleText).width })()
                        const wSep = (() => { ctx.font = `500 13px ${fontBase}`; return ctx.measureText(' - ').width })()
                        const budget = Math.max(0, maxTextWidth - wTitle - wSep)
                        if (budget > 0) {
                          notesText = truncateWithFont(notesText, budget, `500 13px ${fontBase}`)
                        } else {
                          notesText = ''
                        }
                      }
                      // If still too wide or no notes, truncate title
                      if (measure(titleText, notesText) > maxTextWidth) {
                        const budget = maxTextWidth - (notesText ? (() => { ctx.font = `500 13px ${fontBase}`; return ctx.measureText(' - ' + notesText).width })() : 0)
                        titleText = truncateWithFont(titleText, Math.max(0, budget), `700 13px ${fontBase}`)
                      }
                    }

                    // number dot for real tasks
                    if (tasks.length) {
                      // Align the dot with the single text line
                      const centerY = y + itemH / 2
                      ctx.beginPath()
                      ctx.arc(chartX + smallR, centerY, smallR, 0, Math.PI * 2)
                      ctx.fillStyle = tasks.length ? (tasks[idx]?.color || '#111111') : '#9ca3af'
                      ctx.fill()
                      ctx.lineWidth = 1.5
                      ctx.strokeStyle = '#ffffff'
                      ctx.stroke()

                      ctx.fillStyle = '#ffffff'
                      ctx.font = `700 11px ${fontBase}`
                      ctx.textAlign = 'center'
                      ctx.textBaseline = 'middle'
                      ctx.fillText(String(idx + 1), chartX + smallR, centerY)
                    }

                    // draw single line: [Title] - [Notes], vertically centered
                    ctx.textAlign = 'left'
                    ctx.textBaseline = 'middle'
                    const lineCenterY = y + itemH / 2
                    // title in bold, darker
                    ctx.fillStyle = '#374151'
                    ctx.font = `700 13px ${fontBase}`
                    ctx.fillText(titleText, xText, lineCenterY)
                    let xCursor = xText + ctx.measureText(titleText).width

                    if (notesText) {
                      // separator and notes in regular, lighter gray
                      ctx.fillStyle = '#6b7280'
                      ctx.font = `500 13px ${fontBase}`
                      const sep = ' - '
                      ctx.fillText(sep, xCursor, lineCenterY)
                      xCursor += ctx.measureText(sep).width
                      ctx.fillText(notesText, xCursor, lineCenterY)
                    }

                    y += itemH
                  })
                }

                const link = document.createElement('a')
                const ts = new Date()
                  .toISOString()
                  .replace(/[-:]/g, '')
                  .replace(/\..+$/, '')
                link.download = `hill-chart-${ts}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()
              }}
              className='bg-white border-2 border-black text-black rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50'
              aria-label='Download screenshot'
            >
              <IconCamera className='w-5 h-5' />
            </button>
          </div>
          {/* Settings dialog (HTML dialog) */}
          <dialog
            ref={configDialogRef}
            className='w-11/12 sm:w-[480px] p-0 bg-transparent border-0'
            onClose={() => setShowConfig(false)}
          >
            <div className='bg-white border-2 border-black rounded-xl shadow-md p-5'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-black'>Hill Chart Settings</h3>
                <button
                  type='button'
                  onClick={() => configDialogRef.current?.close()}
                  className='bg-white border-2 border-black text-black rounded-lg p-1 hover:bg-gray-100'
                  aria-label='Close settings'
                >
                  <IconX className='w-4 h-4' />
                </button>
              </div>
              <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Screenshot title</label>
                    <input
                      type='text'
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder='e.g. Sprint 12 – Week 2'
                      className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Margin (px)</label>
                    <input
                      type='number'
                      min='8'
                      max='64'
                      step='1'
                      value={formMargin}
                      onChange={(e) => setFormMargin(Number(e.target.value))}
                      className='w-32 bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none'
                    />
                  </div>
                  <div className='flex items-center gap-2'>
                    <input
                      id='include-captions'
                      type='checkbox'
                      className='w-4 h-4'
                      checked={formIncludeCaptions}
                      onChange={(e) => setFormIncludeCaptions(e.target.checked)}
                    />
                    <label htmlFor='include-captions' className='text-sm text-gray-800'>Include bottom captions</label>
                  </div>
                  <div className='flex items-center gap-2'>
                    <input
                      id='include-tasklist'
                      type='checkbox'
                      className='w-4 h-4'
                      checked={formIncludeTaskList}
                      onChange={(e) => setFormIncludeTaskList(e.target.checked)}
                    />
                    <label htmlFor='include-tasklist' className='text-sm text-gray-800'>Include task list in screenshot</label>
                  </div>
                </div>
                <div className='mt-5 flex justify-end gap-2'>
                  <button
                    type='button'
                    onClick={() => configDialogRef.current?.close()}
                    className='bg-white border-2 border-black text-black rounded-lg px-3 py-1.5 hover:bg-gray-100'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setConfig({
                        title: String(formTitle || ''),
                        margin: Math.max(8, Math.min(64, Number(formMargin) || 24)),
                        includeCaptions: !!formIncludeCaptions,
                        includeTaskList: !!formIncludeTaskList,
                      })
                      configDialogRef.current?.close()
                    }}
                    className='bg-black text-white rounded-lg px-4 py-1.5 hover:bg-gray-800 focus:ring-2 focus:ring-black'
                  >
                    Save
                  </button>
                </div>
              </div>
          </dialog>

          {/* Add task dialog (HTML dialog) */}
          <dialog
            ref={addDialogRef}
            className='w-11/12 sm:w-[480px] p-0 bg-transparent border-0'
            onClose={() => setShowAddModal(false)}
          >
            <div className='bg-white border-2 border-black rounded-xl shadow-md p-5'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-black'>Add New Task</h3>
                <button
                  type='button'
                  onClick={() => addDialogRef.current?.close()}
                  className='bg-white border-2 border-black text-black rounded-lg p-1 hover:bg-gray-100'
                  aria-label='Close add task'
                >
                  <IconX className='w-4 h-4' />
                </button>
              </div>
              <form onSubmit={onSubmit} className='space-y-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Title</label>
                  <input
                    type='text'
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder='e.g., Design database schema'
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Notes</label>
                  <textarea
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    placeholder='Notes (optional, shown only in the task list)'
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none min-h-[64px]'
                  />
                </div>
                <div className='flex justify-end gap-2 pt-2'>
                  <button
                    type='button'
                    onClick={() => addDialogRef.current?.close()}
                    className='bg-white border-2 border-black text-black rounded-lg px-3 py-1.5 hover:bg-gray-100'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='bg-black text-white rounded-lg px-4 py-1.5 hover:bg-gray-800 focus:ring-2 focus:ring-black'
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </dialog>

          {/* Edit task dialog (HTML dialog) */}
          <dialog
            ref={editDialogRef}
            className='w-11/12 sm:w-[480px] p-0 bg-transparent border-0'
            onClose={cancelEdit}
          >
            <div className='bg-white border-2 border-black rounded-xl shadow-md p-5'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-black'>Edit Task</h3>
                <button
                  type='button'
                  onClick={() => editDialogRef.current?.close()}
                  className='bg-white border-2 border-black text-black rounded-lg p-1 hover:bg-gray-100'
                  aria-label='Close edit task'
                >
                  <IconX className='w-4 h-4' />
                </button>
              </div>
              <div className='space-y-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Title</label>
                  <input
                    type='text'
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder='Title'
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder='Notes (optional)'
                    className='w-full bg-white border-2 border-black rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none min-h-[64px]'
                  />
                </div>
                <div className='flex justify-end gap-2 pt-2'>
                  <button
                    type='button'
                    onClick={() => editDialogRef.current?.close()}
                    className='bg-white border-2 border-black text-black rounded-lg px-3 py-1.5 hover:bg-gray-100'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={saveEdit}
                    className='bg-black text-white rounded-lg px-4 py-1.5 hover:bg-gray-800 focus:ring-2 focus:ring-black'
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </dialog>
          <div ref={containerRef} className='relative w-full h-48 sm:h-64 mb-8 touch-none' id='hill-container'>
            <svg ref={svgRef} className='w-full h-full' viewBox='0 0 800 200' preserveAspectRatio='none'>
              <path
                ref={pathRef}
                d='M0 180 C 200 180, 200 20, 400 20 C 600 20, 600 180, 800 180'
                fill='none'
                stroke='#4b5563'
                strokeWidth='4'
              />
            </svg>
            {/* Peak line */}
            <div
              className='absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px]'
              style={{
                backgroundImage: 'linear-gradient(to bottom, #374151 50%, transparent 50%)',
                backgroundSize: '100% 12px',
              }}
            />

            {/* Dots */}
            <div className='absolute inset-0'>
              {dots.map((d, i) => (
                <div
                  key={d.id}
                  className='group absolute w-8 h-8 rounded-full flex items-center justify-center font-bold text-white cursor-grab select-none border-2 border-white shadow'
                  style={{ left: d.left, top: d.top, transform: 'translate(-50%, -50%)', backgroundColor: d.color }}
                  onMouseDown={(e) => onStartDrag(e, d.id)}
                  onTouchStart={(e) => onStartDrag(e, d.id)}
                >
                  {i + 1}
                  {/* Inline truncated label */}
                  <span className='absolute left-full top-1/2 -translate-y-1/2 ml-3 text-gray-600 text-sm font-medium whitespace-nowrap pointer-events-none'>
                    {truncateName(d.name)}
                  </span>
                  {/* Popover removed per request */}
                </div>
              ))}
            </div>

            {/* Labels */}
            <div className='absolute -bottom-7 left-0 right-0 flex justify-between text-sm text-gray-500'>
              <span className='w-1/2 text-center font-semibold'>↑ Uphill (Figuring it out)</span>
              <span className='w-1/2 text-center font-semibold'>↓ Downhill (Execution)</span>
            </div>
          </div>

          <div className='space-y-8'>
            {/* Add Task */}
            {/* Removed dedicated Add New Task container; add button moved to Task List header */}

            {/* Task List */}
            <div className='w-full'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-semibold text-black'>Task List</h2>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => { setTaskTitle(''); setTaskNotes(''); setShowAddModal(true) }}
                    className='bg-black text-white rounded-lg p-2 hover:bg-gray-800 focus:ring-2 focus:ring-black'
                    aria-label='Add task'
                    title='Add task'
                  >
                    <IconPlus className='w-5 h-5' />
                  </button>
                  <button
                    type='button'
                    onClick={deleteAllTasks}
                    className='bg-white border-2 border-black text-black rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50'
                    disabled={tasks.length === 0}
                    aria-label='Delete all tasks'
                    title='Delete all tasks'
                  >
                    <IconTrash className='w-5 h-5' />
                  </button>
                </div>
              </div>
              <div className='space-y-1 max-h-64 overflow-y-auto'>
                {tasks.length === 0 && (
                  <p className='text-gray-500 italic'>No tasks yet.</p>
                )}
                {tasks.map((t, i) => (
                  <div key={t.id} className='relative flex items-center justify-between py-2 px-0 rounded-lg'>
                    <div className='flex-1 flex items-center gap-3'>
                      <button
                        type='button'
                        data-task-menu-trigger
                        onClick={(e) => toggleMenu(e, t)}
                        className='flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white focus:outline-none'
                        style={{ backgroundColor: t.color }}
                        aria-haspopup='menu'
                        aria-expanded={openMenuId === t.id}
                        title='Task actions'
                      >
                        {i + 1}
                      </button>
                      <div className='min-w-0 text-gray-800 break-words leading-6'>
                        <span className='font-semibold'>{t.title || t.name}</span>
                        {t.notes && <span className='text-gray-600'> {' - '}{t.notes}</span>}
                      </div>
                    </div>
                    {/* per-item inline menu removed; single global dialog used below */}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className='text-center mt-6 text-gray-600 text-sm'>
          Data is saved locally in your browser.
        </footer>
      </div>
      {/* Global Task Action Menu dialog (fixed, avoids clipping) */}
      <dialog
        ref={menuDialogRef}
        data-task-menu
        open={openMenuId != null}
        className='p-0 bg-transparent border-0 fixed z-50'
        style={{ left: menuPos.x, top: menuPos.y, transform: 'translateY(-50%)', margin: 0 }}
        onClose={() => setOpenMenuId(null)}
      >
        <div className='bg-white border-2 border-black rounded-lg shadow-md'>
          <button
            onClick={() => { const t = tasks.find(x => x.id === openMenuId); if (t) startEdit(t); setOpenMenuId(null) }}
            className='block w-full text-left px-3 py-1.5 hover:bg-gray-100 text-black'
          >
            Edit task
          </button>
          <button
            onClick={() => { if (openMenuId != null) deleteTask(openMenuId); setOpenMenuId(null) }}
            className='block w-full text-left px-3 py-1.5 hover:bg-gray-100 text-black'
          >
            Delete task
          </button>
        </div>
      </dialog>
    </div>
  )
}
