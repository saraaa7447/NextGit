import React, { useState } from 'react'

import type { Repo } from '../types'
import { Button, Modal } from './Common'
import { Icon } from './Icons'

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string
  message: React.ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose} width={440}>
      <div className="confirm-message">{message}</div>
      <div className="confirm-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function CreateRepoModal({
  onClose,
  onCreate,
  busy,
}: {
  onClose: () => void
  onCreate: (name: string, parentPath: string) => void
  busy: boolean
}) {
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [error, setError] = useState('')

  return (
    <Modal title="Create a new repository" onClose={onClose} width={480}>
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
      <div className="confirm-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!name.trim() || !parent || busy}
          onClick={() => {
            if (!parent) return
            onCreate(name.trim(), parent)
          }}
        >
          {busy ? 'Creating...' : 'Create repository'}
        </Button>
      </div>
    </Modal>
  )
}

export function CloneRepoModal({
  onClose,
  onClone,
  busy,
  error: propError,
  onErrorClear,
}: {
  onClose: () => void
  onClone: (url: string, dest: string) => void
  busy: boolean
  error: string
  onErrorClear: () => void
}) {
  const [url, setUrl] = useState('')
  const [dest, setDest] = useState('')
  const [destManual, setDestManual] = useState(false)
  const [error, setError] = useState('')

  const clearErrors = () => {
    setError('')
    onErrorClear()
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

  const canClone = url.trim().length > 0 && dest.trim().length > 0 && !busy

  return (
    <Modal title="Clone a repository" onClose={onClose} width={520}>
      <label className="field">
        <span className="field-label">Repository URL</span>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            clearErrors()
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
              clearErrors()
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
      {(error || propError) && <div className="form-error">{error || propError}</div>}
      <div className="confirm-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!canClone}
          onClick={() => {
            const u = url.trim()
            const d = dest.trim()
            if (!u || !d) {
              setError('Enter a repository URL and a destination folder.')
              return
            }
            onClone(u, d)
          }}
        >
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
    </Modal>
  )
}

export function IdentityModal({
  onClose,
  onSet,
  onOpenTerminal,
  busy,
  error,
  initialName,
  initialEmail,
}: {
  onClose: () => void
  onSet: (name: string, email: string) => void
  onOpenTerminal: () => void
  busy: boolean
  error: string
  initialName: string
  initialEmail: string
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)

  return (
    <Modal title="Set your Git identity" onClose={onClose} width={480}>
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
      <p className="field-hint">
        Prefer the command line? Open a terminal to run
        {' '}
        <code>git config --global ...</code>
        {' '}
        or
        <code>gh auth login</code>
        .
      </p>
      {error && <div className="form-error">{error}</div>}
      <div className="confirm-actions">
        <Button onClick={onOpenTerminal}>Open Terminal</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!name.trim() || !email.trim() || busy}
          onClick={() => onSet(name.trim(), email.trim())}
        >
          {busy ? 'Saving...' : 'Set identity'}
        </Button>
      </div>
    </Modal>
  )
}

export function ScanResultsModal({
  repos,
  onAdd,
  onClose,
  busy,
}: {
  repos: Repo[]
  onAdd: (repos: Repo[]) => void
  onClose: () => void
  busy: boolean
}) {
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
      title={`Found ${repos.length} git repositor${repos.length === 1 ? 'y' : 'ies'}`}
      onClose={onClose}
      width={520}
    >
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
      <div className="confirm-actions">
        <span className="scan-count">
          {selected.size}
          {' '}
          selected
        </span>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={selected.size === 0 || busy}
          onClick={() =>
            onAdd(repos.filter(r => selected.has(r.path)))}
        >
          {busy ? 'Adding...' : `Add ${selected.size} repositor${selected.size === 1 ? 'y' : 'ies'}`}
        </Button>
      </div>
    </Modal>
  )
}
