import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconDownload } from '@tabler/icons-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const containerRef = useRef(null)

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      // iOS Safari
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
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 text-sm bg-white text-black border-2 border-black rounded-lg px-3 py-1 hover:bg-gray-100 shadow-sm"
      >
        <IconDownload size={16} stroke={2} />
        Install App
      </button>

      {showIosHelp && (
        <div className="absolute right-0 mt-2 w-72 bg-white border-2 border-black rounded-xl shadow-md p-3 z-20">
          <p className="text-sm text-gray-800 font-medium mb-1">Install on iOS</p>
          <p className="text-sm text-gray-700">
            Open the Share menu in Safari, then choose
            {' '}<span className="font-semibold">Add to Home Screen</span>.
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="bg-white border-2 border-black text-black px-2 py-1 rounded-lg hover:bg-gray-100 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

