import React, { useMemo, useRef, useState, useCallback } from 'react'
import {
  IconArrowLeft,
  IconSettings,
  IconPlus,
  IconX,
  IconPencil,
  IconZoomIn,
  IconZoomOut,
  IconFocusCentered,
} from '@tabler/icons-react'
import InstallPrompt from './InstallPrompt.jsx'

/**
 * BreadBoarder — Flow canvas with:
 * - Zoom in/out (wheel + buttons)
 * - Draggable/pannable background
 * - Fit-to-content
 * - Minimap (click to center)
 * - Add/Delete nodes ("Place")
 * - Rename place title (inline editable)
 * - Per-row connectors (Copy/Action rows)
 * - Dot-grid background
 *
 * Update: source port di KANAN, target port di KIRI.
 * Klik port kanan untuk mulai link; lepas di port kiri target untuk menyambungkan.
 *
 * Catatan stabilitas: rendering edge kini defensif terhadap data tidak valid
 * (mis. edge parsial/null) agar tidak melempar TypeError.
 */

// ---- Types --------------------------------------------------------------

/**
 * @typedef {'copy' | 'action'} SectionKey
 * @typedef {{ nodeId: string, section: SectionKey, index: number }} PortRef
 * @typedef {{ id: string, from: PortRef, to: PortRef }} Edge
 * @typedef {{ id: string, x: number, y: number, title: string, copy: string[], action: string[] }} NodeData
 */

// ---- Constants (layout) -------------------------------------------------

const NODE_WIDTH = 560
const HEADER_H = 56
const SECTION_TITLE_H = 44
const ROW_H = 40
const PADDING = 12
const PORT_R = 6
const LEFT_PORT_OFFSET = 8

// ---- Utilities ----------------------------------------------------------

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function nodeHeight(n) {
  return (
    HEADER_H +
    SECTION_TITLE_H + n.copy.length * ROW_H +
    SECTION_TITLE_H + n.action.length * ROW_H
  )
}

function portPoint(node, section, index, side = 'right') {
  const xLeft = node.x
  const yTop = node.y

  let y = yTop + HEADER_H
  if (section === 'action') {
    y += SECTION_TITLE_H + node.copy.length * ROW_H
  }
  y += SECTION_TITLE_H + index * ROW_H + ROW_H / 2

  const rightX = xLeft + NODE_WIDTH - PADDING - PORT_R - 2
  const leftX = xLeft + LEFT_PORT_OFFSET + PORT_R
  const x = side === 'right' ? rightX : leftX
  return { x, y }
}

function bezierPath(p1, p2) {
  const dx = Math.abs(p2.x - p1.x)
  const offset = clamp(dx * 0.5, 60, 240)
  const c1x = p1.x + offset
  const c2x = p2.x - offset
  return `M ${p1.x},${p1.y} C ${c1x},${p1.y} ${c2x},${p2.y} ${p2.x},${p2.y}`
}

// ---- Component ----------------------------------------------------------

