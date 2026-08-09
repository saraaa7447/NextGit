import { execFile } from 'child_process'

declare const global: any

const runGit = (cwd: string, args: string[]) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      'git',
      ['--no-pager', ...args],
      { cwd, maxBuffer: 256 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const e = err as any
        resolve({
          code: err ? (typeof e.code === 'number' ? e.code : 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
        })
      },
    )
  })

global.window = { api: { git: runGit } }
;(process.env as any).USER = 'smoketest'

import {
  displayStatus,
  getBranches,
  getCommitDiff,
  getIdentity,
  getLog,
  getRepoStatus,
  getWorkingDiff,
  unstageFiles,
} from '../src/gitService'
import { countChanges } from '../src/diffParser'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ok - ' + msg)
  } else {
    failures++
    console.error('  FAIL - ' + msg)
  }
}

const repo = '/tmp/opencode/smokerepo'

async function main() {
  console.log('smoke: setting up test repo')
  require('fs').rmSync(repo, { recursive: true, force: true })
  require('fs').mkdirSync(repo, { recursive: true })
  await runGit(repo, ['init', '-b', 'main', '-q'])
  await runGit(repo, ['config', 'user.name', 'Test User'])
  await runGit(repo, ['config', 'user.email', 'test@example.com'])
  require('fs').writeFileSync(repo + '/a.txt', 'a1\na2\n')
  require('fs').writeFileSync(repo + '/b.txt', 'b1\nb2\n')
  require('fs').writeFileSync(repo + '/d.txt', 'd1\n')
  await runGit(repo, ['add', '-A'])
  await runGit(repo, ['commit', '-qm', 'Initial commit'])

  await runGit(repo, ['mv', 'a.txt', 'aa.txt'])
  require('fs').appendFileSync(repo + '/aa.txt', 'a3\n')
  require('fs').appendFileSync(repo + '/b.txt', 'b3\n')
  await runGit(repo, ['add', 'b.txt'])
  require('fs').writeFileSync(repo + '/c.txt', 'c1\n')
  require('fs').unlinkSync(repo + '/d.txt')

  console.log('smoke: status parsing')
  const st = await getRepoStatus(repo)
  assert(!!st.branch, 'branch parsed')
  assert(st.branch?.head === 'main', `head is main (got ${st.branch?.head})`)
  assert(!st.branch?.detached, 'not detached')
  assert(st.hasCommits, 'has commits')

  const byName = (p: string) => st.changes.find((c) => c.path === p)

  const ren = byName('aa.txt')
  assert(!!ren, 'rename entry present')
  assert(ren?.indexStatus === 'R', `rename index status R (got ${ren?.indexStatus})`)
  assert(ren?.worktreeStatus === 'M', `rename worktree status M (got ${ren?.worktreeStatus})`)
  assert(ren?.origPath === 'a.txt', `rename orig path a.txt (got ${ren?.origPath})`)
  assert(ren?.staged, 'rename is staged')
  assert(displayStatus(ren!) === 'R', 'display status R')

  const stg = byName('b.txt')
  assert(stg?.indexStatus === 'M' && stg?.staged, 'staged modify b.txt')

  const del = byName('d.txt')
  assert(del?.worktreeStatus === 'D' && !del?.staged, 'unstaged delete d.txt')
  assert(displayStatus(del!) === 'D', 'display status D for deleted')

  const untr = byName('c.txt')
  assert(untr?.untracked, 'untracked c.txt')
  assert(displayStatus(untr!) === '?', 'display status ?')

  console.log('smoke: log parsing')
  const log = await getLog(repo)
  assert(log.length === 1, `log has 1 commit (got ${log.length})`)
  assert(log[0]?.summary === 'Initial commit', 'log summary correct')
  assert(log[0]?.shortSha.length >= 7, 'short sha present')

  console.log('smoke: working diff parsing')
  const udiff = await getWorkingDiff(repo, ren!, 'unstaged', true)
  assert(udiff.length === 1, 'unstaged diff has 1 file')
  const un = countChanges(udiff)
  assert(un.add === 1, `unstaged diff +1 line (got +${un.add})`)
  const sdiff = await getWorkingDiff(repo, stg!, 'staged', true)
  const sn = countChanges(sdiff)
  assert(sn.add === 1, `staged diff +1 line (got +${sn.add})`)
  const adiff = await getWorkingDiff(repo, untr!, 'unstaged', true)
  assert(adiff.length === 1 && adiff[0].status === 'added', 'untracked diff shows as added file')

  console.log('smoke: commit diff parsing')
  const cdiff = await getCommitDiff(repo, log[0].sha)
  assert(cdiff.length >= 2, 'commit diff has multiple files')

  console.log('smoke: branches / identity')
  const brs = await getBranches(repo)
  assert(brs.includes('main'), 'branches include main')
  const ident = await getIdentity(repo)
  assert(ident.name === 'Test User', 'identity name parsed')

  console.log('smoke: unstage with commits')
  const unRes = await unstageFiles(repo, ['b.txt'], true)
  assert(unRes.code === 0, 'unstage succeeded')
  const st2 = await getRepoStatus(repo)
  assert(!st2.changes.find((c) => c.path === 'b.txt')?.staged, 'b.txt no longer staged')

  console.log('smoke: empty repo')
  const empty = '/tmp/opencode/emptyrepo'
  require('fs').mkdirSync(empty, { recursive: true })
  await runGit(empty, ['init', '-b', 'main', '-q'])
  const est = await getRepoStatus(empty)
  assert(est.branch?.initial === true, 'empty repo flagged as initial')
  assert(!est.hasCommits, 'empty repo has no commits')
  require('fs').writeFileSync(empty + '/x.txt', 'x')
  await runGit(empty, ['add', 'x.txt'])
  const eRes = await unstageFiles(empty, ['x.txt'], false)
  assert(eRes.code === 0, 'unstage on empty repo (rm --cached) succeeded')
  const est2 = await getRepoStatus(empty)
  assert(est2.changes.length === 1 && est2.changes[0].untracked, 'unstaged file is untracked again')

  console.log('smoke: branch with gone upstream')
  const bare = '/tmp/opencode/gone-bare.git'
  const gwork = '/tmp/opencode/gone-work'
  require('fs').rmSync(bare, { recursive: true, force: true })
  require('fs').rmSync(gwork, { recursive: true, force: true })
  require('fs').mkdirSync(gwork, { recursive: true })
  await runGit(gwork, ['init', '-b', 'main', '--bare', bare])
  await runGit(gwork, ['clone', bare, gwork])
  await runGit(gwork, ['config', 'user.name', 'Gone User'])
  await runGit(gwork, ['config', 'user.email', 'gone@example.com'])
  require('fs').writeFileSync(gwork + '/f.txt', 'hello\n')
  await runGit(gwork, ['add', '-A'])
  await runGit(gwork, ['commit', '-qm', 'gone commit'])
  const goneSt = await getRepoStatus(gwork)
  assert(goneSt.branch?.gone === true, 'branch flagged gone when never pushed')
  assert(goneSt.branch?.ahead === 1, `gone branch counts ahead commits (got ${goneSt.branch?.ahead})`)
  const pushRes = await runGit(gwork, ['push', '-u', 'origin', 'main'])
  assert(pushRes.code === 0, 'push of gone branch succeeds')
  const afterSt = await getRepoStatus(gwork)
  assert(afterSt.branch?.gone !== true && afterSt.branch?.ahead === 0, 'branch no longer gone after push')

  console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
