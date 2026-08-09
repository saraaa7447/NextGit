export interface Theme {
  id: string
  name: string
  swatch: string[]
}

export const THEMES: Theme[] = [
  {
    id: 'silver',
    name: 'Silver',
    swatch: ['#c3c7ce', '#2e6db1', '#ffffff'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    swatch: ['#e1e1e1', '#2e6fce', '#ffffff'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    swatch: ['#414141', '#6b6b6b', '#e8e8e8'],
  },
  {
    id: 'scarlett-pink',
    name: 'ScarlettPink',
    swatch: ['#f8c8dc', '#900000', '#ffffff'],
  },
]

export const DEFAULT_THEME = 'silver'

export const THEME_KEY = 'gd.theme'

export const FLAT_KEY = 'gd.flat'

export function themeName(id: string): string {
  return THEMES.find((t) => t.id === id)?.name || id
}
