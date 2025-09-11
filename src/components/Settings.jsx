import React, { useEffect, useState } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import {
  getGeminiApiKey,
  setGeminiApiKey,
  clearGeminiApiKey,
  getOpenAIApiKey,
  setOpenAIApiKey,
  clearOpenAIApiKey,
} from '../lib/config.js'
import InstallPrompt from './InstallPrompt.jsx'

export default function Settings() {
  const [geminiKey, setGeminiKeyState] = useState('')
  const [openaiKey, setOpenaiKeyState] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    setGeminiKeyState(getGeminiApiKey())
    setOpenaiKeyState(getOpenAIApiKey())
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    setGeminiApiKey(geminiKey.trim())
    setOpenAIApiKey(openaiKey.trim())
    setStatus('Saved')
    setTimeout(() => setStatus(''), 1500)
  }

  const handleClear = () => {
    clearGeminiApiKey()
    clearOpenAIApiKey()
    setGeminiKeyState('')
    setOpenaiKeyState('')
    setStatus('Cleared')
    setTimeout(() => setStatus(''), 1500)
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
          <InstallPrompt />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 mb-6">Configure your Gemini and OpenAI API keys. Stored locally in your browser.</p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="gemini-key" className="block text-sm font-medium text-gray-800 mb-1">Gemini API Key</label>
              <input
                id="gemini-key"
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKeyState(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">Key is saved to localStorage and used by tools like PDF → Markdown.</p>
            </div>

            <div>
              <label htmlFor="openai-key" className="block text-sm font-medium text-gray-800 mb-1">OpenAI API Key</label>
              <input
                id="openai-key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKeyState(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">Key is saved to localStorage and used by tools like Flower Bouquet Generator.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="bg-white border-2 border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
              >
                Clear
              </button>
            </div>

            {status && (
              <div className="text-sm text-gray-800">{status}</div>
            )}
          </form>

          <div className="mt-6 text-sm text-gray-600">
            <h2 className="text-base font-semibold text-gray-900 mb-2">How to get your Gemini API Key</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Open:
                {' '}
                <a
                  href="https://aistudio.google.com/u/0/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-black"
                >
                  https://aistudio.google.com/u/0/apikey
                </a>
              </li>
              <li>
                Sign in with your Google account. If you don’t have a key yet, click
                {' '}<span className="font-medium">Create API key</span>. If you already have one, click the
                {' '}<span className="font-medium">copy</span> icon to copy it.
              </li>
              <li>
                Paste the API key into the field above and click
                {' '}<span className="font-medium">Save</span>.
              </li>
            </ol>
            <h2 className="text-base font-semibold text-gray-900 mb-2 mt-6">How to get your OpenAI API Key</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Open:
                {' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-black"
                >
                  https://platform.openai.com/api-keys
                </a>
              </li>
              <li>
                Sign in and click <span className="font-medium">Create new secret key</span> or copy an existing key.
              </li>
              <li>
                Paste the API key into the field above and click <span className="font-medium">Save</span>.
              </li>
            </ol>
            <p className="mt-3 text-gray-700">
              Note: treat your API keys like passwords. They are only stored in your browser (localStorage) and used directly from your device. You can revoke or rotate keys anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
