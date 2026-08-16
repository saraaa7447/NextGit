import React, { useState } from 'react'

import type { Repo } from '../types'
import { Button, Modal } from './Common'
import { Icon } from './Icons'

export function ConfirmWindow({ info }: { info: unknown }) {
  const cfg = (info || {}) as {
    title?: string
    message?: string
    confirmLabel?: string
    danger?: boolean
  }
  const close = () => window.api.modalCancel('confirm')

  return (
    <Modal
      onClose={close}
      footer={(
        <div className="confirm-actions">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant={cfg.danger ? 'danger' : 'primary'}
            onClick={() => window.api.modalResult('confirm', true)}
          >
            {cfg.confirmLabel || 'Confirm'}
          </Button>
        </div>
      )}
    >
      <h2 className="dialog-title">{cfg.title || 'Confirm'}</h2>
      <div className="confirm-message">{cfg.message}</div>
    </Modal>
  )
}

export function CreateRepoWindow() {
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (!busy) window.api.modalCancel('create')
  }

  const create = async () => {
    if (!name.trim() || !parent || busy) return
    setBusy(true)
    setError('')
    const folder = parent.endsWith('/') ? parent + name : parent + '/' + name
    const res = await window.api.createRepo(folder)
    if (!res.ok) {
      setError(res.error || 'Failed to create repository')
      setBusy(false)
      return
    }
    window.api.modalResult('create', { ...res, name: name.trim() })
  }

  return (
    <Modal
      onClose={close}
      footer={(
        <div className="confirm-actions">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !parent || busy}
            onClick={create}
          >
            {busy ? 'Creating...' : 'Create repository'}
          </Button>
        </div>
      )}
    >
      <h2 className="dialog-title">Create a new repository</h2>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          placeholder="my-project"
          autoFocus
        />
      </label>
      <label className="field">
        <span className="field-label">Parent folder</span>
        <div className="field-row">
          <input
            value={parent || ''}
            onChange={() => {}}
            placeholder="Click to choose a folder"
            disabled
          />
          <Button
            onClick={async () => {
              const p = await window.api.chooseFolder()
              if (p) setParent(p)
            }}
          >
            Choose...
          </Button>
        </div>
      </label>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}

export function CloneRepoWindow() {
  const [url, setUrl] = useState('')
  const [dest, setDest] = useState('')
  const [destManual, setDestManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (!busy) window.api.modalCancel('clone')
  }

  const repoNameFromUrl = (u: string) => {
    const t = u.trim().replace(/\/+$/, '')
    const base = t.split('/').pop() || ''
    return base.replace(/\.git$/i, '')
  }

  const suggestDest = async (u: string) => {
    if (destManual) return
    const name = repoNameFromUrl(u)
    if (!name) return
    const home = await window.api.homeDir()
    setDest(`${home}/Documents/GitHub/${name}`)
  }

  const pickFolder = async () => {
    const folder = await window.api.chooseFolder()
    if (!folder) return
    setDestManual(true)
    const name = repoNameFromUrl(url)
    setDest(name ? `${folder}/${name}` : folder)
  }

  const clone = async () => {
    const u = url.trim()
    const d = dest.trim()
    if (!u || !d) {
      setError('Enter a repository URL and a destination folder.')
      return
    }
    setBusy(true)
    setError('')
    const res = await window.api.cloneRepo(u, d)
    if (!res.ok) {
      setError(res.error || 'Clone failed')
      setBusy(false)
      return
    }
    window.api.modalResult('clone', res)
  }

  const canClone = url.trim().length > 0 && dest.trim().length > 0 && !busy

  return (
    <Modal
      onClose={close}
      footer={(
        <div className="confirm-actions">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!canClone} onClick={clone}>
            {busy
              ? (
                  <>
                    <span className="spinner light" />
                    {' '}
                    Cloning...
                  </>
                )
              : (
                  'Clone repository'
                )}
          </Button>
        </div>
      )}
    >
      <h2 className="dialog-title">Clone a repository</h2>
      <label className="field">
        <span className="field-label">Repository URL</span>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
            suggestDest(e.target.value)
          }}
          placeholder="https://github.com/user/repo.git"
          autoFocus
        />
      </label>
      <label className="field">
        <span className="field-label">Destination folder</span>
        <div className="field-row">
          <input
            value={dest}
            onChange={(e) => {
              setDest(e.target.value)
              setDestManual(true)
              setError('')
            }}
            placeholder="~/Documents/GitHub"
          />
          <Button onClick={pickFolder}>Choose...</Button>
        </div>
        <div className="field-hint">
          The repository will be cloned into a folder named &ldquo;
          {repoNameFromUrl(url) || '&lt;repo&gt;'}
          &rdquo;.
        </div>
      </label>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}

