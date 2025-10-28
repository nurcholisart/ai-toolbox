import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconDownload } from '@tabler/icons-react'

import { Button } from './ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const containerRef = useRef(null)

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true
    )
  }, [])

  const isIos = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    return /iphone|ipad|ipod/i.test(ua)
  }, [])

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowIosHelp(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target)) {
        setShowIosHelp(false)
      }
    }
    if (showIosHelp) document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [showIosHelp])

  if (installed || isStandalone) return null

  const canPrompt = !!deferredPrompt
  const shouldShowIos = isIos && !canPrompt
  const shouldRender = canPrompt || shouldShowIos
  if (!shouldRender) return null

  const onClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        if (choice?.outcome === 'accepted') {
          setDeferredPrompt(null)
        }
      } catch {}
    } else if (shouldShowIos) {
      setShowIosHelp((v) => !v)
    }
  }

  return (
    <div ref={containerRef} className='relative inline-flex'>
      <Button type='button' onClick={onClick} variant='outline' className='gap-2'>
        <IconDownload size={18} />
        Install app
      </Button>

      {showIosHelp ? (
        <Card className='absolute right-0 top-full mt-2 w-72 shadow-lg'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Install on iOS</CardTitle>
            <CardDescription>
              Open the Share menu in Safari, then choose <span className='font-medium text-foreground'>Add to Home Screen</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex justify-end pt-0'>
            <Button size='sm' variant='ghost' onClick={() => setShowIosHelp(false)}>
              Close
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
