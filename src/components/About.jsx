import React from 'react'
import { IconArrowLeft, IconInfoCircle, IconBrandGithub, IconSettings } from '@tabler/icons-react'
import InstallPrompt from './InstallPrompt.jsx'

export default function About() {
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
          <div className="flex items-center gap-2">
            <InstallPrompt />
            <a
              href="#/settings"
              className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
            >
              <IconSettings size={16} stroke={2} />
              Edit Config
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <IconInfoCircle size={28} stroke={2} />
            <h1 className="text-3xl font-bold text-gray-900">About This App</h1>
          </div>
          <p className="text-gray-600 mb-6">
            AI Toolbox is a lightweight, browser-first collection of utilities that help you work with AI and media.
            It uses a monochrome UI, keeps things local when possible, and favors simple, reliable workflows.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border-2 border-black rounded-xl p-4">
              <h2 className="font-semibold text-lg mb-2">What’s inside</h2>
              <ul className="list-disc pl-5 text-gray-700 space-y-1">
                <li>PDF to Markdown: extract text to clean Markdown</li>
                <li>Assessment Roast: critique assessments with structured feedback</li>
                <li>Audio Transcriber: transcribe audio to Markdown</li>
                <li>Meeting Transcription: upload audio/video → Markdown</li>
                <li>MP4 to MP3: in-browser media conversion via ffmpeg.wasm</li>
              </ul>
            </section>

            <section className="bg-white border-2 border-black rounded-xl p-4">
              <h2 className="font-semibold text-lg mb-2">How it works</h2>
              <ul className="list-disc pl-5 text-gray-700 space-y-1">
                <li>Built with React + Vite + Tailwind</li>
                <li>Monochrome UI with Tabler Icons</li>
                <li>Gemini API: your key is stored locally</li>
                <li>Media processing runs client-side when possible</li>
              </ul>
            </section>
          </div>

          <div className="mt-6">
            <h2 className="font-semibold text-lg mb-2">Privacy</h2>
            <p className="text-gray-700">
              Your API key is saved in your browser (localStorage). Tools send requests directly from your device to
              the Gemini API. Media conversions using ffmpeg.wasm run locally in your browser.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/nurcholisart/ai-toolbox"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white border-2 border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              <IconBrandGithub size={18} stroke={2} />
              View on GitHub
            </a>
            <a
              href="https://github.com/nurcholisart/ai-toolbox/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white border-2 border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              <IconBrandGithub size={18} stroke={2} />
              Report an issue
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
