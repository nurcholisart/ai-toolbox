import React, { useEffect, useState } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import { getApiKey, setApiKey, clearApiKey } from '../lib/config.js'

export default function Settings() {
  const [apiKey, setApiKeyState] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    setApiKeyState(getApiKey())
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    setApiKey(apiKey.trim())
    setStatus('Saved')
    setTimeout(() => setStatus(''), 1500)
  }

  const handleClear = () => {
    clearApiKey()
    setApiKeyState('')
    setStatus('Cleared')
    setTimeout(() => setStatus(''), 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <a
          href="#"
          className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
        >
          <IconArrowLeft size={18} stroke={2} />
          Back to tools
        </a>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="bg-white rounded-lg border-2 border-black shadow-md p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 mb-6">Configure your Gemini API key. Stored locally in your browser.</p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="gemini-key" className="block text-sm font-medium text-gray-800 mb-1">Gemini API Key</label>
              <input
                id="gemini-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-white border-2 border-black rounded-lg px-3 py-2 focus:outline-none"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">Key is saved to localStorage and used by tools like PDF → Markdown.</p>
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
            <p>Get your key from Google AI Studio. This app never sends your key anywhere except directly to the Gemini API from your browser.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
