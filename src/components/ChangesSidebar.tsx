import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import { Avatar, EmptyState, StatusBadge } from './Common'
import type { DiffFilter, FileChange } from '../types'

function applyFilter(changes: FileChange[], filter: DiffFilter): FileChange[] {
  if (filter === 'staged') return changes.filter((c) => c.staged)
  if (filter === 'unstaged')
    return changes.filter(
      (c) => c.untracked || (c.worktreeStatus !== ' ' && c.worktreeStatus !== '?'),
    )
  return changes
}

export function ChangesSidebar({
  changes,
  filter,
  onFilterChange,
  selectedPaths,
  onSelect,
  onToggleStage,
  onStageAll,
  onUnstageAll,
  onDiscard,
  onReveal,
  onOpenTerminal,
  onOpenFinder,
  repoPath,
  branchName,
  hasCommits,
  identity,
  hasIdentity,
  onOpenIdentity,
  summary,
  description,
  onSummaryChange,
  onDescriptionChange,
  onCommit,
  committing,
  onStash,
  onPopStash,
  stashCount,
}: {
  changes: FileChange[]
  filter: DiffFilter
  onFilterChange: (f: DiffFilter) => void
  selectedPaths: ReadonlySet<string>
  onSelect: (f: FileChange, multi: boolean) => void
  onToggleStage: (f: FileChange) => void
  onStageAll: () => void
  onUnstageAll: () => void
  onDiscard: (f: FileChange) => void
  onReveal: (f: FileChange) => void
  onOpenTerminal: () => void
  onOpenFinder: () => void
  repoPath: string
  branchName: string
  hasCommits: boolean
  identity: { name: string; email: string }
  hasIdentity: boolean
  onOpenIdentity: () => void
  summary: string
  description: string
  onSummaryChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onCommit: () => void
  committing: boolean
  onStash: () => void
  onPopStash: () => void
  stashCount: number
}) {
  const filtered = applyFilter(changes, filter)
  const anyStaged = changes.some((c) => c.staged)
  const canCommit = summary.trim().length > 0 && changes.length > 0 && !committing

  return (
    <div className="changes-sidebar">
      <div className="filter-bar">
        <div className="segmented">
          <button
            className={`segmented-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            All changes
          </button>
          <button
            className={`segmented-btn${filter === 'staged' ? ' active' : ''}`}
            onClick={() => onFilterChange('staged')}
          >
            Staged
          </button>
          <button
            className={`segmented-btn${filter === 'unstaged' ? ' active' : ''}`}
            onClick={() => onFilterChange('unstaged')}
          >
            Unstaged
          </button>
        </div>
      </div>

      {changes.length === 0 ? (
        <EmptyState title="No local changes">
          <p>There are no uncommitted changes in this repository.</p>
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
        <>
          <div className="file-list-header">
            <button
              className="btn-link"
              onClick={anyStaged ? onUnstageAll : onStageAll}
              title={anyStaged ? 'Unstage all' : 'Stage all'}
            >
              {anyStaged ? <Icon name="x" size={12} /> : <Icon name="plus" size={12} />}
              {anyStaged ? 'Unstage all' : 'Stage all'}
            </button>
            <span className="file-count">
              {filtered.length} of {changes.length}
            </span>
          </div>
          <div className="file-list">
            {filtered.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                selected={selectedPaths.has(f.path)}
                repoPath={repoPath}
                onSelect={(e) => onSelect(f, e.ctrlKey || e.metaKey)}
                onToggleStage={() => onToggleStage(f)}
                onDiscard={() => onDiscard(f)}
                onReveal={() => onReveal(f)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="list-empty">
                No {filter === 'staged' ? 'staged' : 'unstaged'} changes.
              </div>
            )}
          </div>
        </>
      )}

      <CommitBox
        branchName={branchName}
        identity={identity}
        hasCommits={hasCommits}
        hasIdentity={hasIdentity}
        onOpenIdentity={onOpenIdentity}
        summary={summary}
        description={description}
        onSummaryChange={onSummaryChange}
        onDescriptionChange={onDescriptionChange}
        onCommit={onCommit}
        canCommit={canCommit}
        committing={committing}
        onStash={onStash}
        onPopStash={onPopStash}
        stashCount={stashCount}
      />
    </div>
  )
}

function FileRow({
  file,
  selected,
  repoPath,
  onSelect,
  onToggleStage,
  onDiscard,
  onReveal,
}: {
  file: FileChange
  selected: boolean
  repoPath: string
  onSelect: (e: React.MouseEvent) => void
  onToggleStage: () => void
  onDiscard: () => void
  onReveal: () => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', (e) => e.key === 'Escape' && close())
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  return (
    <>
      <div
        className={`file-row${selected ? ' selected' : ''}`}
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <span
          className="file-checkbox"
          onClick={(e) => {
            e.stopPropagation()
            onToggleStage()
          }}
          title={file.staged ? 'Unstage' : 'Stage'}
        >
          <span className={file.staged ? 'box checked' : 'box'}>
            {file.staged && <Icon name="check" size={11} />}
          </span>
        </span>
        <StatusBadge file={file} />
        <span className="file-name" title={file.path}>
          {file.path}
        </span>
        {file.origPath && file.path !== file.origPath && (
          <span className="file-rename">from {file.origPath}</span>
        )}
      </div>
      {menu && (
        <div
          className="context-menu"
          style={{ left: Math.min(menu.x, window.innerWidth - 240), top: menu.y }}
          ref={menuRef}
        >
          <div className="context-title" title={file.path}>
            {file.path}
          </div>
          <button
            className="context-item"
            onClick={() => { onReveal(); setMenu(null) }}
          >
            <Icon name="folder" size={14} /> Open in File Manager
          </button>
          <button
            className="context-item danger"
            onClick={() => { onDiscard(); setMenu(null) }}
          >
            <Icon name="trash" size={14} /> Discard changes
          </button>
        </div>
      )}
    </>
  )
}

function CommitBox({
  branchName,
  identity,
  hasCommits,
  hasIdentity,
  onOpenIdentity,
  summary,
  description,
  onSummaryChange,
  onDescriptionChange,
  onCommit,
  canCommit,
  committing,
  onStash,
  onPopStash,
  stashCount,
}: {
  branchName: string
  identity: { name: string; email: string }
  hasCommits: boolean
  hasIdentity: boolean
  onOpenIdentity: () => void
  summary: string
  description: string
  onSummaryChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onCommit: () => void
  canCommit: boolean
  committing: boolean
  onStash: () => void
  onPopStash: () => void
  stashCount: number
}) {
  const [showDesc, setShowDesc] = useState(false)

  return (
    <div className="commit-box">
      {!hasCommits && (
        <div className="commit-warn">
          This is the first commit in the repository.
        </div>
      )}
      {!hasIdentity && (
        <button className="identity-warn-btn" onClick={onOpenIdentity}>
          Your Git name and email aren't configured yet — set them to enable commits.
        </button>
      )}
      <div className="commit-inputs">
        <textarea
          className="commit-summary"
          placeholder="Summary"
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canCommit) onCommit()
            }
          }}
          rows={1}
          autoFocus={false}
        />
        {showDesc ? (
          <textarea
            className="commit-desc"
            placeholder="Description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
          />
        ) : (
          <button className="add-desc-btn" onClick={() => setShowDesc(true)}>
            Add description
          </button>
        )}
      </div>
      <div className="commit-footer">
        <div className="commit-author">
          <Avatar name={identity.name} size={18} />
          <span className="commit-author-name">{identity.name}</span>
          <span className="commit-author-email">&lt;{identity.email}&gt;</span>
        </div>
        <div className="commit-actions">
          <button
            className="btn btn-subtle btn-small"
            onClick={onStash}
            disabled={!canCommit}
            title="Stash all changes"
          >
            <Icon name="stash" size={13} /> Stash
          </button>
          <button
            className="btn btn-subtle btn-small"
            onClick={onPopStash}
            disabled={stashCount === 0}
            title="Restore the most recent stash"
          >
            <Icon name="undo" size={13} /> Pop stash
          </button>
          <button
            className="btn btn-primary btn-small btn-commit"
            onClick={onCommit}
            disabled={!canCommit}
          >
            {committing ? <span className="spinner light" /> : null}
            {committing
              ? 'Committing...'
              : branchName
                ? `Commit to ${branchName}`
                : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  )
}
