import React from 'react'

import { countChanges, type DiffFile } from '../diffParser'
import { EmptyState } from './Common'
import { Icon } from './Icons'

const MAX_RENDER_LINES = 6000

const diffStatusMeta: Record<string, { label: string, cls: string }> = {
  modified: { label: 'Modified', cls: 'st-modified' },
  added: { label: 'Added', cls: 'st-added' },
  deleted: { label: 'Deleted', cls: 'st-deleted' },
  renamed: { label: 'Renamed', cls: 'st-renamed' },
  binary: { label: 'Binary', cls: 'st-untracked' },
}

export function DiffView({
  files,
  loading,
  emptyTitle,
  emptyDesc,
  onDiscard,
  hasSelection,
}: {
  files: DiffFile[]
  loading: boolean
  emptyTitle: string
  emptyDesc?: string
  onDiscard?: (path: string) => void
  hasSelection: boolean
}) {
  if (loading) {
    return (
      <div className="diff-pane loading">
        <span className="spinner" />
        {' '}
        Loading...
      </div>
    )
  }

  if (!hasSelection) {
    return (
      <EmptyState
        icon={<Icon name="diff" size={40} />}
        title={emptyTitle}
      >
        {emptyDesc && <p>{emptyDesc}</p>}
      </EmptyState>
    )
  }

  if (files.length === 0) {
    return (
      <EmptyState icon={<Icon name="check" size={36} />} title="No changes">
        <p>Nothing to show for this selection.</p>
      </EmptyState>
    )
  }

  return (
    <div className="diff-files">
      {files.map((f, i) => (
        <DiffFileView key={`${f.path}-${i}`} file={f} onDiscard={onDiscard} />
      ))}
    </div>
  )
}

function DiffFileView({
  file,
  onDiscard,
}: {
  file: DiffFile
  onDiscard?: (path: string) => void
}) {
  const meta = diffStatusMeta[file.status] ?? diffStatusMeta.modified
  const stats = countChanges([file])
  const totalLines = file.hunks.reduce((n, h) => n + h.lines.length, 0)
  const truncated = totalLines > MAX_RENDER_LINES

  return (
    <div className="diff-file">
      <div className="diff-file-header">
        <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
        <span className="diff-file-path" title={file.path}>
          {file.path}
        </span>
        <span className="diff-file-stats">
          <span className="diff-stat-add">
            +
            {stats.add}
          </span>
          <span className="diff-stat-del">
            -
            {stats.del}
          </span>
        </span>
        {onDiscard && (
          <button className="btn btn-subtle btn-small discard-btn" onClick={() => onDiscard(file.path)}>
            <Icon name="trash" size={12} />
            {' '}
            Discard changes
          </button>
        )}
      </div>

      {file.binary
        ? (
            <div className="diff-binary">Binary file not shown.</div>
          )
        : (
            <div className="diff-hunks">
              {file.hunks.map((h, i) => (
                <div className="diff-hunk" key={i}>
                  <div className="diff-hunk-header">{h.header}</div>
                  {!truncated && (
                    <div className="diff-lines">
                      {h.lines.map((l, j) => (
                        <div key={j} className={`diff-line ${l.type}`}>
                          <span className="dl-no old">{l.oldNo ?? ''}</span>
                          <span className="dl-no new">{l.newNo ?? ''}</span>
                          <span className="dl-sign">{l.type === 'add' ? '+' : l.type === 'del' ? '-' : l.type === 'nonewline' ? '\\' : ' '}</span>
                          <span className="dl-content">{l.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {truncated && (
                <div className="diff-truncated">
                  Diff is too large to display (
                  {totalLines}
                  {' '}
                  lines).
                </div>
              )}
            </div>
          )}
    </div>
  )
}
