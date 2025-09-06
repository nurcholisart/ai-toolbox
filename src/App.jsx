import React, { useEffect, useMemo, useState } from 'react'
import { IconArrowLeft, IconSettings, IconInfoCircle } from '@tabler/icons-react'
import PdfToMarkdown from './components/PdfToMarkdown.jsx'
import AssessmentRoast from './components/AssessmentRoast.jsx'
import AudioTranscriber from './components/AudioTranscriber.jsx'
import Mp4ToMp3 from './components/Mp4ToMp3.jsx'
import Settings from './components/Settings.jsx'
import About from './components/About.jsx'
import { getApiKey } from './lib/config.js'

const tools = [
  { name: 'PDF to Markdown', description: 'Convert PDF content into Markdown', link: '#/pdf-to-markdown' },
  { name: 'Assessment Roast', description: 'Brutally review a project assessment', link: '#/assessment-roast' },
  { name: 'Audio Transcriber', description: 'Transcribe audio to Markdown', link: '#/audio-transcriber' },
  { name: 'MP4 to MP3', description: 'Convert video to MP3 in-browser', link: '#/mp4-to-mp3' },
  {
    name: 'Propose new tool',
    description: 'Suggest an idea on GitHub',
    link: 'https://github.com/nurcholisart/ai-toolbox',
    target: '_blank',
    muted: true,
  },
]

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  const [hasKey, setHasKey] = useState(!!getApiKey())

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    const onCfg = () => setHasKey(!!getApiKey())
    window.addEventListener('ai-toolbox:config-updated', onCfg)
    window.addEventListener('storage', onCfg)
    return () => window.removeEventListener('hashchange', onHashChange)
    // cleanup extra listeners
    // eslint-disable-next-line no-unreachable
    , window.removeEventListener('ai-toolbox:config-updated', onCfg)
    , window.removeEventListener('storage', onCfg)
  }, [])

  const isPdfTool = useMemo(() => hash === '#/pdf-to-markdown', [hash])
  const isRoastTool = useMemo(() => hash === '#/assessment-roast', [hash])
  const isAudioTool = useMemo(() => hash === '#/audio-transcriber', [hash])
  const isMp4ToMp3 = useMemo(() => hash === '#/mp4-to-mp3', [hash])
  const isSettings = useMemo(() => hash === '#/settings', [hash])
  const isAbout = useMemo(() => hash === '#/about', [hash])

  if (isPdfTool) {
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
        <PdfToMarkdown />
      </div>
    )
  }

  if (isRoastTool) {
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
        <AssessmentRoast />
      </div>
    )
  }

  if (isAudioTool) {
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
        <AudioTranscriber />
      </div>
    )
  }

  if (isMp4ToMp3) {
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
        <Mp4ToMp3 />
      </div>
    )
  }

  if (isSettings) {
    return <Settings />
  }

  if (isAbout) {
    return <About />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-2">AI Toolbox</h1>
      <p className="text-gray-600 mb-8">Your one-stop hub for powerful AI-driven tools</p>

      {!hasKey && (
        <div className="w-full max-w-6xl mb-6">
          <div className="flex items-start gap-3 border-2 border-black bg-white text-gray-900 rounded-xl p-3 shadow-sm">
            <svg className="h-5 w-5 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0V6.5zM10 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div className="text-sm">
              <p className="font-medium">Gemini API key not set.</p>
              <p>Open <a href="#/settings" className="underline text-black hover:text-gray-700">Settings</a> to add your key before using tools.</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl mb-6 flex justify-end gap-3">
        <a
          href="#/about"
          className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
        >
          <IconInfoCircle size={16} stroke={2} />
          About
        </a>
        <a
          href="#/settings"
          className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
        >
          <IconSettings size={16} stroke={2} />
          Edit Config
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl">
        {tools.map((tool, index) => {
          const isMuted = tool.muted
          const cardClass = isMuted
            ? 'border-2 border-dashed border-gray-400 rounded-xl p-4 bg-gray-50 text-gray-700 shadow-none hover:bg-gray-100 hover:shadow-sm transition duration-200 flex flex-col justify-between'
            : 'border-2 border-black rounded-xl p-4 bg-white shadow-md hover:shadow-xl transition duration-200 flex flex-col justify-between'
          const titleClass = isMuted ? 'font-semibold text-lg mb-2 text-gray-800' : 'font-semibold text-lg mb-2'
          const descClass = isMuted ? 'text-gray-600 text-sm' : 'text-gray-600 text-sm'
          return (
            <a
              key={index}
              href={tool.link}
              target={tool.target || undefined}
              rel={tool.target === '_blank' ? 'noopener noreferrer' : undefined}
              className={cardClass}
            >
              <h2 className={titleClass}>{tool.name}</h2>
              <p className={descClass}>{tool.description}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}