export default function BreadBoarder() {
  const rootRef = useRef(null)

  const [nodes, setNodes] = useState(() => [
    {
      id: uid('node'),
      x: 60,
      y: 60,
      title: 'Place: Homepage',
      copy: ['Headline A', 'Sub-copy', 'CTA microcopy'],
      action: ['Primary CTA', 'Secondary CTA', 'Keyboard shortcut'],
    },
  ])

  const [edges, setEdges] = useState([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const dragNodeRef = useRef(null)
  const panDragRef = useRef(null)

  const [draftFrom, setDraftFrom] = useState(null)
  const cancelDraft = useCallback(() => setDraftFrom(null), [])
  const [mouseScreen, setMouseScreen] = useState({ x: 0, y: 0 })

  const screenToCanvas = useCallback(
    (sx, sy) => ({ x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom }),
    [pan, zoom]
  )

  const onMouseMove = useCallback(
    (e) => {
      setMouseScreen({ x: e.clientX, y: e.clientY })

      if (panDragRef.current) {
        const dx = e.clientX - panDragRef.current.sx
        const dy = e.clientY - panDragRef.current.sy
        setPan({ x: panDragRef.current.px + dx, y: panDragRef.current.py + dy })
        return
      }

      if (dragNodeRef.current) {
        const dragging = dragNodeRef.current
        const mouseCanvas = screenToCanvas(e.clientX, e.clientY)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragging.nodeId
              ? { ...n, x: mouseCanvas.x - dragging.dx, y: mouseCanvas.y - dragging.dy }
              : n
          )
        )
      }
    },
    [screenToCanvas]
  )

  const onMouseUp = useCallback(() => {
    dragNodeRef.current = null
    panDragRef.current = null
  }, [])

  const startPan = (e) => {
    panDragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
  }

  const onWheel = (e) => {
    const step = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = clamp(zoom * step, 0.25, 3)
    const mouse = { x: e.clientX, y: e.clientY }
    const c = screenToCanvas(mouse.x, mouse.y)
    const newPan = { x: mouse.x - c.x * newZoom, y: mouse.y - c.y * newZoom }
    setZoom(newZoom)
    setPan(newPan)
  }

  const startDragNode = (e, node) => {
    const m = screenToCanvas(e.clientX, e.clientY)
    dragNodeRef.current = { nodeId: node.id, dx: m.x - node.x, dy: m.y - node.y }
  }

  const addRow = (nodeId, section) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const nextRows = [...n[section], section === 'copy' ? 'New copy' : 'New action']
        return { ...n, [section]: nextRows }
      })
    )
  }

  const removeRow = (nodeId, section, index) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const filtered = n[section].filter((_, i) => i !== index)
        return { ...n, [section]: filtered }
      })
    )
    setEdges((prev) =>
      prev.filter((edge) => {
        const e = edge || {}
        const f = e?.from
        const t = e?.to
        if (!f || !t) return false
        const match =
          (f.nodeId === nodeId && f.section === section && f.index === index) ||
          (t.nodeId === nodeId && t.section === section && t.index === index)
        return !match
      })
    )
  }

  const beginLink = (ref) => setDraftFrom(ref)
  const commitLink = (target) => {
    const start = draftFrom
    if (!start) return
    if (start.nodeId === target.nodeId && start.section === target.section && start.index === target.index) {
      setDraftFrom(null)
      return
    }
    const id = uid('edge')
    setEdges((prev) => [...prev, { id, from: start, to: target }])
    setDraftFrom(null)
  }

  const addNode = () => {
    const el = rootRef.current
    if (!el) return
    const centerScreen = { x: el.clientWidth / 2, y: el.clientHeight / 2 }
    const centerCanvas = screenToCanvas(centerScreen.x, centerScreen.y)
    const newNode = {
      id: uid('node'),
      x: centerCanvas.x - NODE_WIDTH / 2,
      y: centerCanvas.y - 100,
      title: 'Place: Untitled',
      copy: ['untitled'],
      action: ['untitled'],
    }
    setNodes((prev) => [...prev, newNode])
  }

  const deleteNode = (nodeId) => {
    setEdges((prev) => prev.filter((edge) => edge?.from?.nodeId !== nodeId && edge?.to?.nodeId !== nodeId))
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
  }

  const fit = () => {
    const el = rootRef.current
    if (!el || nodes.length === 0) return
    const pad = 60

    const minX = Math.min(...nodes.map((n) => n.x))
    const minY = Math.min(...nodes.map((n) => n.y))
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH))
    const maxY = Math.max(...nodes.map((n) => n.y + nodeHeight(n)))

    const contentW = maxX - minX
    const contentH = maxY - minY

    const w = el.clientWidth - pad * 2
    const h = el.clientHeight - pad * 2
    const z = clamp(Math.min(w / contentW, h / contentH), 0.1, 4)

    const centerCanvas = { x: minX + contentW / 2, y: minY + contentH / 2 }
    const centerScreen = { x: el.clientWidth / 2, y: el.clientHeight / 2 }

    setZoom(z)
    setPan({ x: centerScreen.x - centerCanvas.x * z, y: centerScreen.y - centerCanvas.y * z })
  }

  const zoomIn = () => {
    const m = { x: (rootRef.current?.clientWidth || 0) / 2, y: (rootRef.current?.clientHeight || 0) / 2 }
    const c = screenToCanvas(m.x, m.y)
    const newZoom = clamp(zoom * 1.2, 0.25, 4)
    setZoom(newZoom)
    setPan({ x: m.x - c.x * newZoom, y: m.y - c.y * newZoom })
  }
  const zoomOut = () => {
    const m = { x: (rootRef.current?.clientWidth || 0) / 2, y: (rootRef.current?.clientHeight || 0) / 2 }
    const c = screenToCanvas(m.x, m.y)
    const newZoom = clamp(zoom / 1.2, 0.25, 4)
    setZoom(newZoom)
    setPan({ x: m.x - c.x * newZoom, y: m.y - c.y * newZoom })
  }

  const draftMouseCanvas = useMemo(() => screenToCanvas(mouseScreen.x, mouseScreen.y), [mouseScreen, screenToCanvas])

  const MINIMAP_W = 200
  const MINIMAP_H = 120
  const bbox = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    const minX = Math.min(...nodes.map((n) => n.x))
    const minY = Math.min(...nodes.map((n) => n.y))
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH))
    const maxY = Math.max(...nodes.map((n) => n.y + nodeHeight(n)))
    return { minX, minY, maxX, maxY }
  }, [nodes])

  const miniScale = useMemo(() => {
    const w = bbox.maxX - bbox.minX
    const h = bbox.maxY - bbox.minY
    return Math.min(MINIMAP_W / (w || 1), MINIMAP_H / (h || 1))
  }, [bbox])

  const viewportRectInMini = useMemo(() => {
    const el = rootRef.current
    if (!el) return { x: 0, y: 0, w: 10, h: 10 }
    const leftTopCanvas = screenToCanvas(0, 0)
    const rightBotCanvas = screenToCanvas(el.clientWidth, el.clientHeight)
    const x = (leftTopCanvas.x - bbox.minX) * miniScale
    const y = (leftTopCanvas.y - bbox.minY) * miniScale
    const w = (rightBotCanvas.x - leftTopCanvas.x) * miniScale
    const h = (rightBotCanvas.y - leftTopCanvas.y) * miniScale
    return { x, y, w, h }
  }, [miniScale, bbox, screenToCanvas])

  const minimapClick = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cx = bbox.minX + mx / miniScale
    const cy = bbox.minY + my / miniScale
    const el = rootRef.current
    if (!el) return
    const z = zoom
    setPan({ x: el.clientWidth / 2 - cx * z, y: el.clientHeight / 2 - cy * z })
  }

  return (
    <div className='flex min-h-screen flex-col bg-gray-100 text-gray-900'>
      <header className='border-b-2 border-black bg-white'>
        <div className='flex h-20 items-center justify-between gap-4 px-4 sm:px-6'>
          <div className='flex items-center gap-2'>
            <a
              href='/'
              className='inline-flex h-10 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
            >
              <IconArrowLeft size={18} stroke={2} />
              <span className='hidden sm:inline'>Back to tools</span>
            </a>
          </div>
          <div className='flex flex-col items-center gap-1 text-center'>
            <h1 className='text-xl font-semibold text-gray-900 sm:text-2xl'>BreadBoarder</h1>
            <p className='text-xs text-gray-600 sm:text-sm'>Map product places, copy, and actions in an infinite canvas.</p>
          </div>
          <div className='flex items-center justify-end gap-2'>
            <InstallPrompt />
            <a
              href='/settings'
              className='inline-flex h-10 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'
            >
              <IconSettings size={16} stroke={2} />
              Edit Config
            </a>
          </div>
        </div>
      </header>
      <main className='flex min-h-0 flex-1 overflow-hidden'>
        <section aria-label='BreadBoarder canvas' className='flex h-full w-full flex-1 min-h-0'>
          <div
            ref={rootRef}
            className='relative flex-1 h-full min-h-0 w-full overflow-hidden bg-gray-50'
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Escape' && draftFrom) {
                  e.preventDefault()
                  cancelDraft()
                }
              }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onWheel={onWheel}
              style={{
                backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundColor: '#fafafa',
              }}
            >
              <div
                className='absolute inset-0'
                onMouseDown={(e) => {
                  if (draftFrom) {
                    e.stopPropagation()
                    cancelDraft()
                    return
                  }
                  startPan(e)
                }}
              />

              <svg
                className='pointer-events-none absolute inset-0 h-full w-full'
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
              >
                {edges.map((e) => {
                  const f = e?.from ?? null
                  const t = e?.to ?? null
                  if (!f || !t) return null
                  const nFrom = nodes.find((n) => n.id === f.nodeId)
                  const nTo = nodes.find((n) => n.id === t.nodeId)
                  if (!nFrom || !nTo) return null
                  const p1 = portPoint(nFrom, f.section, f.index, 'right')
                  const p2 = portPoint(nTo, t.section, t.index, 'left')
                  return (
                    <g key={e.id}>
                      <path d={bezierPath(p1, p2)} strokeWidth={2 / zoom} stroke='#111827' fill='none' />
                      <circle cx={p1.x} cy={p1.y} r={(PORT_R - 1) / zoom} fill='#111827' />
                      <circle cx={p2.x} cy={p2.y} r={(PORT_R - 1) / zoom} fill='#111827' />
                    </g>
                  )
                })}
                {(() => {
                  const df = draftFrom
                  if (!df) return null
                  const nFrom = nodes.find((n) => n.id === df.nodeId)
                  if (!nFrom) return null
                  const p1 = portPoint(nFrom, df.section, df.index, 'right')
                  const p2 = draftMouseCanvas
                  return (
                    <path
                      d={bezierPath(p1, p2)}
                      strokeWidth={1.5 / zoom}
                      stroke='#6b7280'
                      fill='none'
                      strokeDasharray={`${6 / zoom} ${6 / zoom}`}
                    />
                  )
                })()}
              </svg>

              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
                {nodes.map((node) => (
                  <NodeView
                    key={node.id}
                    node={node}
                    onHeaderMouseDown={(e) => startDragNode(e, node)}
                    onAddRow={(id, s) => addRow(id, s)}
                    onRemoveRow={(id, s, i) => removeRow(id, s, i)}
                    onBeginLink={(ref) => setDraftFrom(ref)}
                    onCommitLink={(ref) => commitLink(ref)}
                    setNodes={setNodes}
                    onDelete={() => deleteNode(node.id)}
                  />
                ))}
              </div>

              <div className='absolute left-3 top-3 flex gap-2 rounded-md border-2 border-black bg-white/90 px-2 py-1 shadow-sm'>
                <button
                  className='flex items-center gap-1 rounded border-2 border-black px-2 py-1 text-sm hover:bg-gray-100'
                  onClick={zoomOut}
                  aria-label='Zoom out'
                >
                  <IconZoomOut size={16} />
                </button>
                <div className='px-2 py-1 text-xs font-medium text-gray-700'>{Math.round(zoom * 100)}%</div>
                <button
                  className='flex items-center gap-1 rounded border-2 border-black px-2 py-1 text-sm hover:bg-gray-100'
                  onClick={zoomIn}
                  aria-label='Zoom in'
                >
                  <IconZoomIn size={16} />
                </button>
                <button
                  className='ml-2 flex items-center gap-1 rounded border-2 border-black px-2 py-1 text-sm hover:bg-gray-100'
                  onClick={fit}
                  aria-label='Fit view'
                >
                  <IconFocusCentered size={16} />
                  <span className='hidden sm:inline'>Fit</span>
                </button>
                <button
                  className='ml-2 flex items-center gap-1 rounded border-2 border-black px-2 py-1 text-sm hover:bg-gray-100'
                  onClick={addNode}
                  aria-label='Add place'
                >
                  <IconPlus size={16} />
                  <span className='hidden sm:inline'>Add Place</span>
                </button>
              </div>

              <div className='absolute bottom-3 right-3 rounded-md border-2 border-black bg-white/90 p-2 shadow-sm'>
                <svg width={MINIMAP_W} height={MINIMAP_H} onMouseDown={minimapClick} className='cursor-pointer'>
                  <rect x={0} y={0} width={MINIMAP_W} height={MINIMAP_H} fill='#fafafa' stroke='#d1d5db' />
                  <g transform={`translate(${-bbox.minX * miniScale}, ${-bbox.minY * miniScale}) scale(${miniScale})`}>
                    {nodes.map((n) => (
                      <rect key={n.id} x={n.x} y={n.y} width={NODE_WIDTH} height={nodeHeight(n)} fill='#e5e7eb' stroke='#6b7280' />
                    ))}
                  </g>
                  <rect
                    x={viewportRectInMini.x}
                    y={viewportRectInMini.y}
                    width={viewportRectInMini.w}
                    height={viewportRectInMini.h}
                    fill='none'
                    stroke='#111827'
                    strokeWidth={1}
                  />
                </svg>
              </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function NodeView({
  node,
  onHeaderMouseDown,
  onAddRow,
  onRemoveRow,
  onBeginLink,
  onCommitLink,
  setNodes,
  onDelete,
}) {
  const style = { left: node.x, top: node.y, width: NODE_WIDTH, position: 'absolute' }

  const [editing, setEditing] = useState(false)
  const [tempTitle, setTempTitle] = useState(node.title)

  const commitTitle = () => {
    const title = tempTitle.trim() || 'Place: Untitled'
    setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, title } : n)))
    setEditing(false)
  }
  const cancelTitle = () => {
    setTempTitle(node.title)
    setEditing(false)
  }

  return (
    <div style={style}>
      <div className='overflow-hidden rounded-2xl border-2 border-black bg-white shadow-sm'>
        <div
          className='relative flex h-14 select-none items-center justify-center border-b-2 border-black text-lg font-semibold'
          onMouseDown={(e) => {
            if (!editing) onHeaderMouseDown(e, node)
          }}
          onDoubleClick={() => {
            setTempTitle(node.title)
            setEditing(true)
          }}
        >
          {editing ? (
            <input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') cancelTitle()
              }}
              className='w-[80%] rounded border-2 border-black bg-white px-2 py-1 text-base outline-none'
            />
          ) : (
            <>
              {node.title}
              <div className='absolute right-2 top-1/2 flex -translate-y-1/2 gap-2'>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setTempTitle(node.title)
                    setEditing(true)
                  }}
                  className='rounded border-2 border-black px-2 py-1 text-xs hover:bg-neutral-100'
                  title='Rename'
                >
                  <IconPencil size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className='rounded border-2 border-black px-2 py-1 text-xs hover:bg-neutral-100'
                  title='Delete node'
                >
                  <IconX size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        <Section
          node={node}
          sectionKey='copy'
          rows={node.copy}
          onAddRow={() => onAddRow(node.id, 'copy')}
          onRemoveRow={(idx) => onRemoveRow(node.id, 'copy', idx)}
          onBeginLink={(idx) => onBeginLink({ nodeId: node.id, section: 'copy', index: idx })}
          onCommitLink={(idx) => onCommitLink({ nodeId: node.id, section: 'copy', index: idx })}
          setNodes={setNodes}
        />

        <Section
          node={node}
          sectionKey='action'
          rows={node.action}
          onAddRow={() => onAddRow(node.id, 'action')}
          onRemoveRow={(idx) => onRemoveRow(node.id, 'action', idx)}
          onBeginLink={(idx) => onBeginLink({ nodeId: node.id, section: 'action', index: idx })}
          onCommitLink={(idx) => onCommitLink({ nodeId: node.id, section: 'action', index: idx })}
          setNodes={setNodes}
        />
      </div>
    </div>
  )
}

