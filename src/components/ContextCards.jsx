import React, { useState, useMemo, useRef, useCallback } from 'react'
import { IconCopy, IconSearch, IconChevronDown } from '@tabler/icons-react'

// --- DATA ---
const CARDS = [
  { id: 'poisoning-write', mode: 'Poisoning', lever: 'Write', front: "Keep the AI's memory clean and prevent it from remembering wrong things.", back: [
    'Check every new piece of information before saving it. Make sure you know where it came from and that it\'s reliable.',
    "Don't let the AI save its rough drafts or guesses as facts. Keep messy thinking separate from official memory.",
    "Create a \"paper trail\" for all information, so if something goes wrong, you can easily find the source of the bad info.",
  ] },
  { id: 'poisoning-select', mode: 'Poisoning', lever: 'Select', front: 'Be skeptical of new information the AI finds.', back: [
    'Scan information found online for hidden instructions that could trick the AI. Only trust info from approved sources.',
    'Label where each piece of information came from. Show the AI the source as plain text, not a command it might accidentally follow.',
    "Have a \"fact-checker\" step. Only information that passes this check can be added to the AI's long-term memory.",
  ] },
  { id: 'poisoning-compress', mode: 'Poisoning', lever: 'Compress', front: 'When summarizing, always go back to the original, trusted facts.', back: [
    'Avoid making summaries of other summaries, which can distort the truth like a game of telephone. Re-summarize from the original sources regularly.',
    "Instead of just cutting off old information, intelligently remove what's least important or outdated.",
    "Tag every summarized fact with its original source, so you know if the source has been updated or is no longer valid.",
  ] },
  { id: 'poisoning-isolate', mode: 'Poisoning', lever: 'Isolate', front: "Use separate \"specialist\" AIs to handle untrusted information.", back: [
    "Have one AI \"Reader\" that browses online, and a separate \"Verifier\" AI that fact-checks. Only the Verifier can save things to memory.",
    "A third \"Writer\" AI can then use these verified facts to talk to users.",
    "If the Verifier isn't sure about something, it should stop and ask a human for help instead of guessing.",
  ] },
  { id: 'distraction-write', mode: 'Distraction', lever: 'Write', front: "Help the AI focus by keeping its \"workspace\" tidy.", back: [
    "Don't clutter the AI's short-term memory with long, boring logs. Store the full details elsewhere and just give the AI a short summary.",
    "Important decisions or goals should be saved in a special, organized memory. Casual chit-chat shouldn't be.",
  ] },
  { id: 'distraction-select', mode: 'Distraction', lever: 'Select', front: "Don't overwhelm the AI with too much information at once.", back: [
    'Limit how much information you give the AI. Pick only the most relevant and recent things.',
    'Put the most important facts at the very beginning and very end of the information you provide. AIs can sometimes miss things in the middle.',
    'Clear out old, irrelevant conversation history. A summary of the last couple of messages is usually enough.',
  ] },
  { id: 'distraction-compress', mode: 'Distraction', lever: 'Compress', front: 'Create a running summary of the conversation.', back: [
    'Every few turns in a conversation, create a simple summary: What facts have we learned? What decisions were made? What questions are still open?',
    'Use this clean summary instead of the messy, full conversation history to guide the AI.',
    'After many turns, create a fresh summary from the original conversation to make sure nothing important was lost.',
  ] },
  { id: 'distraction-isolate', mode: 'Distraction', lever: 'Isolate', front: 'Break down big problems into smaller tasks for different AIs.', back: [
    'Instead of one AI trying to do everything, use a team of specialists (e.g., one for rules, one for orders, one for writing replies).',
    "A \"manager\" AI then collects the simple, final answers from each specialist.",
    "It's better to have several AIs work on small tasks at the same time than one AI struggling with a giant one.",
  ] },
  { id: 'confusion-write', mode: 'Confusion', lever: 'Write', front: "Keep the AI's \"tool manual\" clear and organized.", back: [
    "Have a neat \"toolbox\" where each tool's instructions are clear with examples. Only give the AI the manual for the specific tool it needs right now.",
    'Include clear rules for when and how to use each tool, so the AI does not make simple mistakes.',
  ] },
  { id: 'confusion-select', mode: 'Confusion', lever: 'Select', front: 'Give the AI only the few tools it needs for the job.', back: [
    "Instead of showing the AI a huge catalog of 50 tools, figure out what it's trying to do and just give it the 1-3 most relevant ones.",
    'Make the AI check that it has all the necessary information (like an order number) before it tries to use a tool.',
    'Use a simple router AI to first decide which type of tool is needed, then provide that specific tool\'s instructions.',
  ] },
  { id: 'confusion-compress', mode: 'Confusion', lever: 'Compress', front: 'Make tool instructions short and sweet.', back: [
    "For the AI's quick reference, only show the tool's name, its purpose, what information it needs, and one simple example.",
    "Provide a link to the full, detailed manual, but don't force the AI to read it unless necessary. Keep instructions easy to scan.",
  ] },
  { id: 'confusion-isolate', mode: 'Confusion', lever: 'Isolate', front: "Have a special \"Tool Expert\" AI to handle all tool-related tasks.", back: [
    "This expert AI's only job is to pick and use tools. It then hands back a simple, clean result (e.g., \"Refund Approved\").",
    "A separate \"Writer\" AI then uses this clean result to write a reply to the user. This prevents the AI from getting mixed up.",
  ] },
  { id: 'clash-write', mode: 'Clash', lever: 'Write', front: 'When rules change, make sure the AI knows which one is the newest.', back: [
    'When you save a rule or fact, label it with a version number. When a rule is updated, clearly mark the old one as outdated.',
    'Tell the AI to always use the newest version of a rule by default.',
    'Keep a record of where rules came from, so you can explain why one rule overrules another.',
  ] },
  { id: 'clash-select', mode: 'Clash', lever: 'Select', front: 'Spot conflicting information before giving it to the AI.', back: [
    'Before giving information to the AI, check for duplicates or outdated versions and remove them.',
    'If two pieces of information still conflict, point it out to the AI and ask it to make a decision or ask a human for help.',
    "Send conflicting rules to a human or a special \"Rule Expert\" AI to sort out.",
  ] },
  { id: 'clash-compress', mode: 'Clash', lever: 'Compress', front: 'Summarize information in a way that highlights disagreements.', back: [
    "In summaries, have a separate list for \"proven facts\" and \"assumptions\". Note the source for each point.",
    "If two sources disagree, the summary should include a special note like: \"Warning: Conflicting information found.\"",
  ] },
  { id: 'clash-isolate', mode: 'Clash', lever: 'Isolate', front: 'Have separate AIs for understanding rules and for taking action.', back: [
    "Have a \"Rule Expert\" AI that only reads the rulebook. Have an \"Operations\" AI that only uses tools to check live data (like order statuses).",
    "Only the \"Writer\" AI sees the final answers from both and uses the official rules to decide what to do.",
  ] },
  { id: 'monitoring', mode: 'Monitoring', lever: 'Global', front: "Watch the AI's \"thought process\", not just its final answers.", back: [
    "Track what information the AI is using at every step to make sure it's not getting overloaded or distracted.",
    'Test the AI with long, multi-step conversations. A single correct answer does not prove it truly understands and will not get lost later.',
    "Follow basic online safety: treat all incoming info as untrustworthy, and double-check the AI's work before it takes real-world actions.",
  ] },
  { id: 'defaults', mode: 'Defaults', lever: 'Global', front: 'A good starting setup for a helpful assistant AI.', back: [
    "Memory: Don't save info without knowing where it came from. Don't let the AI's \"rough drafts\" become facts.",
    'Information: Give it the 3-4 most relevant search results. Keep info chunks small. Put the most important sentence at the top or bottom.',
    "Tools: Only give it the 1-3 tools it needs for the current task, with very simple instructions.",
    'Focus: Summarize the conversation every 5-8 turns. Keep the last two messages plus the new summary.',
    'Safety: Use a team of specialist AIs (Rules, Actions, Writer). If rules conflict, ask a human.',
  ] },
]

