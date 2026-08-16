import React, { useEffect, useRef, useState } from 'react'

export function Dropdown({
  button,
  children,
  width = 320,
  disabled,
  className,
  alignRight,
  open: openProp,
  onOpenChange,
}: {
  button: React.ReactNode
  children: React.ReactNode
  width?: number
  disabled?: boolean
  className?: string
  alignRight?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onOpenChange?.(v)
  }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`dropdown${className ? ' ' + className : ''}`} ref={ref}>
      <div
        className={`dropdown-btn${disabled ? ' disabled' : ''}${open ? ' open' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !disabled) setOpen(!open)
        }}
      >
        {button}
      </div>
      {open && (
        <div
          className={`dropdown-menu${alignRight ? ' align-right' : ''}`}
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
