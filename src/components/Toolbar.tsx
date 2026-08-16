import React, { useState } from 'react'

import type { BranchInfo, Repo } from '../types'
import { Dropdown } from './Dropdown'
import { Icon } from './Icons'
import { ThemePicker } from './ThemePicker'

interface ToolbarProps {
  repos: Repo[]
  activeRepo: Repo | null
  branch: BranchInfo | null
  branches: string[]
  hasRemote: boolean
  busy: string | null
  theme: string
  onThemeChange: (t: string) => void
  flat: boolean
  onFlatChange: (v: boolean) => void
  onSelectRepo: (r: Repo) => void
  onRemoveRepo: (r: Repo) => void
  onAddRepo: () => void
  onCreateRepo: () => void
  onCloneRepo: () => void
  onScanFolder: () => void
  onOpenTerminal: () => void
  onOpenFinder: () => void
  onRefresh: () => void
  onSwitchBranch: (name: string) => void
  onCreateBranch: (name: string) => void
  onMerge: () => void
  onFetch: () => void
  onSync: () => void
}

export function Toolbar(props: ToolbarProps) {
  const {
    repos,
    activeRepo,
    branch,
    branches,
    hasRemote,
    busy,
  } = props

  const head = branch?.head || ''
  const upstream = branch?.upstream
  const ahead = branch?.ahead || 0
  const behind = branch?.behind || 0

  let syncLabel = 'Pull origin'
  let syncDisabled = true
  let syncTitle = 'Branch is up to date'
  if (!hasRemote) {
    syncLabel = 'Sync'
    syncDisabled = true
    syncTitle = 'No remote configured'
  } else if (!upstream) {
    syncLabel = 'Publish branch'
    syncDisabled = false
    syncTitle = 'Push this branch to origin'
  } else if (branch?.gone) {
    syncLabel = 'Publish branch'
    syncDisabled = false
    syncTitle = `Push ${ahead} commit${ahead === 1 ? '' : 's'} to ${upstream}`
  } else if (behind > 0 && ahead > 0) {
    syncLabel = 'Pull & push origin'
    syncDisabled = false
    syncTitle = `Pull ${behind} commit(s) and push ${ahead} commit(s)`
  } else if (behind > 0) {
    syncLabel = 'Pull origin'
    syncDisabled = false
    syncTitle = `Pull ${behind} commit(s) from ${upstream}`
  } else if (ahead > 0) {
    syncLabel = 'Push origin'
    syncDisabled = false
    syncTitle = `Push ${ahead} commit(s) to ${upstream}`
  }

  const syncBusy = busy === 'pull' || busy === 'push'
  const fetchBusy = busy === 'fetch'

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <Dropdown
          width={340}
          button={(
            <div className="repo-chip">
              <Icon name="repo" size={18} className="repo-icon" />
              <span className="chip-label">{activeRepo?.name || 'Select a repository'}</span>
              <Icon name="chevronDown" size={14} className="chip-chevron" />
            </div>
          )}
        >
          <div className="menu-section-title">Repositories</div>
          <div className="menu-repos">
            {repos.length === 0 && (
              <div className="menu-empty">No repositories added yet.</div>
            )}
            {repos.map(r => (
              <button
                key={r.path}
                className={`menu-item repo-item${activeRepo?.path === r.path ? ' active' : ''}`}
                onClick={() => props.onSelectRepo(r)}
              >
                <Icon name="repo" size={15} className="menu-item-icon" />
                <span className="menu-item-label">{r.name}</span>
                <span className="menu-item-sub">{r.path}</span>
                {activeRepo?.path === r.path && <Icon name="check" size={14} className="menu-check" />}
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          <button className="menu-item" onClick={props.onAddRepo}>
            <Icon name="folder" size={15} className="menu-item-icon" />
            <span className="menu-item-label">Add existing repository...</span>
          </button>
          <button className="menu-item" onClick={props.onCreateRepo}>
            <Icon name="plus" size={15} className="menu-item-icon" />
            <span className="menu-item-label">Create new repository...</span>
          </button>
          <button className="menu-item" onClick={props.onCloneRepo}>
            <Icon name="download" size={15} className="menu-item-icon" />
            <span className="menu-item-label">Clone repository...</span>
          </button>
          <button className="menu-item" onClick={props.onScanFolder}>
            <Icon name="search" size={15} className="menu-item-icon" />
            <span className="menu-item-label">Find repositories in a folder...</span>
          </button>
          {activeRepo && (
            <>
              <div className="menu-sep" />
              <button className="menu-item" onClick={props.onOpenTerminal}>
                <Icon name="terminal" size={15} className="menu-item-icon" />
                <span className="menu-item-label">Open in Terminal</span>
              </button>
              <button className="menu-item" onClick={props.onOpenFinder}>
                <Icon name="folder" size={15} className="menu-item-icon" />
                <span className="menu-item-label">Open in File Manager</span>
              </button>
              <button
                className="menu-item danger"
                onClick={() => props.onRemoveRepo(activeRepo)}
              >
                <Icon name="trash" size={15} className="menu-item-icon" />
                <span className="menu-item-label">Remove from list</span>
              </button>
            </>
          )}
        </Dropdown>

        <Dropdown
          width={340}
          disabled={!activeRepo}
          button={(
            <div className="branch-chip">
              <Icon name="branch" size={15} className="branch-icon" />
              <span className="chip-label">{head ? (branch?.detached ? '(detached)' : head) : 'Current branch'}</span>
              <Icon name="chevronDown" size={14} className="chip-chevron" />
            </div>
          )}
        >
          <div className="menu-section-title">Current branch</div>
          <BranchList
            branches={branches}
            current={head}
            onSwitch={props.onSwitchBranch}
            onCreate={props.onCreateBranch}
            onMerge={props.onMerge}
            busy={busy === 'switch'}
          />
        </Dropdown>
      </div>

      <div className="toolbar-right">
        <button
          className="btn btn-subtle btn-icon-only"
          onClick={props.onRefresh}
          title="Refresh"
          disabled={busy === 'refresh' || !activeRepo}
        >
          <Icon name="refresh" size={15} className={busy === 'refresh' ? 'spin' : ''} />
        </button>
        {hasRemote && activeRepo && (
          <button
            className="btn btn-subtle"
            onClick={props.onFetch}
            disabled={fetchBusy || !activeRepo}
            title="Fetch from all remotes"
          >
            {fetchBusy ? <span className="spinner" /> : <Icon name="download" size={14} />}
            {fetchBusy ? 'Fetching' : 'Fetch origin'}
          </button>
        )}
        {activeRepo && (
          <button
            className={`btn ${syncDisabled ? 'btn-default' : 'btn-primary'}`}
            onClick={props.onSync}
            disabled={syncDisabled || syncBusy || busy === 'refresh' || busy === 'fetch'}
            title={syncTitle}
          >
            {syncBusy ? <span className="spinner light" /> : <Icon name="sync" size={14} />}
            {syncBusy ? 'Syncing' : syncLabel}
          </button>
        )}
        <ThemePicker theme={props.theme} onSelect={props.onThemeChange} flat={props.flat} onFlatChange={props.onFlatChange} />
      </div>
    </header>
  )
}

function BranchList({
  branches,
  current,
  onSwitch,
  onCreate,
  onMerge,
  busy,
}: {
  branches: string[]
  current: string
  onSwitch: (name: string) => void
  onCreate: (name: string) => void
  onMerge: () => void
  busy: boolean
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const filtered = branches.filter(b => b.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="branch-menu">
      <div className="branch-search">
        <Icon name="search" size={13} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Find a branch"
          autoFocus
        />
      </div>
      {query === '' && branches.length > 0 && (
        <div className="branch-count">
          {branches.length}
          {' '}
          branch
          {branches.length === 1 ? '' : 'es'}
        </div>
      )}
      <div className="branch-list">
        {filtered.map(b => (
          <button
            key={b}
            className={`menu-item branch-item${b === current ? ' active' : ''}`}
            onClick={() => onSwitch(b)}
            disabled={busy || b === current}
          >
            <Icon name="branch" size={14} className="menu-item-icon" />
            <span className="menu-item-label">{b}</span>
            {b === current && <Icon name="check" size={14} className="menu-check" />}
          </button>
        ))}
        {filtered.length === 0 && <div className="menu-empty">No branches found.</div>}
      </div>
      <div className="menu-sep" />
      {creating
        ? (
            <div className="branch-create">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="New branch name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    onCreate(name.trim())
                    setCreating(false)
                    setName('')
                  }
                }}
                autoFocus
              />
              <div className="branch-create-actions">
                <button
                  className="btn btn-subtle btn-small"
                  onClick={() => {
                    setCreating(false)
                    setName('')
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-small"
                  disabled={!name.trim() || busy}
                  onClick={() => {
                    onCreate(name.trim())
                    setCreating(false)
                    setName('')
                  }}
                >
                  Create branch
                </button>
              </div>
            </div>
          )
        : (
            <button className="menu-item" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} className="menu-item-icon" />
              <span className="menu-item-label">New branch...</span>
            </button>
          )}
      <div className="menu-sep" />
      <button className="menu-item" onClick={onMerge} disabled={!current}>
        <Icon name="merge" size={15} className="menu-item-icon" />
        <span className="menu-item-label">Merge into current branch...</span>
      </button>
    </div>
  )
}
