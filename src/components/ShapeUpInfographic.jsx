import React from 'react'
import {
  IconClock,
  IconScissors,
  IconTarget,
  IconUserCog,
  IconLayersLinked,
  IconShieldCheck,
  IconFileText,
  IconAlertTriangle,
  IconHammer,
  IconCalendarCheck,
  IconCircleCheck,
  IconCircleOff,
  IconChartLine,
  IconBook,
} from '@tabler/icons-react'

// One-page, printable infographic summarizing Basecamp's Shape Up
// - TailwindCSS
// - Clean grid layout, minimal icons, presentation-friendly
// - A4-ish canvas with padding; prints neatly
// - Includes a talk track on the right to guide a presentation

export default function ShapeUpInfographic() {
  return (
    <div className='min-h-screen w-full bg-white text-gray-900 antialiased'>
      <div className='max-w-5xl mx-auto p-6 md:p-10 print:p-6'>
        <header className='flex items-start justify-between gap-6 border-b pb-4'>
          <div>
            <h1 className='text-3xl md:text-4xl font-semibold tracking-tight'>Shape Up — Basecamp</h1>
            <p className='text-sm md:text-base text-gray-600 mt-2 max-w-2xl'>
              A product development approach with <em>fixed time, variable scope</em>. Focus on shaping problems, betting on solutions, and keeping builders focused during the cycle. Read the full book at{' '}
              <a href='https://basecamp.com/shapeup' target='_blank' rel='noopener noreferrer' className='underline text-black hover:text-gray-700'>
                basecamp.com/shapeup
              </a>
              .
            </p>
          </div>
          {/* Right-side badge removed as requested */}
        </header>

        <main className='mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <section className='lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6'>
            <Card
              title='TL;DR: Core Principles'
              icon={<IconTarget size={18} stroke={2} />}
              items={[
                ['Fixed time, variable scope', 'Cycles are time-capped. Scope flexes, not time.'],
                ['Appetite over estimate', 'Choose a time appetite (2 or 6 weeks) instead of estimating duration.'],
                ['Shaping before building', 'Shape the problem and constraints before placing a bet.'],
                ['Betting table', 'Make explicit commitments for the next cycle.'],
                ['No backlog', 'Do not hoard ideas. Good ideas will come back.'],
              ]}
            />

            <Card
              title='Roles & Responsibilities'
              icon={<IconUserCog size={18} stroke={2} />}
              items={[
                ['Shapers', 'Define the problem and a conceptual solution (PM, senior dev/designer).'],
                ['Betters', 'Decision-makers at the betting table (exec/lead).'],
                ['Builders', 'A small team (designer + programmer) executes with high autonomy.'],
                ['Strategic gatekeepers', 'Protect focus, cut scope, and block interruptions during the cycle.'],
              ]}
            />

            <Card title='Work Cycle' icon={<IconClock size={18} stroke={2} />} customContent={<Cycle />} />

            <Card
              title='Shaping — Output: Pitch'
              icon={<IconFileText size={18} stroke={2} />}
              items={[
                ['Clear problem', 'What is the pain? Who is the user?'],
                ['Appetite', 'How much time is worth spending? (2/6 weeks).'],
                ['Solution outline', 'Rough UI/flow — enough to convey intent, not pixel details.'],
                ['Rabbit holes & risks', 'Anticipate product/technical traps and how to avoid them.'],
                ['No to-dos', 'Avoid detailed task lists at the shaping stage.'],
              ]}
            />

            <Card
              title='Betting Table'
              icon={<IconLayersLinked size={18} stroke={2} />}
              items={[
                ['Hard commitments', 'Choose pitches to work on in the next cycle.'],
                ['Time budget', 'Appetite = timebox. No default extensions.'],
                ['Kill switch', 'If it is not promising, stop; do not endlessly patch.'],
                ['Few, clear bets', 'Fewer focused initiatives beat many half-finished projects.'],
              ]}
            />

            <Card
              title='Build Track — Execution'
              icon={<IconHammer size={18} stroke={2} />}
              items={[
                ['Scope cuts', 'Trim edge features to protect the timebox.'],
                ['Small team', 'One designer + one/two programmers for speed and direct comms.'],
                ['No daily standups', 'Use written updates and real working artifacts.'],
                ['Continuous integration', 'Build end-to-end slices, not isolated parts.'],
              ]}
            />

            <Card title='Hill Chart — Progress Tracking' icon={<IconChartLine size={18} stroke={2} />} customContent={<HillChartMini />} />

            <Card
              title='Anti‑Patterns'
              icon={<IconAlertTriangle size={18} stroke={2} />}
              items={[
                ['Backlog-driven', 'Chasing endless lists instead of well-shaped value.'],
                ['Scope fixed, time flexible', 'Opposite of Shape Up; leads to slips and burnout.'],
                ['Estimation gymnastics', 'Time spent estimating instead of solving.'],
                ['Over‑spec', 'Pitch morphs into a giant PRD, killing flexibility.'],
              ]}
            />

            <Card
              title='Key Definitions'
              icon={<IconBook size={18} stroke={2} />}
              items={[
                ['Appetite', (<span>The intentionally chosen time budget for a problem.</span>)],
                ['Shaping', 'Defining the problem, constraints, and a solution outline.'],
                ['Pitch', 'A concise document from shaping to bet on.'],
                ['Betting table', 'The forum where pitches are selected for the cycle.'],
              ]}
            />
          </section>

          <aside className='lg:col-span-1'>
            <div className='rounded-2xl border-2 border-black shadow-sm p-4 md:p-5 bg-gray-50'>
              <h3 className='text-lg font-semibold flex items-center gap-2'>
                <IconShieldCheck size={18} stroke={2} /> Talk Track (Presentation Guide)
              </h3>
              <ol className='mt-3 space-y-3 text-sm leading-relaxed list-decimal pl-5'>
                <li>
                  <b>Common pains:</b> overflowing backlogs, slipping estimates, scope creep. Shape Up reframes with <em>appetite</em>.
                </li>
                <li>
                  <b>Principle:</b> time is fixed. To finish, cut scope — do not add time.
                </li>
                <li>
                  <b>Shape first:</b> define the problem and outline the solution. Produce a mature <em>pitch</em>.
                </li>
                <li>
                  <b>Betting table:</b> pick a few best bets each cycle. No automatic extensions.
                </li>
                <li>
                  <b>Execution:</b> small team, end-to-end integration, rely on <em>scope cuts</em>.
                </li>
                <li>
                  <b>Tracking:</b> use a Hill Chart: <em>discover → build → ship</em>.
                </li>
                <li>
                  <b>Close:</b> fixed time, variable scope gets teams shipping again.
                </li>
              </ol>

              <div className='mt-4 grid grid-cols-2 gap-3 text-xs'>
                <Badge icon={<IconCalendarCheck size={16} stroke={2} />} label='6+2 week cadence' />
                <Badge icon={<IconScissors size={16} stroke={2} />} label='Scope cuts > overtime' />
                <Badge icon={<IconCircleCheck size={16} stroke={2} />} label='Fewer bets, more focus' />
                <Badge icon={<IconCircleOff size={16} stroke={2} />} label='No long backlog' />
              </div>

              <div className='mt-5 border-t pt-4 text-xs text-gray-600'>
                <p>
                  <b>Visual tips:</b> Show a one‑page pitch, a weekly Hill Chart, and real <em>scope cuts</em>.
                </p>
              </div>
            </div>

            <div className='mt-6 rounded-2xl border-2 border-black p-4 bg-white'>
              <h4 className='font-semibold text-sm'>Mini‑Implementation Checklist</h4>
              <ul className='mt-2 text-xs space-y-2 list-disc pl-4'>
                <li>Set an appetite (2 or 6 weeks) per initiative.</li>
                <li>Train the team to shape and write one‑page pitches.</li>
                <li>Schedule a <em>betting table</em> before each cycle.</li>
                <li>During build: protect focus; share progress via artifacts.</li>
                <li>After: keep what works; stop what does not.</li>
              </ul>
            </div>

            <Flashcards />
          </aside>
          
          {/* Right column additions continue below */}
        </main>

        <footer className='mt-8 pt-4 border-t text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2'>
          <p>Reference summary based on the book/essay "Shape Up" by Basecamp (Jason Fried & Ryan Singer).</p>
          <p className='opacity-80'>One‑page infographic • Prints well on A4 • v1.0</p>
        </footer>
      </div>
    </div>
  )
}