const UI_STRINGS = {
  title: 'Context Cards',
  subtitle: 'Tactics for mitigating the four context failure modes across four key levers.',
  searchPlaceholder: 'Search cards...',
  failureModeLabel: 'Failure Mode:',
  leversLabel: 'Levers:',
  cardsShown: (count) => `${count} card${count !== 1 ? 's' : ''} shown`,
  copy: 'Copy',
  copyJson: 'Copy JSON',
  copied: 'Copied!',
  noCardsTitle: 'No cards match your filters.',
  noCardsSubtitle: 'Try adjusting your search or filter selection.',
  modes: ['All', 'Poisoning', 'Distraction', 'Confusion', 'Clash'],
  levers: ['Write', 'Select', 'Compress', 'Isolate'],
}

// Clipboard helper (uses modern API with fallback)
const copyToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

const FlipCard = ({ card }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const bodyRef = useRef(null)

  const handleCopy = useCallback(async () => {
    try {
      await copyToClipboard(card.back.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      // swallow
    }
  }, [card.back])

  return (
    <div className="bg-white border-2 border-black rounded-xl shadow-md overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full text-left p-4 flex justify-between items-start gap-4"
      >
        <div className="flex-1">
          <span className="inline-flex items-center rounded-lg px-2 py-1 mb-2 text-xs font-medium border-2 border-black">
            {card.lever}
          </span>
          <p className={`text-lg font-semibold text-black ${!isOpen ? 'line-clamp-2' : ''}`}>{card.front}</p>
        </div>
        <IconChevronDown size={20} className={`text-gray-700 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div
        ref={bodyRef}
        style={{ maxHeight: isOpen ? `${bodyRef.current?.scrollHeight || 0}px` : '0px' }}
        className="transition-[max-height] duration-300 ease-in-out"
      >
        <div className="px-4 pb-4 pt-2 border-t-2 border-black">
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            {card.back.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100"
            >
              <IconCopy size={16} />
              <span>{copied ? UI_STRINGS.copied : UI_STRINGS.copy}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Controls = ({ modeFilter, setModeFilter, leverFilter, setLeverFilter, searchQuery, setSearchQuery, filteredCards }) => {
  const [copied, setCopied] = useState(false)

  const toggleLever = (lever) => {
    setLeverFilter((prev) => (prev.includes(lever) ? prev.filter((l) => l !== lever) : [...prev, lever]))
  }

  const handleCopyJson = useCallback(async () => {
    try {
      await copyToClipboard(JSON.stringify(filteredCards, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      // swallow
    }
  }, [filteredCards])

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
          <IconSearch size={18} />
        </div>
        <input
          type="search"
          placeholder={UI_STRINGS.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-black rounded-lg py-2 pl-10 pr-3 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 mr-1">{UI_STRINGS.failureModeLabel}</span>
          {UI_STRINGS.modes.map((mode) => (
            <button
              key={mode}
              onClick={() => setModeFilter(mode)}
              className={
                modeFilter === mode
                  ? 'px-3 py-1 text-sm rounded-lg bg-black text-white border-2 border-black'
                  : 'px-3 py-1 text-sm rounded-lg bg-white text-black border-2 border-black hover:bg-gray-100'
              }
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 mr-1">{UI_STRINGS.leversLabel}</span>
          {UI_STRINGS.levers.map((lever) => {
            const active = leverFilter.includes(lever)
            return (
              <button
                key={lever}
                onClick={() => toggleLever(lever)}
                className={
                  active
                    ? 'px-3 py-1 text-sm rounded-lg bg-black text-white border-2 border-black'
                    : 'px-3 py-1 text-sm rounded-lg bg-white text-black border-2 border-black hover:bg-gray-100'
                }
              >
                {lever}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t-2 border-black">
        <span className="text-sm text-gray-700">{UI_STRINGS.cardsShown(filteredCards.length)}</span>
        <button
          onClick={handleCopyJson}
          className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100"
        >
          <IconCopy size={16} />
          <span>{copied ? UI_STRINGS.copied : UI_STRINGS.copyJson}</span>
        </button>
      </div>
    </div>
  )
}

export default function ContextCards() {
  const [modeFilter, setModeFilter] = useState('All')
  const [leverFilter, setLeverFilter] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCards = useMemo(() => {
    let cards = CARDS
    if (modeFilter !== 'All') cards = cards.filter((c) => c.mode === modeFilter)
    if (leverFilter.length > 0) cards = cards.filter((c) => leverFilter.includes(c.lever))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      cards = cards.filter((c) => c.front.toLowerCase().includes(q) || c.back.some((b) => b.toLowerCase().includes(q)))
    }
    if (leverFilter.length > 0) cards = cards.filter((c) => c.mode !== 'Monitoring' && c.mode !== 'Defaults')
    return cards
  }, [modeFilter, leverFilter, searchQuery])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold">{UI_STRINGS.title}</h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">{UI_STRINGS.subtitle}</p>
        </header>

        <div className="mb-8 p-4 bg-white border-2 border-black rounded-xl shadow-sm">
          <Controls
            modeFilter={modeFilter}
            setModeFilter={setModeFilter}
            leverFilter={leverFilter}
            setLeverFilter={setLeverFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredCards={filteredCards}
          />
        </div>

        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {filteredCards.map((card) => (
              <FlipCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-xl font-semibold">{UI_STRINGS.noCardsTitle}</h3>
            <p className="text-gray-600 mt-2">{UI_STRINGS.noCardsSubtitle}</p>
          </div>
        )}
      </div>
    </div>
  )
}
