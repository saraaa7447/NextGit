import './styles.css'

import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ModalApp } from './ModalApp'
import { DEFAULT_THEME, FLAT_KEY, THEME_KEY, THEMES } from './themes'
import type { ModalType } from './types'

const stored = localStorage.getItem(THEME_KEY)
const initial = THEMES.some(t => t.id === stored) ? (stored as string) : DEFAULT_THEME
document.documentElement.dataset.theme = initial
if (localStorage.getItem(FLAT_KEY) === '1') {
  document.documentElement.dataset.flat = '1'
}

const modalType = new URLSearchParams(window.location.search).get('modal')
if (modalType) {
  createRoot(document.getElementById('root')!).render(
    <ModalApp type={modalType as ModalType} />,
  )
} else {
  createRoot(document.getElementById('root')!).render(<App />)
}