function Card({ title, icon, items, customContent }) {
  return (
    <article className='rounded-2xl border-2 border-black shadow-sm p-4 md:p-5 bg-white'>
      <div className='flex items-center gap-2 mb-3'>
        {icon}
        <h3 className='font-semibold text-base md:text-lg'>{title}</h3>
      </div>
      {Array.isArray(items) && (
        <ul className='space-y-2 text-sm'>
          {items.map(([k, v], i) => (
            <li key={i} className='grid grid-cols-[140px,1fr] gap-3'>
              <div className='text-gray-600'>{k}</div>
              <div>{v}</div>
            </li>
          ))}
        </ul>
      )}
      {customContent}
    </article>
  )
}

function Badge({ icon, label }) {
  return (
    <div className='inline-flex items-center gap-2 rounded-xl border-2 border-black px-2.5 py-1.5 bg-white'>
      {icon}
      <span>{label}</span>
    </div>
  )
}

function Cycle() {
  return (
    <section aria-label='Cycle timeline'>
      <div className='text-sm text-gray-700 mb-2'>6 weeks build + 2 weeks cool‑down</div>
      <div className='flex items-center gap-2'>
        {[...Array(6)].map((_, i) => (
          <div key={i} className='flex-1'>
            <div className='h-3 rounded-full bg-gray-900' />
            <div className='text-[10px] text-center mt-1'>W{i + 1}</div>
          </div>
        ))}
        <div className='w-20'>
          <div className='h-3 rounded-full bg-gray-300' />
          <div className='text-[10px] text-center mt-1'>Cool‑down</div>
        </div>
      </div>
      <ul className='mt-3 text-xs text-gray-700 space-y-1 list-disc pl-4'>
        <li>Shaping and betting happen before a new cycle.</li>
        <li>No automatic extensions; stop or place a new bet.</li>
      </ul>
    </section>
  )
}

