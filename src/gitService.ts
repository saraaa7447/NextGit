import type { BranchInfo, Commit, FileChange, GitResult, RepoStatus } from './types'
import { parseDiff, type DiffFile } from './diffParser'

export function git(cwd: string, args: string[]) {
  return window.api.git(cwd, args)
}

function parseBranchHeader(header: string): BranchInfo {
  const br: BranchInfo = {
    head: '',
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    initial: false,
  }
  const m = /^## (.+)$/.exec(header)
  if (!m) return br
  const rest = m[1]

  const aheadM = /\[ahead (\d+)(?:, behind (\d+))?\]/.exec(rest)
  if (aheadM) {
    br.ahead = parseInt(aheadM[1], 10) || 0
    br.behind = parseInt(aheadM[2] || '0', 10) || 0
  }
  if (/\[gone\]/.test(rest)) {
    br.gone = true
  }

  let main = rest.split(' [')[0]
  if (main.startsWith('No commits yet on ')) {
    br.head = main.slice('No commits yet on '.length)
    br.initial = true
    return br
  }
  if (main === 'HEAD (no branch)') {
    br.detached = true
    return br
  }
  const idx = main.indexOf('...')
  if (idx === -1) {
    br.head = main
    return br
  }
  br.head = main.slice(0, idx)
  br.upstream = main.slice(idx + 3) || null
  return br
}

function parseChange(
  path: string,
  origPath: string | undefined,
  X: string,
  Y: string,
): FileChange {
  const untracked = X === '?' && Y === '?'
  const conflicted = X === 'U' || Y === 'U'
  const staged = !untracked && !conflicted && X !== ' ' && X !== '!'
  return { path, origPath, indexStatus: X, worktreeStatus: Y, staged, untracked, conflicted }
}

export function displayStatus(f: FileChange): string {
  if (f.conflicted) return 'U'
  if (f.untracked) return '?'
  if (f.indexStatus !== ' ' && f.indexStatus !== '!') return f.indexStatus
  return f.worktreeStatus
}

export function isRepoPath(cwd: string): Promise<boolean> {
  return git(cwd, ['rev-parse', '--is-inside-work-tree']).then(
    (r) => r.code === 0,
  )
}

export async function getRepoStatus(cwd: string): Promise<RepoStatus> {
  const hasCommits =
    (await git(cwd, ['rev-parse', '--verify', 'HEAD'])).code === 0
  const r = await git(cwd, [
    'status',
    '--porcelain=v1',
    '-z',
    '-uall',
    '--branch',
  ])
  if (r.code !== 0) {
    return { branch: null, changes: [], hasCommits }
  }

  const entries = r.stdout.split('\0').filter((s) => s.length > 0)
  let i = 0
  let branch: BranchInfo | null = null
  if (entries[0]?.startsWith('##')) {
    branch = parseBranchHeader(entries[0])
    i = 1
  }
  if (branch?.gone && branch.upstream) {
    const remote = branch.upstream.split('/')[0]
    const count = await git(cwd, ['rev-list', '--count', 'HEAD', '--not', `--remotes=${remote}`])
    if (count.code === 0) branch.ahead = parseInt(count.stdout.trim(), 10) || 0
  }
  const changes: FileChange[] = []
  for (; i < entries.length; i++) {
    const e = entries[i]
    if (e.length < 3) continue
    const X = e[0]
    const Y = e[1]
    const path = e.slice(3)
    let origPath: string | undefined
    if (X === 'R' || X === 'C') {
      origPath = entries[++i]
    }
    changes.push(parseChange(path, origPath, X, Y))
  }
  return { branch, changes, hasCommits }
}

export function getBranches(cwd: string): Promise<string[]> {
  return git(cwd, ['for-each-ref', 'refs/heads', '--format=%(refname:short)']).then(
    (r) => (r.code === 0 ? r.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : []),
  )
}

export function getRemotes(cwd: string): Promise<string[]> {
  return git(cwd, ['remote']).then((r) =>
    r.code === 0 ? r.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : [],
  )
}

export async function getIdentity(cwd: string): Promise<{
  name: string
  email: string
  configured: boolean
}> {
  const [n, e] = await Promise.all([
    git(cwd, ['config', '--get', 'user.name']),
    git(cwd, ['config', '--get', 'user.email']),
  ])
  const name = n.stdout.trim()
  const email = e.stdout.trim()
  return {
    name: name || process.env.USER || 'you',
    email: email || `${process.env.USER || 'you'}@localhost`,
    configured: !!(name && email),
  }
}

