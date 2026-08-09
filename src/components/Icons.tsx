import React from 'react'

export type IconName =
  | 'repo'
  | 'branch'
  | 'sync'
  | 'chevronDown'
  | 'plus'
  | 'refresh'
  | 'trash'
  | 'terminal'
  | 'folder'
  | 'check'
  | 'clock'
  | 'x'
  | 'search'
  | 'ellipsis'
  | 'commit'
  | 'arrowUp'
  | 'arrowDown'
  | 'undo'
  | 'stash'
  | 'external'
  | 'git'
  | 'diff'
  | 'file'
  | 'bell'
  | 'star'
  | 'download'

const paths: Record<IconName, React.ReactNode> = {
  repo: (
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4.5 5.25h7" />
      <path d="M4.5 7.75h4.5" />
    </>
  ),
  branch: (
    <>
      <circle cx="4" cy="3" r="1.75" />
      <circle cx="4" cy="13" r="1.75" />
      <circle cx="12" cy="6" r="1.75" />
      <path d="M4 4.75v6.5" />
      <path d="M4 12.3C6 10.8 6.5 7.5 12 7.5" />
      <path d="M12 4.25V6" />
    </>
  ),
  sync: (
    <>
      <path d="M1.75 8a6.25 6.25 0 0 1 10.7-4.42L14 5" />
      <path d="M14 2.5V5h-2.5" />
      <path d="M14.25 8a6.25 6.25 0 0 1-10.7 4.42L2 11" />
      <path d="M2 13.5V11h2.5" />
    </>
  ),
  chevronDown: <path d="M3.5 6l4.5 4.5L12.5 6" />,
  plus: (
    <>
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </>
  ),
  refresh: (
    <>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.14" />
      <path d="M13.5 2v3h-3" />
    </>
  ),
  trash: (
    <>
      <path d="M2.5 4.5h11" />
      <path d="M6 4.5V3h4v1.5" />
      <path d="M3.5 4.5L4.5 14h7l1-9.5" />
      <path d="M6.5 7v5" />
      <path d="M9.5 7v5" />
    </>
  ),
  terminal: (
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4.5 6l2.5 2.5L4.5 11" />
      <path d="M9 11h2.5" />
    </>
  ),
  folder: (
    <path d="M1.5 4.25A1.75 1.75 0 0 1 3.25 2.5h2.1c.6 0 1.17.24 1.6.66l1 1.01c.15.15.35.24.56.24h4.24A1.75 1.75 0 0 1 14.5 6.16v5.59a1.75 1.75 0 0 1-1.75 1.75H3.25A1.75 1.75 0 0 1 1.5 11.75V4.25Z" />
  ),
  check: <path d="M3 8.5l3.5 3.5L13 4.5" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 2" />
    </>
  ),
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </>
  ),
  ellipsis: (
    <>
      <circle cx="4" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  commit: (
    <>
      <path d="M1 8h4" />
      <path d="M11 8h4" />
      <circle cx="8" cy="8" r="2.5" />
    </>
  ),
  arrowUp: <path d="M8 13V3M4 6.5L8 2.5l4 4" />,
  arrowDown: <path d="M8 3v10M4 9.5L8 13.5l4-4" />,
  undo: (
    <>
      <path d="M6 4.5L2.5 8l3.5 3.5" />
      <path d="M2.5 8H9a4.5 4.5 0 0 1 0 9" />
    </>
  ),
  stash: (
    <>
      <path d="M2.5 8.5L8 2.5l5.5 6" />
      <path d="M8 2.5V14" />
      <path d="M5.5 14h5" />
    </>
  ),
  external: (
    <>
      <path d="M6 3.5H4a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 4 13.5h7a1.5 1.5 0 0 0 1.5-1.5v-2" />
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5L8 8" />
    </>
  ),
  git: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M4 4l8 8" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  diff: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M8 5.5v5" />
      <path d="M5.5 8h5" />
    </>
  ),
  file: (
    <>
      <path d="M4 2.5h5l3 3v8H4z" />
      <path d="M9 2.5v3h3" />
    </>
  ),
  bell: (
    <>
      <path d="M8 2a4.5 4.5 0 0 0-4.5 4.5v2.75L2 11.5h12l-1.5-2.25V6.5A4.5 4.5 0 0 0 8 2Z" />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  star: (
    <path d="M8 1.5l1.9 3.85 4.25.62-3.08 3 .73 4.24L8 11.1l-3.8 2.11.73-4.24-3.08-3 4.25-.62L8 1.5Z" />
  ),
  download: <path d="M8 1.5v9M4.5 7.5L8 11l3.5-3.5M2 14.5h12" />,
}

export function Icon({
  name,
  size = 16,
  className,
  filled,
}: {
  name: IconName
  size?: number
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
