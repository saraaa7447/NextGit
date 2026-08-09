import React from 'react'
import { Icon } from './Icons'
import type { BranchInfo, FileChange } from '../types'
import { displayStatus } from '../gitService'

function changeSummary(changes: FileChange[]): string {
  const counts: Record<string, number> = {}
  for (const c of changes) {
    const s = displayStatus(c)
    counts[s] = (counts[s] || 0) + 1
  }
  const parts: string[] = []
  if (counts['A']) parts.push(`${counts['A']} added`)
  if (counts['M']) parts.push(`${counts['M']} modified`)
  if (counts['D']) parts.push(`${counts['D']} deleted`)
  if (counts['R']) parts.push(`${counts['R']} renamed`)
  if (counts['?']) parts.push(`${counts['?']} untracked`)
  if (counts['U']) parts.push(`${counts['U']} conflicted`)
  return parts.length ? parts.join(', ') : 'No pending changes'
}

export function StatusBar({
  branch,
  changes,
  activeRepo,
  busy,
}: {
  branch: BranchInfo | null
  changes: FileChange[]
  activeRepo: string | null
  busy: string | null
}) {
  return (
    <footer className="status-bar">
      <div className="status-left">
        {activeRepo ? (
          <>
            <Icon name="branch" size={13} className="status-icon" />
            <span className="status-branch">
              {branch?.head || 'Unknown branch'}
            </span>
            {branch?.upstream && (
              <span className="status-upstream">{branch.upstream}</span>
            )}
          </>
        ) : (
          <span className="status-muted">No repository selected</span>
        )}
      </div>
      <div className="status-right">
        {busy ? (
          <span className="status-busy">
            <span className="spinner" /> {busyLabel(busy)}
          </span>
        ) : activeRepo ? (
          <>
            <span className="status-changes">{changeSummary(changes)}</span>
            <button
              className="status-author"
              title="Visit SaraPPC's website"
              onClick={() => window.api.openExternal('https://sarascafe.lenowo.org')}
            >
              Made by SaraPPC
            </button>
          </>
        ) : null}
      </div>
    </footer>
  )
}

function busyLabel(busy: string): string {
  const map: Record<string, string> = {
    fetch: 'Fetching...',
    push: 'Pushing...',
    pull: 'Pulling...',
    commit: 'Committing...',
    refresh: 'Refreshing...',
    switch: 'Switching branch...',
    stash: 'Stashing...',
    pop: 'Restoring stash...',
    undo: 'Undoing commit...',
  }
  return map[busy] || busy
}
