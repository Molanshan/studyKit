import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { APP_LOGO, APP_NAME, COLORS, QUESTION_VIEWS } from '../lib/constants'
import type { QuestionType } from '../types'

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <img
      src={APP_LOGO}
      alt={APP_NAME}
      width={size}
      height={size}
      style={{ borderRadius: size * 0.29, objectFit: 'cover' }}
    />
  )
}

export function TypeBadge({
  type,
  multiple = false,
}: {
  type: QuestionType
  multiple?: boolean
}) {
  const key = type === 'choice' ? (multiple ? 'multiple' : 'single') : type
  const view = QUESTION_VIEWS.find((item) => item.key === key) ?? QUESTION_VIEWS[0]
  const color = COLORS[view.color]
  return (
    <span className="badge" style={{ background: color.bg, color: color.text }}>
      {view.shortLabel}
    </span>
  )
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="mask"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        {children}
        {footer ? <div className="sheet-actions">{footer}</div> : null}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Ring({ value }: { value: number }) {
  return (
    <div className="ring" style={{ '--value': Math.max(0, Math.min(100, value)) } as CSSProperties}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <strong>{Math.round(value)}</strong>
        <span>得分率</span>
      </div>
    </div>
  )
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="setting-row">
      <div>
        <div className="label">{label}</div>
        {description ? <div className="desc">{description}</div> : null}
      </div>
      {children}
    </div>
  )
}
