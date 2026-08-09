import React, { useEffect } from 'react'
import { displayStatus } from '../gitService'
import type { FileChange } from '../types'

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
  title,
  small,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'subtle' | 'danger'
  disabled?: boolean
  className?: string
  title?: string
  small?: boolean
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant}${small ? ' btn-small' : ''}${className ? ' ' + className : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`segmented-btn${o.value === value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 460,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {children && <div className="empty-desc">{children}</div>}
    </div>
  )
}

const statusMeta: Record<string, { label: string; cls: string }> = {
  M: { label: 'Modified', cls: 'st-modified' },
  A: { label: 'Added', cls: 'st-added' },
  D: { label: 'Deleted', cls: 'st-deleted' },
  R: { label: 'Renamed', cls: 'st-renamed' },
  C: { label: 'Copied', cls: 'st-renamed' },
  U: { label: 'Conflicted', cls: 'st-conflicted' },
  '?': { label: 'Untracked', cls: 'st-untracked' },
  '!': { label: 'Ignored', cls: 'st-untracked' },
}

export function StatusBadge({ file }: { file: FileChange }) {
  const code = displayStatus(file)
  const meta = statusMeta[code] ?? { label: code, cls: 'st-untracked' }
  return <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
}

export function fileExtension(path: string): string {
  const base = path.split('/').pop() || path
  const idx = base.lastIndexOf('.')
  if (idx <= 0) return ''
  const ext = base.slice(idx + 1).toLowerCase()
  return ext.length <= 8 ? ext : ''
}

export const AVATAR_COLORS = [
  '#df6b57', '#2d7bbd', '#7d5a5c', '#c4a345', '#6b99c9', '#a7a7a7', '#717ce9',
  '#a87bdd', '#62bf93', '#b98f60', '#5a7d9a', '#8a6d3b', '#5b8f6c', '#b85d78',
]

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function colorFor(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 997
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar({
  name,
  size = 18,
}: {
  name: string
  size?: number
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.38),
        background: colorFor(name),
      }}
    >
      {initials(name)}
    </span>
  )
}

export function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  const s = Math.floor(diff)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  const y = Math.floor(mo / 12)
  return `${y} year${y === 1 ? '' : 's'} ago`
}