export function IdentityWindow({ info }: { info: unknown }) {
  const cfg = (info || {}) as { initialName?: string, initialEmail?: string }
  const [name, setName] = useState(cfg.initialName || '')
  const [email, setEmail] = useState(cfg.initialEmail || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (!busy) window.api.modalCancel('identity')
  }

  const save = async () => {
    if (!name.trim() || !email.trim() || busy) return
    setBusy(true)
    setError('')
    const r = await window.api.setIdentity(name.trim(), email.trim())
    if (!r.ok) {
      setError(r.error || 'Failed to set identity')
      setBusy(false)
      return
    }
    window.api.modalResult('identity', { ok: true })
  }

  return (
    <Modal
      onClose={close}
      footer={(
        <div className="confirm-actions">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !email.trim() || busy}
            onClick={save}
          >
            {busy ? 'Saving...' : 'Set identity'}
          </Button>
        </div>
      )}
    >
      <h2 className="dialog-title">Set your Git identity</h2>
      <p className="confirm-message">
        Git doesn't know who you are, so commits can't be created. Enter a name
        and email address — they will be stored globally in
        {' '}
        <code>~/.gitconfig</code>
        {' '}
        and used for all your repositories.
      </p>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Jane Doe"
          autoFocus
        />
      </label>
      <label className="field">
        <span className="field-label">Email</span>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jane@example.com"
          type="email"
        />
      </label>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}

export function MergeBranchWindow({ info }: { info: unknown }) {
  const cfg = (info || {}) as { repoPath?: string, branches?: string[], current?: string }
  const repoPath = cfg.repoPath || ''
  const others = (cfg.branches || []).filter(b => b !== cfg.current)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filtered = others.filter(b => b.toLowerCase().includes(query.toLowerCase()))

  const close = () => {
    if (!busy) window.api.modalCancel('merge')
  }

  const merge = async () => {
    if (!selected || !repoPath || busy) return
    setBusy(true)
    setError('')
    const r = await window.api.git(repoPath, ['merge', '--no-edit', selected])
    if (r.code !== 0) {
      setError(r.stderr.trim() || 'Merge failed')
      setBusy(false)
      return
    }
    window.api.modalResult('merge', { name: selected })
  }

  return (
    <Modal
      onClose={close}
      footer={(
        <div className="confirm-actions">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!selected || busy} onClick={merge}>
            {busy
              ? (
                  <>
                    <span className="spinner light" />
                    {' '}
                    Merging...
                  </>
                )
              : (
                  'Merge branch'
                )}
          </Button>
        </div>
      )}
    >
      <h2 className="dialog-title">
        Merge another branch into
        {' '}
        {cfg.current || 'current branch'}
      </h2>
      <div className="field">
        <div className="scan-search">
          <Icon name="search" size={13} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Branch to merge"
            autoFocus
          />
        </div>
        <div className="scan-list">
          {filtered.map(b => (
            <div
              key={b}
              className={`scan-item${selected === b ? ' selected' : ''}`}
              onClick={() => setSelected(b)}
            >
              <span className={`scan-check${selected === b ? ' on' : ''}`}>
                {selected === b && <Icon name="check" size={11} />}
              </span>
              <Icon name="branch" size={14} />
              <span className="scan-name">{b}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="scan-item scan-empty">
              No branches available to merge.
            </div>
          )}
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}

export function ScanResultsWindow({ info }: { info: unknown }) {
  const repos = ((info || {}) as { repos?: Repo[] }).repos || []
  const [selected, setSelected] = useState<Set<string>>(
    new Set(repos.map(r => r.path)),
  )
  const [query, setQuery] = useState('')

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()),
  )

  const toggle = (path: string) => {
    const next = new Set(selected)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelected(next)
  }

  return (
    <Modal
      onClose={() => window.api.modalCancel('scan')}
      footer={(
        <div className="confirm-actions">
          <span className="scan-count">
            {selected.size}
            {' '}
            selected
          </span>
          <Button onClick={() => window.api.modalCancel('scan')}>Cancel</Button>
          <Button
            variant="primary"
            disabled={selected.size === 0}
            onClick={() =>
              window.api.modalResult('scan', repos.filter(r => selected.has(r.path)))}
          >
            {`Add ${selected.size} repositor${selected.size === 1 ? 'y' : 'ies'}`}
          </Button>
        </div>
      )}
    >
      <h2 className="dialog-title">
        Found
        {' '}
        {repos.length}
        {' '}
        git repositor
        {repos.length === 1 ? 'y' : 'ies'}
      </h2>
      <div className="scan-search">
        <Icon name="search" size={13} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter repositories"
        />
      </div>
      <div className="scan-list">
        {filtered.map(r => (
          <div
            key={r.path}
            className={`scan-item${selected.has(r.path) ? ' selected' : ''}`}
            onClick={() => toggle(r.path)}
          >
            <span className={`scan-check${selected.has(r.path) ? ' on' : ''}`}>
              {selected.has(r.path) && <Icon name="check" size={11} />}
            </span>
            <Icon name="repo" size={15} />
            <span className="scan-name">{r.name}</span>
            <span className="scan-path">{r.path}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}