export async function getLog(cwd: string, n = 200): Promise<Commit[]> {
  const r = await git(cwd, [
    'log',
    '-n',
    String(n),
    '--date-order',
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D%x1e',
  ])
  if (r.code !== 0) return []
  return r.stdout
    .split('\x1e')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\x1f')
      return {
        sha: parts[0] || '',
        shortSha: parts[1] || '',
        authorName: parts[2] || '',
        authorEmail: parts[3] || '',
        timestamp: parseInt(parts[4] || '0', 10),
        summary: parts[5] || '',
        refs: parts[6] || '',
      }
    })
}

export function getCommitDiff(cwd: string, sha: string): Promise<DiffFile[]> {
  return git(cwd, ['show', sha, '--no-ext-diff', '--unified=3', '--format=']).then(
    (r) => parseDiff(r.stdout),
  )
}

export async function getWorkingDiff(
  cwd: string,
  file: FileChange,
  filter: 'all' | 'staged' | 'unstaged',
  hasCommits: boolean,
): Promise<DiffFile[]> {
  let args: string[]
  if (file.untracked) {
    args = ['diff', '--no-index', '-M', '--unified=3', '--', '/dev/null', file.path]
  } else if (filter === 'staged') {
    args = ['diff', '--cached', '-M', '--unified=3', '--', file.path]
  } else if (filter === 'unstaged') {
    args = ['diff', '-M', '--unified=3', '--', file.path]
  } else if (hasCommits) {
    args = ['diff', 'HEAD', '-M', '--unified=3', '--', file.path]
  } else {
    args = ['diff', '--cached', '-M', '--unified=3', '--', file.path]
  }
  const r = await git(cwd, args)
  return parseDiff(r.stdout)
}

export const stageFiles = (cwd: string, paths: string[]) =>
  git(cwd, ['add', '--', ...paths])

export async function stageChanges(cwd: string, changes: FileChange[]) {
  const tracked = changes.filter((c) => !c.untracked)
  const untracked = changes.filter((c) => c.untracked)
  const results: GitResult[] = []
  if (tracked.length > 0) {
    results.push(await git(cwd, ['add', '-u', '--', ...tracked.map((c) => c.path)]))
  }
  if (untracked.length > 0) {
    results.push(await git(cwd, ['add', '--', ...untracked.map((c) => c.path)]))
  }
  return results.find((r) => r.code !== 0) || results[0] || { code: 0, stdout: '', stderr: '' }
}

export async function unstageFiles(
  cwd: string,
  paths: string[],
  hasCommits: boolean,
) {
  if (hasCommits) {
    return git(cwd, ['reset', 'HEAD', '--', ...paths])
  }
  return git(cwd, ['rm', '--cached', '-r', '--', ...paths])
}

export function createCommit(cwd: string, summary: string, description: string) {
  const args = ['commit', '-m', summary]
  if (description) args.push('-m', description)
  return git(cwd, args)
}

export const switchBranch = (cwd: string, name: string) =>
  git(cwd, ['switch', name])

export const createBranch = (cwd: string, name: string) =>
  git(cwd, ['switch', '-c', name])

export const fetchAll = (cwd: string) => git(cwd, ['fetch'])

export const pullBranch = (cwd: string) => git(cwd, ['pull'])

export function pushBranch(cwd: string, branch: string, upstream: string | null) {
  if (upstream) return git(cwd, ['push'])
  return git(cwd, ['push', '-u', 'origin', branch])
}

export async function discardFile(cwd: string, file: FileChange) {
  if (file.untracked) return git(cwd, ['clean', '-f', '--', file.path])
  if (file.staged) {
    if (file.indexStatus === 'A') {
      return git(cwd, ['rm', '-f', '-r', '--', file.path])
    }
    return git(cwd, ['checkout', 'HEAD', '--', file.path])
  }
  return git(cwd, ['checkout', '--', file.path])
}

export const undoCommit = (cwd: string) => git(cwd, ['reset', '--soft', 'HEAD~1'])

export const stashPush = (cwd: string) =>
  git(cwd, ['stash', 'push', '-u', '-m', 'Stashed changes'])

export const stashPop = (cwd: string) => git(cwd, ['stash', 'pop'])

export const getStashList = (cwd: string) =>
  git(cwd, ['stash', 'list']).then((r) =>
    r.code === 0 ? r.stdout.split('\n').filter((l) => l.trim().length > 0) : [],
  )

export function initRepo(folder: string) {
  return git(folder, ['init'])
}
