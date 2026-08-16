import React from 'react'

import { THEMES } from '../themes'
import { Dropdown } from './Dropdown'
import { Icon } from './Icons'

export function ThemePicker({
  theme,
  onSelect,
  flat,
  onFlatChange,
}: {
  theme: string
  onSelect: (t: string) => void
  flat: boolean
  onFlatChange: (v: boolean) => void
}) {
  return (
    <Dropdown
      width={200}
      alignRight
      button={(
        <div className="theme-chip" title="Theme">
          <Icon name="palette" size={15} />
        </div>
      )}
    >
      <div className="menu-section-title">Theme</div>
      {THEMES.map(t => (
        <button
          key={t.id}
          className={`theme-option${theme === t.id ? ' active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          <span className="theme-swatches">
            {t.swatch.map(c => (
              <span key={c} className="theme-swatch" style={{ background: c }} />
            ))}
          </span>
          <span className="theme-name">{t.name}</span>
          {theme === t.id && <Icon name="check" size={14} className="menu-check" />}
        </button>
      ))}
      <div className="menu-section-title flat-section-title">Style</div>
      <label className="flat-row">
        <span className="flat-row-label">Flat colours</span>
        <button
          role="switch"
          aria-checked={flat}
          className={`flat-switch${flat ? ' on' : ''}`}
          onClick={() => onFlatChange(!flat)}
        >
          <span className="flat-switch-thumb" />
        </button>
      </label>
    </Dropdown>
  )
}
