import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Toolbar } from './components/Toolbar'
import { ChangesSidebar } from './components/ChangesSidebar'
import { HistorySidebar } from './components/HistorySidebar'
import { DiffView } from './components/DiffView'
import { StatusBar } from './components/StatusBar'
import { Icon } from './components/Icons'
import {
  ConfirmModal,
  CloneRepoModal,
  CreateRepoModal,
  IdentityModal,
  ScanResultsModal,
} from './components/Modals'
import type { BranchInfo, Commit, DiffFilter, FileChange, Repo, RepoStatus, Tab } from './types'
import {
  createBranch,
  createCommit,
  discardFile,
  fetchAll,
  getBranches,
  getCommitDiff,
  getIdentity,
  getLog,
  getRemotes,
  getRepoStatus,
  getStashList,
  getWorkingDiff,
  pullBranch,
  pushBranch,
  stageChanges,
  stashPop,
  stashPush,
  switchBranch,
  undoCommit,
  unstageFiles,
} from './gitService'
import type { DiffFile } from './diffParser'

const REPOS_KEY = 'gd.repos'
const ACTIVE_KEY = 'gd.active'

async function autoStageTracked(
  path: string,
  st: RepoStatus,
  skip: ReadonlySet<string>,
): Promise<RepoStatus> {
  const needs = st.changes.filter(
    (c) =>
      !c.untracked &&
      !c.conflicted &&
      c.worktreeStatus !== ' ' &&
      !skip.has(c.path),
  )
  if (needs.length === 0) return st
  await stageChanges(path, needs)
  return getRepoStatus(path)
}

function applyDiffFilter(changes: FileChange[], filter: DiffFilter): FileChange[] {
  if (filter === 'staged') return changes.filter((c) => c.staged)
  if (filter === 'unstaged')
    return changes.filter(
      (c) => c.untracked || (c.worktreeStatus !== ' ' && c.worktreeStatus !== '?'),
    )
  return changes
}

function isIdentityError(stderr: string): boolean {
  const s = stderr.toLowerCase()
  return (
    s.includes('identity unknown') ||
    s.includes('please tell me who you are') ||
    s.includes('unable to auto-detect email address')
  )
}

interface ConfirmState {
  title: string
  message: React.ReactNode
  confirmLabel: string
  danger?: boolean
  action: () => void
}

