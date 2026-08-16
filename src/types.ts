export interface Repo {
  path: string
  name: string
}

export interface BranchInfo {
  head: string
  detached: boolean
  upstream: string | null
  ahead: number
  behind: number
  initial: boolean
  gone?: boolean
}

export interface FileChange {
  path: string
  origPath?: string
  indexStatus: string
  worktreeStatus: string
  staged: boolean
  untracked: boolean
  conflicted: boolean
}

export interface Commit {
  sha: string
  shortSha: string
  authorName: string
  authorEmail: string
  timestamp: number
  summary: string
  refs: string
}

export interface RepoStatus {
  branch: BranchInfo | null
  changes: FileChange[]
  hasCommits: boolean
}

export type DiffFilter = 'all' | 'staged' | 'unstaged'
export type Tab = 'changes' | 'history'

export interface GitResult {
  code: number
  stdout: string
  stderr: string
  error: string | null
}

export interface Api {
  git: (cwd: string, args: string[]) => Promise<GitResult>
  getCliPath: () => Promise<string | null>
  chooseFolder: () => Promise<string | null>
  addRepo: (folder: string) => Promise<{ ok: boolean, path?: string, name?: string, error?: string }>
  scanDirectory: (dir: string) => Promise<Repo[]>
  createRepo: (folder: string) => Promise<{ ok: boolean, path?: string, error?: string }>
  homeDir: () => Promise<string>
  setIdentity: (name: string, email: string) => Promise<{ ok: boolean, error?: string }>
  cloneRepo: (url: string, dest: string) => Promise<{ ok: boolean, path?: string, name?: string, error?: string }>
  openFolder: (folder: string) => Promise<boolean>
  revealFile: (filePath: string) => Promise<boolean>
  openExternal: (url: string) => Promise<boolean>
  openTerminal: (cwd: string) => Promise<boolean>
}
