import './styles.css'

import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { DEFAULT_THEME, FLAT_KEY, THEME_KEY, THEMES } from './themes'

const stored = localStorage.getItem(THEME_KEY)
const initial = THEMES.some(t => t.id === stored) ? (stored as string) : DEFAULT_THEME
document.documentElement.dataset.theme = initial
if (localStorage.getItem(FLAT_KEY) === '1') {
  document.documentElement.dataset.flat = '1'
}

createRoot(document.getElementById('root')!).render(<App />)
