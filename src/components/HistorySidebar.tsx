import React from 'react'
import { Icon } from './Icons'
import { Avatar, EmptyState, timeAgo } from './Common'
import type { Commit } from '../types'

const refColor = (ref: string) => {
  if (ref === 'HEAD' || ref === 'HEAD ->') return '#0969da'
  if (ref.startsWith('origin/')) return '#bf3989'
  if (ref.startsWith('tag:')) return '#1a7f37'
  return '#57606a'
}

export function HistorySidebar({
  commits,
  selectedSha,
  onSelect,
  loading,
  branch,
  onUndoCommit,
  canUndo,
  onOpenTerminal,
  onOpenFinder,
}: {
  commits: Commit[]
  selectedSha: string | null
  onSelect: (c: Commit) => void
  loading: boolean
  branch: string | null
  onUndoCommit: () => void
  canUndo: boolean
  onOpenTerminal: () => void
  onOpenFinder: () => void
}) {
  return (
    <div className="history-sidebar">
      <div className="history-header">
        <div className="history-title">
          {branch ? (
            <>
              <Icon name="branch" size={13} />
              <span>History of {branch}</span>
            </>
          ) : (
            <span>History</span>
          )}
        </div>
        <button
          className="btn btn-subtle btn-small"
          onClick={onUndoCommit}
          disabled={!canUndo}
          title="Reset the last commit (keep changes staged)"
        >
          <Icon name="undo" size={13} /> Undo commit
        </button>
      </div>

      {loading ? (
        <div className="list-loading">
          <span className="spinner" /> Loading commits...
        </div>
      ) : commits.length === 0 ? (
        <EmptyState title="No commits yet">
          <p>
            This repository doesn&apos;t have any commits yet. Create your first
            commit on the <strong>Changes</strong> tab.
          </p>
          <div className="empty-actions">
            <button className="btn btn-default btn-small" onClick={onOpenFinder}>
              <Icon name="folder" size={13} /> Open repository
            </button>
            <button className="btn btn-default btn-small" onClick={onOpenTerminal}>
              <Icon name="terminal" size={13} /> Open in Terminal
            </button>
          </div>
        </EmptyState>
      ) : (
        <div className="commit-list">
          {commits.map((c) => {
            const selected = c.sha === selectedSha
            const refs = c.refs
              .split(', ')
              .map((r) => r.replace(/^origin\//, 'origin/'))
              .filter(Boolean)
            return (
              <button
                key={c.sha}
                className={`commit-row${selected ? ' selected' : ''}`}
                onClick={() => onSelect(c)}
              >
                <Avatar name={c.authorName} size={28} />
                <div className="commit-row-main">
                  <div className="commit-summary">{c.summary}</div>
                  <div className="commit-meta">
                    <span className="commit-sha">{c.shortSha}</span>
                    <span className="commit-author">{c.authorName}</span>
                    <span className="commit-time">{timeAgo(c.timestamp)}</span>
                  </div>
                  {refs.length > 0 && (
                    <div className="commit-refs">
                      {refs.slice(0, 3).map((r, i) => (
                        <span key={i} className="commit-ref" style={{ color: refColor(r) }}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
