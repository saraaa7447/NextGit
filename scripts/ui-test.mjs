import { spawn } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'

const PORT = 9333
const OUT = '/tmp/opencode/ui'
mkdirSync(OUT, { recursive: true })

const repoPath = process.argv[2]
if (!repoPath) {
  console.error('usage: node scripts/ui-test.mjs <repo-path>')
  process.exit(1)
}

const child = spawn(
  'node_modules/electron/dist/electron',
  ['.', repoPath, '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`],
  { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
)
child.stderr.on('data', (d) => process.stderr.write('  [app] ' + d))
child.stdout.on('data', (d) => process.stdout.write('  [app] ' + d))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await r.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {
      /* retry */
    }
    await sleep(500)
  }
  throw new Error('no CDP page target')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const mid = ++id
            pending.set(mid, { res, rej })
            ws.send(JSON.stringify({ id: mid, method, params }))
          })
        },
        close: () => ws.close(),
      })
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) {
        pending.get(m.id).res(m.result)
        pending.delete(m.id)
      }
    }
    ws.onerror = reject
  })
}

const page = await getTarget()
const c = await connect(page.webSocketDebuggerUrl)
await c.send('Page.enable')
await c.send('Runtime.enable')

const js = async (expression) => {
  const r = await c.send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails) {
    return { error: JSON.stringify(r.exceptionDetails).slice(0, 300) }
  }
  return r.result?.value
}

const shot = async (name) => {
  const r = await c.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'))
}

const results = []
function check(cond, label) {
  results.push([cond, label])
  console.log((cond ? '  ok - ' : '  FAIL - ') + label)
}

console.log('ui-test: waiting for repo to load')
await sleep(5000)

console.log('ui-test: changes tab')
let info = await js(`({
  repoChip: document.querySelector('.repo-chip .chip-label')?.textContent,
  branchChip: document.querySelector('.branch-chip .chip-label')?.textContent,
  files: document.querySelectorAll('.file-row').length,
  badges: [...document.querySelectorAll('.file-row .status-badge')].map(b => b.textContent),
  syncBtn: document.querySelector('.toolbar-right .btn-primary')?.textContent?.trim(),
  commitBtn: document.querySelector('.btn-commit')?.textContent?.trim(),
  commitSummaryPlaceholder: document.querySelector('.commit-summary')?.placeholder,
})`)
check(info.repoChip === 'demorepo', `repo chip shows demorepo (${info.repoChip})`)
check(info.branchChip === 'main', `branch chip shows main (${info.branchChip})`)
check(info.files === 5, `5 changed files listed (${info.files})`)
check(info.badges.includes('Modified') && info.badges.includes('Added') && info.badges.includes('Deleted') && info.badges.includes('Untracked'),
  `status badges: ${JSON.stringify(info.badges)}`)
check(info.commitBtn?.includes('Commit to main'), `commit button targets main (${info.commitBtn})`)
await shot('changes-tab')

console.log('ui-test: select a file -> diff')
await js(`[...document.querySelectorAll('.file-row')].find(r => r.querySelector('.file-name')?.textContent === 'app.ts').click()`)
await sleep(1200)
let diff = await js(`({
  fileCount: document.querySelectorAll('.diff-file').length,
  diffPath: document.querySelector('.diff-file-path')?.textContent,
  addLines: document.querySelectorAll('.diff-line.add').length,
  delLines: document.querySelectorAll('.diff-line.del').length,
  hasHunkHeader: !!document.querySelector('.diff-hunk-header'),
})`)
check(diff.fileCount === 1, `diff shows 1 file (${diff.fileCount})`)
check(diff.addLines > 0, `diff has + lines (${diff.addLines})`)
check(diff.hasHunkHeader, 'diff hunk header rendered')
check(diff.diffPath === 'app.ts', `diff path is app.ts (${diff.diffPath})`)
await shot('diff-view')

console.log('ui-test: select staged file -> staged filter')
await js(`[...document.querySelectorAll('.file-row')].find(r => r.querySelector('.file-name')?.textContent === 'util.js').click()`)
await sleep(1000)
await js(`[...document.querySelectorAll('.diff-toolbar .segmented-btn')].find(b => b.textContent === 'Staged').click()`)
await sleep(1200)
diff = await js(`({ path: document.querySelector('.diff-file-path')?.textContent, adds: document.querySelectorAll('.diff-line.add').length })`)
check(diff.path === 'util.js', `staged diff shows util.js (${diff.path})`)
check(diff.adds > 0, `staged diff has additions (${diff.adds})`)
await shot('diff-staged')

console.log('ui-test: history tab')
await js(`[...document.querySelectorAll('.tab')].find(b => b.textContent.includes('History')).click()`)
await sleep(2000)
let hist = await js(`({
  rows: document.querySelectorAll('.commit-row').length,
  firstSummary: document.querySelector('.commit-row .commit-summary')?.textContent,
  historyTitle: document.querySelector('.history-title')?.textContent?.trim(),
  undoDisabled: document.querySelector('.history-header .btn')?.disabled,
})`)
check(hist.rows >= 1, `commit list rendered (${hist.rows})`)
check(hist.firstSummary === 'Add project skeleton', `first commit summary (${hist.firstSummary})`)
check(hist.historyTitle?.includes('main'), `history of main (${hist.historyTitle})`)
await shot('history-tab')

console.log('ui-test: select commit -> diff')
await js(`document.querySelector('.commit-row').click()`)
await sleep(2000)
const cdiff = await js(`({ files: document.querySelectorAll('.diff-file').length, adds: document.querySelectorAll('.diff-line.add').length })`)
check(cdiff.files >= 2, `commit diff has files (${cdiff.files})`)
check(cdiff.adds > 0, `commit diff has additions (${cdiff.adds})`)
await shot('history-diff')

console.log('ui-test: repo menu open')
await js(`document.querySelector('.repo-chip')?.parentElement?.click()`)
await sleep(600)
const menu = await js(`({ items: [...document.querySelectorAll('.menu-item')].map(i => i.textContent.trim()).filter(Boolean).slice(0,8) })`)
check(menu.items.length > 0, `repo dropdown items: ${JSON.stringify(menu.items.slice(0,4))}`)
await shot('repo-menu')

console.log('ui-test: status bar')
const status = await js(`document.querySelector('.status-bar')?.textContent?.trim()`)
check(status && status.includes('main'), `status bar: ${status}`)

console.log(results.every(([c]) => c) ? '\nALL UI TESTS PASSED' : `\n${results.filter(([c]) => !c).length} UI FAILURES`)
await shot('final')
c.close()
child.kill()
process.exit(results.every(([c]) => c) ? 0 : 1)
