import React, { useMemo } from 'react'

export default function Disclosure() {
  const isPictureMe = useMemo(
    () => typeof window !== 'undefined' && window.location.pathname === '/picture-me',
    [],
  )
  return (
    <div className="mt-6 pt-4 border-t border-black/10 text-xs text-gray-600">
      <p>AI may be wrong. Please use this tool responsibly.</p>
      {isPictureMe && (
        <p className="mt-2">
          This tool is based on the Gemini Canvas template created by the Google team, and they shared details in this X post: https://x.com/GeminiApp/status/1963615829708132611
        </p>
      )}
    </div>
  )
}