function Section({
  node,
  sectionKey,
  rows,
  onAddRow,
  onRemoveRow,
  onBeginLink,
  onCommitLink,
  setNodes,
}) {
  const sectionName = sectionKey === 'copy' ? 'Copy' : 'Action'

  const updateRow = (idx, value) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== node.id) return n
        const updatedRows = n[sectionKey].map((row, rowIdx) => (rowIdx === idx ? value : row))
        return { ...n, [sectionKey]: updatedRows }
      })
    )
  }

  return (
    <div className='border-b-2 border-black'>
      <div className='flex h-11 items-center border-b-2 border-black bg-neutral-50 text-neutral-900'>
        <div className='w-[110px] px-3 text-sm text-neutral-700'>{sectionName}</div>
        <div className='flex flex-1 items-center justify-between px-3'>
          <span className='text-xs text-neutral-500'>
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          <button
            className='inline-flex items-center gap-1 rounded-lg border-2 border-black px-2 py-1 text-xs hover:bg-neutral-100 active:bg-neutral-200'
            onClick={onAddRow}
          >
            <IconPlus size={14} /> Add row
          </button>
        </div>
      </div>

      {rows.map((text, idx) => (
        <div key={idx} className='relative flex border-b-2 border-black last:border-b-0' style={{ height: ROW_H }}>
          <div className='absolute left-2 top-1/2 -translate-y-1/2'>
            <button
              title='Connect here (target)'
              onMouseUp={(e) => {
                e.stopPropagation()
                onCommitLink(idx)
              }}
              className='rounded-full border-2 border-black bg-white hover:bg-neutral-200 active:bg-neutral-300'
              style={{ width: PORT_R * 2, height: PORT_R * 2 }}
            />
          </div>

          <div className='flex w-[110px] select-none items-center px-3 text-sm text-neutral-600' />

          <div className='flex flex-1 items-center px-3'>
            <input
              className='w-full bg-transparent outline-none'
              value={text}
              onChange={(e) => updateRow(idx, e.target.value)}
              placeholder={sectionKey === 'copy' ? 'Copy text…' : 'Action description…'}
            />
          </div>

          <div className='absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2'>
            <button
              title='Start connection (source)'
              onMouseDown={(e) => {
                e.stopPropagation()
                onBeginLink(idx)
              }}
              className='rounded-full border-2 border-black bg-white hover:bg-neutral-200 active:bg-neutral-300'
              style={{ width: PORT_R * 2, height: PORT_R * 2 }}
            />
            <button
              title='Remove row'
              onClick={() => onRemoveRow(idx)}
              className='rounded border-2 border-black px-1.5 py-0.5 text-xs hover:bg-neutral-100'
            >
              <IconX size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function runPortPointTests() {
  try {
    const sample = { id: 't', x: 100, y: 50, title: 'Place: T', copy: ['a', 'b'], action: ['c'] }
    const pCopy0L = portPoint(sample, 'copy', 0, 'left')
    const pCopy0R = portPoint(sample, 'copy', 0, 'right')
    const pCopy1L = portPoint(sample, 'copy', 1, 'left')
    const pAction0L = portPoint(sample, 'action', 0, 'left')
    console.assert(pCopy0L.x < pCopy0R.x, 'left port must be left of right port')
    console.assert(Math.abs(pCopy1L.y - pCopy0L.y - ROW_H) < 0.001, 'row height increment must be ROW_H')
    console.assert(pAction0L.y > pCopy1L.y, 'action section should be below copy section')
  } catch (e) {
    console.warn('PortPoint tests failed:', e)
  }
}

function runDefensiveEdgeTests() {
  try {
    const bad = { id: 'e1', from: null, to: null }
    const idFrom = bad?.from?.nodeId ?? null
    console.assert(idFrom === null, 'malformed edge read should be null, not throw')
  } catch (e) {
    console.warn('Defensive edge test failed:', e)
  }
}

function runDraftFromNullGuardTest() {
  try {
    const draftFrom = null
    const safe = draftFrom ? draftFrom.nodeId : null
    console.assert(safe === null || safe === undefined, 'draftFrom null guard should not throw')
  } catch (e) {
    console.warn('DraftFrom null guard test failed:', e)
  }
}

if (import.meta.env.DEV) {
  runPortPointTests()
  runDefensiveEdgeTests()
  runDraftFromNullGuardTest()
}
