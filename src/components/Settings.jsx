import React, { useEffect, useState } from 'react'

import { getApiKey, setApiKey, clearApiKey } from '../lib/config.js'
import { Button } from './ui/button.jsx'
import { Input } from './ui/input.jsx'
import { Label } from './ui/label.jsx'

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
    <form onSubmit={handleSave} className='space-y-6'>
      <div className='space-y-2'>
        <Label htmlFor='api-key'>Gemini API key</Label>
        <Input
          id='api-key'
          name='api-key'
          value={apiKey}
          onChange={(e) => setApiKeyState(e.target.value)}
          placeholder='AIza...'
          autoComplete='off'
        />
        <p className='text-sm text-muted-foreground'>Your key is stored locally in this browser.</p>
      </div>

      {status ? (
        <p className='text-sm text-muted-foreground'>Status: {status}</p>
      ) : null}

      <div className='flex flex-wrap gap-3'>
        <Button type='submit'>Save key</Button>
        <Button type='button' variant='outline' onClick={handleClear}>
          Clear key
        </Button>
      </div>
    </form>
  )
}