export default function App() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [activeRepo, setActiveRepo] = useState<Repo | null>(null)
  const [tab, setTab] = useState<Tab>('changes')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const [branch, setBranch] = useState<BranchInfo | null>(null)
  const [changes, setChanges] = useState<FileChange[]>([])
  const [hasCommits, setHasCommits] = useState(true)
  const [branches, setBranches] = useState<string[]>([])
  const [remotes, setRemotes] = useState<string[]>([])
  const [identity, setIdentity] = useState({ name: 'you', email: 'you@localhost', configured: false })
  const [stashCount, setStashCount] = useState(0)

  const [filter, setFilter] = useState<DiffFilter>('all')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<ReadonlySet<string>>(new Set())
  const [workingDiff, setWorkingDiff] = useState<DiffFile[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffNonce, setDiffNonce] = useState(0)

  const [commits, setCommits] = useState<Commit[]>([])
  const [selectedSha, setSelectedSha] = useState<string | null>(null)
  const [commitDiff, setCommitDiff] = useState<DiffFile[]>([])
  const [commitLoading, setCommitLoading] = useState(false)

  const [initializing, setInitializing] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [createRepoOpen, setCreateRepoOpen] = useState(false)
  const [cloneRepoOpen, setCloneRepoOpen] = useState(false)
  const [cloneError, setCloneError] = useState('')
  const [scanResults, setScanResults] = useState<Repo[] | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const [creatingRepo, setCreatingRepo] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [settingIdentity, setSettingIdentity] = useState(false)
  const [identityError, setIdentityError] = useState('')

  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  const seq = useRef(0)
  const changesRef = useRef<FileChange[]>([])
  const activeRef = useRef<Repo | null>(null)
  const selectedShaRef = useRef<string | null>(null)
  const unstagedRef = useRef<Set<string>>(new Set())
  changesRef.current = changes
  activeRef.current = activeRepo
  selectedShaRef.current = selectedSha

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    window.setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), 3500)
  }, [])

  // ---------------------------------------------------------------- loading
  const loadMeta = useCallback(async (repo: Repo, id?: number) => {
    const [st0, brs, rems, ident, stash] = await Promise.all([
      getRepoStatus(repo.path),
      getBranches(repo.path),
      getRemotes(repo.path),
      getIdentity(repo.path),
      getStashList(repo.path),
    ])
    const st = await autoStageTracked(repo.path, st0, unstagedRef.current)
    if (typeof id === 'number' && id !== seq.current) return
    setBranch(st.branch)
    setChanges(st.changes)
    setHasCommits(st.hasCommits)
    setBranches(brs)
    setRemotes(rems)
    setIdentity(ident)
    setStashCount(stash.length)
  }, [])

  const loadHistory = useCallback(async (repo: Repo, id?: number) => {
    const log = await getLog(repo.path)
    if (typeof id === 'number' && id !== seq.current) return
    setCommits(log)
    const cur = selectedShaRef.current
    if (log.length > 0) {
      if (cur && log.some((c) => c.sha === cur)) return
      setSelectedSha(log[0].sha)
    } else {
      setSelectedSha(null)
      setCommitDiff([])
    }
  }, [])

  const loadRepo = useCallback(
    async (repo: Repo) => {
      const id = ++seq.current
      setInitializing(true)
      setSelectedPath(null)
      setSelectedPaths(new Set())
      setSelectedSha(null)
      setCommitDiff([])
      await Promise.all([loadMeta(repo, id), loadHistory(repo, id)])
      setInitializing(false)
    },
    [loadMeta, loadHistory],
  )

  const refreshStatus = useCallback(
    async (repo?: Repo, opts?: { nonce?: boolean }) => {
      const r = repo || activeRef.current
      if (!r) return
      const st0 = await getRepoStatus(r.path)
      const st = await autoStageTracked(r.path, st0, unstagedRef.current)
      setBranch(st.branch)
      setChanges(st.changes)
      setHasCommits(st.hasCommits)
      if (opts?.nonce) setDiffNonce((n) => n + 1)
      return st
    },
    [],
  )

  // ------------------------------------------------------------ init & poll
  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem(REPOS_KEY) || '[]') as Repo[]
        if (cancelled) return
        setRepos(stored)
        const cli = await window.api.getCliPath()
        if (cli && !cancelled) {
          const res = await window.api.addRepo(cli)
          if (res.ok && res.path) {
            const repo: Repo = { path: res.path, name: res.name || res.path.split('/').pop() || res.path }
            setRepos((prev) => (prev.some((r) => r.path === repo.path) ? prev : [...prev, repo]))
            setActiveRepo(repo)
            return
          }
        }
        const active = localStorage.getItem(ACTIVE_KEY)
        if (active) {
          const found = stored.find((r) => r.path === active)
          if (found) setActiveRepo(found)
        }
      } catch {
        /* ignore */
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeRepo) return
    loadRepo(activeRepo)
  }, [activeRepo, loadRepo])

  useEffect(() => {
    if (!activeRepo) return
    const iv = window.setInterval(() => {
      refreshStatus(activeRepo)
      getLog(activeRepo.path).then((log) => setCommits(log))
    }, 15000)
    const onFocus = () => refreshStatus(activeRef.current || undefined)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(iv)
      window.removeEventListener('focus', onFocus)
    }
  }, [activeRepo, refreshStatus])

  // ctrl+a selects all visible changes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'a' && e.key !== 'A')) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      )
        return
      if (tab !== 'changes' || !activeRepo || changes.length === 0) return
      e.preventDefault()
      const visible = applyDiffFilter(changes, filter)
      setSelectedPaths(new Set(visible.map((c) => c.path)))
      if (visible.length > 0) setSelectedPath(visible[visible.length - 1].path)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, activeRepo, changes, filter])

  // persistence
  useEffect(() => {
    localStorage.setItem(REPOS_KEY, JSON.stringify(repos))
  }, [repos])
  useEffect(() => {
    if (activeRepo) localStorage.setItem(ACTIVE_KEY, activeRepo.path)
  }, [activeRepo])

  // ---------------------------------------------------------- working diff
  useEffect(() => {
    if (!activeRepo || !selectedPath || diffLoading) return
    const repo = activeRepo
    const file = changesRef.current.find((c) => c.path === selectedPath)
    if (!file) return
    let cancelled = false
    setDiffLoading(true)
    getWorkingDiff(repo.path, file, filter, hasCommits)
      .then((d) => {
        if (!cancelled) setWorkingDiff(d)
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeRepo, selectedPath, filter, diffNonce, hasCommits])

  // ------------------------------------------------------------ commit diff
  useEffect(() => {
    if (!activeRepo || !selectedSha || tab !== 'history') return
    let cancelled = false
    setCommitLoading(true)
    getCommitDiff(activeRepo.path, selectedSha)
      .then((d) => {
        if (!cancelled) setCommitDiff(d)
      })
      .finally(() => {
        if (!cancelled) setCommitLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeRepo, selectedSha, tab])

  // ---------------------------------------------------------------- actions
  const selectRepo = (r: Repo) => {
    if (activeRepo?.path !== r.path) setActiveRepo(r)
  }

  const addRepo = async () => {
    const folder = await window.api.chooseFolder()
    if (!folder) return
    const res = await window.api.addRepo(folder)
    if (!res.ok || !res.path) {
      showToast(res.error || 'Not a git repository', 'err')
      return
    }
    const repo: Repo = { path: res.path, name: res.name || res.path.split('/').pop() || res.path }
    setRepos((prev) => (prev.some((r) => r.path === repo.path) ? prev : [...prev, repo]))
    setActiveRepo(repo)
  }

  const scanFolder = async () => {
    const folder = await window.api.chooseFolder()
    if (!folder) return
    setScanBusy(true)
    const results = await window.api.scanDirectory(folder)
    setScanBusy(false)
    const known = new Set(repos.map((r) => r.path))
    const fresh = results.filter((r) => !known.has(r.path))
    setScanResults(fresh)
    if (fresh.length === 0) showToast('No new git repositories found')
  }

  const addScanned = (selected: Repo[]) => {
    setRepos((prev) => {
      const known = new Set(prev.map((r) => r.path))
      return [...prev, ...selected.filter((r) => !known.has(r.path))]
    })
    setScanResults(null)
    if (selected.length > 0) setActiveRepo(selected[0])
  }

  const removeRepo = (r: Repo) => {
    setConfirm({
      title: `Remove "${r.name}" from list?`,
      message: (
        <>
          This only removes the repository from the list. Nothing on disk is
          changed.
        </>
      ),
      confirmLabel: 'Remove repository',
      danger: true,
      action: () => {
        setRepos((prev) => prev.filter((p) => p.path !== r.path))
        if (activeRepo?.path === r.path) {
          setActiveRepo(null)
          setBranch(null)
          setChanges([])
          setCommits([])
          setSelectedSha(null)
          setSelectedPath(null)
        }
        setConfirm(null)
      },
    })
  }

  const createRepo = async (name: string, parentPath: string) => {
    const folder = parentPath.endsWith('/') ? parentPath + name : parentPath + '/' + name
    setCreatingRepo(true)
    const res = await window.api.createRepo(folder)
    setCreatingRepo(false)
    if (!res.ok) {
      showToast(res.error || 'Failed to create repository', 'err')
      return
    }
    const repo: Repo = { path: res.path || folder, name }
    setRepos((prev) => (prev.some((r) => r.path === repo.path) ? prev : [...prev, repo]))
    setCreateRepoOpen(false)
    setActiveRepo(repo)
    showToast(`Repository "${name}" created`)
  }

  const cloneRepo = async (url: string, dest: string) => {
    setCloneError('')
    setCloning(true)
    const res = await window.api.cloneRepo(url, dest)
    setCloning(false)
    if (!res.ok || !res.path) {
      setCloneError(res.error || 'Clone failed')
      return
    }
    const repo: Repo = { path: res.path, name: res.name || res.path.split('/').pop() || res.path }
    setRepos((prev) => (prev.some((r) => r.path === repo.path) ? prev : [...prev, repo]))
    setCloneRepoOpen(false)
    setActiveRepo(repo)
    showToast(`Repository "${repo.name}" cloned`)
  }

  const selectFile = (f: FileChange, multi: boolean) => {
    setSelectedPath(f.path)
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(f.path)) next.delete(f.path)
        else next.add(f.path)
        return next
      }
      return new Set([f.path])
    })
  }

  const toggleStage = async (f: FileChange) => {
    if (!activeRepo || busy) return
    const sel =
      selectedPaths.size > 1 && selectedPaths.has(f.path)
        ? [...selectedPaths]
        : [f.path]
    const targets = changes.filter((c) => sel.includes(c.path))
    const allStaged = targets.length > 0 && targets.every((c) => c.staged)
    if (allStaged) {
      sel.forEach((p) => unstagedRef.current.add(p))
      const r = await unstageFiles(activeRepo.path, sel, hasCommits)
      if (r.code !== 0) showToast(r.stderr, 'err')
    } else {
      sel.forEach((p) => unstagedRef.current.delete(p))
      const r = await stageChanges(activeRepo.path, targets)
      if (r.code !== 0) showToast(r.stderr, 'err')
    }
    await refreshStatus(activeRepo, { nonce: true })
  }

  const stageAll = async () => {
    if (!activeRepo) return
    const unstaged = changes.filter((c) => !c.staged)
    if (unstaged.length === 0) return
    unstagedRef.current.clear()
    await stageChanges(activeRepo.path, unstaged)
    await refreshStatus(activeRepo, { nonce: true })
  }

  const unstageAll = async () => {
    if (!activeRepo) return
    const staged = changes.filter((c) => c.staged)
    if (staged.length === 0) return
    staged.forEach((c) => unstagedRef.current.add(c.path))
    await unstageFiles(activeRepo.path, staged.map((c) => c.path), hasCommits)
    await refreshStatus(activeRepo, { nonce: true })
  }

  const doCommit = async () => {
    if (!activeRepo || !summary.trim() || busy) return
    setBusy('commit')
    const r = await createCommit(activeRepo.path, summary.trim(), description.trim())
    setBusy(null)
    if (r.code !== 0) {
      const msg = r.stderr.split('\n')[0] || 'Commit failed'
      if (isIdentityError(r.stderr)) {
        setIdentityError('')
        setIdentityOpen(true)
        return
      }
      showToast(msg, 'err')
      return
    }
    setSummary('')
    setDescription('')
    unstagedRef.current.clear()
    await refreshStatus(activeRepo, { nonce: true })
    await loadHistory(activeRepo)
    showToast('Committed successfully')
  }

  const openIdentity = () => {
    setIdentityError('')
    setIdentityOpen(true)
  }

  const saveIdentity = async (name: string, email: string) => {
    setSettingIdentity(true)
    setIdentityError('')
    const r = await window.api.setIdentity(name, email)
    setSettingIdentity(false)
    if (!r.ok) {
      setIdentityError(r.error || 'Failed to set identity')
      return
    }
    setIdentityOpen(false)
    if (activeRepo) setIdentity(await getIdentity(activeRepo.path))
    showToast('Git identity saved')
  }

  const requestDiscard = (f: FileChange) => {
    setConfirm({
      title: `Discard changes to "${f.path}"?`,
      message: (
        <>
          This will permanently discard{' '}
          {f.untracked ? 'this untracked file' : 'all uncommitted changes'}.
          This cannot be undone.
        </>
      ),
      confirmLabel: 'Discard changes',
      danger: true,
      action: async () => {
        setConfirm(null)
        if (!activeRepo) return
        await discardFile(activeRepo.path, f)
        await refreshStatus(activeRepo, { nonce: true })
        showToast('Changes discarded')
      },
    })
  }

  const discardByPath = (path: string) => {
    const f = changesRef.current.find((c) => c.path === path)
    if (f) requestDiscard(f)
  }

  const requestUndoCommit = () => {
    const last = commits[0]
    setConfirm({
      title: 'Undo this commit?',
      message: (
        <>
          This will undo the commit
          <strong> {last ? `"${last.summary}"` : ''}</strong> and keep the
          changes staged in your working directory.
          {branch?.ahead ? ' The commit has already been pushed.' : ''}
        </>
      ),
      confirmLabel: 'Undo commit',
      danger: true,
      action: async () => {
        setConfirm(null)
        if (!activeRepo) return
        setBusy('undo')
        await undoCommit(activeRepo.path)
        setBusy(null)
        await refreshStatus(activeRepo, { nonce: true })
        await loadHistory(activeRepo)
        showToast('Commit undone')
      },
    })
  }

  const switchTo = async (name: string) => {
    if (!activeRepo || name === branch?.head) return
    setBusy('switch')
    const r = await switchBranch(activeRepo.path, name)
    setBusy(null)
    if (r.code !== 0) {
      showToast(r.stderr.split('\n')[0] || 'Failed to switch branch', 'err')
      return
    }
    await loadRepo(activeRepo)
  }

  const newBranch = async (name: string) => {
    if (!activeRepo) return
    const r = await createBranch(activeRepo.path, name)
    if (r.code !== 0) {
      showToast(r.stderr.split('\n')[0] || 'Failed to create branch', 'err')
      return
    }
    await loadRepo(activeRepo)
  }

  const doFetch = async () => {
    if (!activeRepo) return
    setBusy('fetch')
    const r = await fetchAll(activeRepo.path)
    setBusy(null)
    if (r.code !== 0) {
      showToast(r.stderr.split('\n')[0] || 'Fetch failed', 'err')
    } else {
      await refreshStatus(activeRepo)
      showToast('Fetched from origin')
    }
  }

  const doSync = async () => {
    if (!activeRepo || !branch) return
    let st = branch
    if (!st.upstream || st.gone) {
      setBusy('push')
      const r = await pushBranch(activeRepo.path, st.head, null)
      setBusy(null)
      if (r.code !== 0) return showToast(r.stderr.split('\n')[0] || 'Push failed', 'err')
      await refreshStatus(activeRepo)
      return showToast('Branch published to origin')
    }
    if (st.behind > 0) {
      setBusy('pull')
      const r = await pullBranch(activeRepo.path)
      setBusy(null)
      if (r.code !== 0) {
        return showToast(r.stderr.split('\n')[0] || 'Pull failed', 'err')
      }
    }
    const st2 = await getRepoStatus(activeRepo.path)
    if (st2.branch && st2.branch.ahead > 0) {
      setBusy('push')
      let r = await pushBranch(activeRepo.path, st2.branch.head, st2.branch.upstream)
      if (r.code !== 0 && /\[rejected\]|non-fast-forward|fetch first/i.test(r.stderr)) {
        const pr = await pullBranch(activeRepo.path)
        if (pr.code !== 0) {
          setBusy(null)
          return showToast(pr.stderr.split('\n')[0] || 'Pull failed', 'err')
        }
        r = await pushBranch(activeRepo.path, st2.branch.head, st2.branch.upstream)
      }
      setBusy(null)
      if (r.code !== 0) {
        return showToast(r.stderr.split('\n')[0] || 'Push failed', 'err')
      }
    }
    await refreshStatus(activeRepo)
    showToast('Branch synced with origin')
  }

  const doStash = async () => {
    if (!activeRepo) return
    setBusy('stash')
    const r = await stashPush(activeRepo.path)
    setBusy(null)
    if (r.code !== 0) return showToast(r.stderr.split('\n')[0] || 'Stash failed', 'err')
    await refreshStatus(activeRepo, { nonce: true })
    setStashCount((n) => n + 1)
    showToast('All changes stashed')
  }

  const doPopStash = async () => {
    if (!activeRepo) return
    setBusy('pop')
    const r = await stashPop(activeRepo.path)
    setBusy(null)
    if (r.code !== 0) return showToast(r.stderr.split('\n')[0] || 'Pop failed', 'err')
    await refreshStatus(activeRepo, { nonce: true })
    const list = await getStashList(activeRepo.path)
    setStashCount(list.length)
    showToast('Stash restored')
  }

  const manualRefresh = async () => {
    if (!activeRepo) return
    setBusy('refresh')
    await refreshStatus(activeRepo, { nonce: true })
    await loadHistory(activeRepo)
    setBusy(null)
  }

  const selectedFile = selectedPath ? changes.find((c) => c.path === selectedPath) : null

  // ---------------------------------------------------------------- render
  return (
    <div className="app">
      <Toolbar
        repos={repos}
        activeRepo={activeRepo}
        branch={branch}
        branches={branches}
        hasRemote={remotes.length > 0}
        busy={busy}
        onSelectRepo={selectRepo}
        onRemoveRepo={removeRepo}
        onAddRepo={addRepo}
        onCreateRepo={() => setCreateRepoOpen(true)}
        onCloneRepo={() => setCloneRepoOpen(true)}
        onScanFolder={scanFolder}
        onOpenTerminal={() => activeRepo && window.api.openTerminal(activeRepo.path)}
        onOpenFinder={() => activeRepo && window.api.openFolder(activeRepo.path)}
        onRefresh={manualRefresh}
        onSwitchBranch={switchTo}
        onCreateBranch={newBranch}
        onFetch={doFetch}
        onSync={doSync}
      />

      <div className="tabbar">
        <button
          className={`tab${tab === 'changes' ? ' active' : ''}`}
          onClick={() => setTab('changes')}
        >
          Changes
          {changes.length > 0 && <span className="tab-count">{changes.length}</span>}
        </button>
        <button
          className={`tab${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          History
          {commits.length > 0 && <span className="tab-count">{commits.length}</span>}
        </button>
      </div>

      {!activeRepo ? (
        <div className="welcome">
          <div className="welcome-icon">
            <Icon name="git" size={44} />
          </div>
          <h1>Get started with {repos.length > 0 ? 'a repository' : 'NextGit'}</h1>
          <p>
            {repos.length > 0
              ? 'Select a repository from the list, or add another one.'
              : 'Add an existing repository or create a new one to begin.'}
          </p>
          <div className="welcome-actions">
            {repos.length > 0 ? (
              <button className="btn btn-primary" onClick={() => repos[0] && setActiveRepo(repos[0])}>
                Select a repository
              </button>
            ) : (
              <button className="btn btn-primary" onClick={addRepo}>
                <Icon name="plus" size={15} /> Add repository
              </button>
            )}
            <button className="btn btn-default" onClick={() => setCreateRepoOpen(true)}>
              <Icon name="repo" size={15} /> Create a repository
            </button>
            <button className="btn btn-default" onClick={() => setCloneRepoOpen(true)}>
              <Icon name="download" size={15} /> Clone a repository
            </button>
            <button className="btn btn-default" onClick={scanFolder}>
              <Icon name="search" size={15} /> Find repositories
            </button>
          </div>
          {repos.length === 0 && (
            <p className="welcome-hint">
              Your repositories are stored on this computer only.
            </p>
          )}
        </div>
      ) : initializing ? (
        <div className="loading-full">
          <span className="spinner" /> Loading repository...
        </div>
      ) : (
        <div className="content">
          {tab === 'changes' ? (
            <>
              <aside className="sidebar">
                <ChangesSidebar
                  changes={changes}
                  filter={filter}
                  onFilterChange={setFilter}
                  selectedPaths={selectedPaths}
                  onSelect={selectFile}
                  onToggleStage={toggleStage}
                  onStageAll={stageAll}
                  onUnstageAll={unstageAll}
                  onDiscard={requestDiscard}
                  onReveal={(f) =>
                    activeRepo && window.api.revealFile(`${activeRepo.path}/${f.path}`)
                  }
                  onOpenTerminal={() => activeRepo && window.api.openTerminal(activeRepo.path)}
                  onOpenFinder={() => activeRepo && window.api.openFolder(activeRepo.path)}
                  repoPath={activeRepo.path}
                  branchName={branch?.head || ''}
                  hasCommits={hasCommits}
                  identity={identity}
                  hasIdentity={identity.configured}
                  onOpenIdentity={openIdentity}
                  summary={summary}
                  description={description}
                  onSummaryChange={setSummary}
                  onDescriptionChange={setDescription}
                  onCommit={doCommit}
                  committing={busy === 'commit'}
                  onStash={doStash}
                  onPopStash={doPopStash}
                  stashCount={stashCount}
                />
              </aside>
              <main className="diff-col">
                <DiffView
                  files={workingDiff}
                  loading={diffLoading}
                  filter={filter}
                  onFilterChange={setFilter}
                  onDiscard={selectedFile ? discardByPath : undefined}
                  hasSelection={!!selectedFile}
                  emptyTitle="Select a file to view changes"
                  emptyDesc="Select a changed file to see a preview of your changes."
                />
              </main>
            </>
          ) : (
            <>
              <aside className="sidebar">
                <HistorySidebar
                  commits={commits}
                  selectedSha={selectedSha}
                  onSelect={(c) => setSelectedSha(c.sha)}
                  loading={initializing}
                  branch={branch?.head || null}
                  onUndoCommit={requestUndoCommit}
                  canUndo={commits.length > 0 && !branch?.ahead && hasCommits}
                  onOpenTerminal={() => activeRepo && window.api.openTerminal(activeRepo.path)}
                  onOpenFinder={() => activeRepo && window.api.openFolder(activeRepo.path)}
                />
              </aside>
              <main className="diff-col">
                <DiffView
                  files={commitDiff}
                  loading={commitLoading}
                  hasSelection={!!selectedSha}
                  emptyTitle="Select a commit to view its changes"
                  emptyDesc="Select a commit in the list to see a diff of what it changed."
                />
              </main>
            </>
          )}
        </div>
      )}

      <StatusBar branch={branch} changes={changes} activeRepo={activeRepo?.path || null} busy={busy} />

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'ok' ? (
            <Icon name="check" size={15} />
          ) : (
            <Icon name="x" size={15} />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
      {createRepoOpen && (
        <CreateRepoModal
          onClose={() => setCreateRepoOpen(false)}
          onCreate={createRepo}
          busy={creatingRepo}
        />
      )}
      {cloneRepoOpen && (
        <CloneRepoModal
          onClose={() => setCloneRepoOpen(false)}
          onClone={cloneRepo}
          busy={cloning}
          error={cloneError}
          onErrorClear={() => setCloneError('')}
        />
      )}
      {identityOpen && (
        <IdentityModal
          onClose={() => setIdentityOpen(false)}
          onSet={saveIdentity}
          onOpenTerminal={() => activeRepo && window.api.openTerminal(activeRepo.path)}
          busy={settingIdentity}
          error={identityError}
          initialName={identity.name === 'you' ? '' : identity.name}
          initialEmail={identity.email.endsWith('@localhost') ? '' : identity.email}
        />
      )}
      {scanResults && (
        <ScanResultsModal
          repos={scanResults}
          onAdd={addScanned}
          onClose={() => setScanResults(null)}
          busy={scanBusy}
        />
      )}
    </div>
  )
}