function HillChartMini() {
  return (
    <section className='mt-1' aria-label='Hill chart illustration'>
      <div className='h-24 relative'>
        <div className='absolute inset-x-0 bottom-0 h-1 bg-gray-200 rounded-full' />
        <svg viewBox='0 0 400 140' className='absolute inset-0 w-full h-full' role='img' aria-label='Hill with four work items'>
          <path d='M10 120 Q 200 10 390 120' fill='none' stroke='#111827' strokeWidth='3' />
          <circle cx='90' cy='85' r='5' fill='#111827' />
          <circle cx='170' cy='55' r='5' fill='#111827' />
          <circle cx='240' cy='70' r='5' fill='#111827' />
          <circle cx='310' cy='98' r='5' fill='#111827' />
        </svg>
      </div>
      <div className='grid grid-cols-3 text-[11px] text-gray-700 mt-1'>
        <div>Here we are still figuring it out</div>
        <div className='text-center'>Peak</div>
        <div className='text-right'>Here we are confident; just execution</div>
      </div>
    </section>
  )
}

// Flashcards — concise Q/A to reinforce key Shape Up concepts
function Flashcards() {
  const cards = [
    { q: 'What is Shape Up?', a: 'Basecamp’s approach: fixed time, variable scope; shape → bet → build.' },
    { q: 'What is an appetite?', a: 'A chosen time budget (often 2 or 6 weeks) for a problem.' },
    { q: 'Why appetite over estimates?', a: 'Forces constraints, reduces wasteful estimation, and drives scope trade‑offs.' },
    { q: 'What is shaping?', a: 'Define problem, constraints, solution outline; identify rabbit holes and risks.' },
    { q: 'What is a pitch?', a: 'A concise document from shaping used at the betting table.' },
    { q: 'What is the betting table?', a: 'Decision forum where leaders select pitches for the next cycle.' },
    { q: 'What is a cycle?', a: 'Typically 6 weeks of building followed by ~2 weeks of cool‑down.' },
    { q: 'Who are shapers?', a: 'Senior folks (PM, designer, programmer) shaping problems and solutions.' },
    { q: 'Who are builders?', a: 'A small autonomous team (designer + 1–2 programmers) executing the work.' },
    { q: 'What are scope cuts?', a: 'Trimming non‑essential edges to protect the timebox and ship.' },
    { q: 'What is a Hill Chart?', a: 'A way to track work from unknowns (uphill) to execution (downhill).' },
    { q: 'Why no backlog?', a: 'Avoid hoarding ideas; strong ideas resurface when appetite appears.' },
    { q: 'What is the kill switch?', a: 'Stop unpromising work instead of extending timeboxes by default.' },
    { q: 'What is cool‑down for?', a: 'Cleanup, small fixes, shaping, and regrouping between cycles.' },
  ]

  const [index, setIndex] = React.useState(0)
  const [flipped, setFlipped] = React.useState(false)
  const [order, setOrder] = React.useState(cards.map((_, i) => i))

  const current = cards[order[index]]

  const next = () => {
    setIndex((i) => (i + 1) % order.length)
    setFlipped(false)
  }
  const prev = () => {
    setIndex((i) => (i - 1 + order.length) % order.length)
    setFlipped(false)
  }
  const flip = () => setFlipped((f) => !f)
  const shuffle = () => {
    const arr = [...order]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = arr[i]
      arr[i] = arr[j]
      arr[j] = t
    }
    setOrder(arr)
    setIndex(0)
    setFlipped(false)
  }

  return (
    <section className='mt-6 rounded-2xl border-2 border-black p-4 bg-white' aria-label='Shape Up flashcards'>
      <div className='flex items-center justify-between gap-2'>
        <h4 className='font-semibold text-sm'>Flashcards</h4>
        <div className='text-xs text-gray-600'>Card {index + 1} of {order.length}</div>
      </div>

      <button
        type='button'
        onClick={flip}
        className='w-full mt-3 rounded-xl border-2 border-black bg-gray-50 p-4 text-left focus:outline-none focus:ring-2 focus:ring-black'
        aria-pressed={flipped}
        aria-label='Flip card'
      >
        <div className='text-xs uppercase tracking-wide text-gray-600 mb-1'>{flipped ? 'Answer' : 'Question'}</div>
        <div className='text-sm md:text-base'>{flipped ? current.a : current.q}</div>
      </button>

      <div className='mt-3 flex items-center gap-2'>
        <button
          type='button'
          onClick={prev}
          className='inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black'
        >
          Prev
        </button>
        <button
          type='button'
          onClick={next}
          className='inline-flex items-center gap-2 bg-black text-white rounded-lg px-3 py-1 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black'
        >
          Next
        </button>
        <button
          type='button'
          onClick={shuffle}
          className='ml-auto inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black'
        >
          Shuffle
        </button>
        <button
          type='button'
          onClick={flip}
          className='inline-flex items-center gap-2 bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black'
        >
          Flip
        </button>
      </div>
    </section>
  )
}
