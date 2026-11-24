import { useEffect } from 'react'
import { useAppStore } from '../lib/store'

export function Toast() {
  const toast = useAppStore((state) => state.toast)
  const hideToast = useAppStore((state) => state.hideToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(hideToast, 2400)
    return () => clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null
  return (
    <div className="toast" data-tone={toast.tone} role="status">
      {toast.message}
    </div>
  )
}
