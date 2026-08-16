import { execFileSync, spawn } from 'child_process'
import { rmSync, writeFileSync } from 'fs'

const PORT = 9336
const SRC = '/tmp/opencode/demorepo'
const REPO = '/tmp/opencode/flowrepo'

setTimeout(() => {
  console.log('  WATCHDOG: forced exit')
  process.exit(2)
}, 60000)

rmSync(REPO, { recursive: true, force: true })
execFileSync('cp', ['-r', SRC, REPO])

const child = spawn(
  'node_modules/electron/dist/electron',
  ['.', REPO, '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`],
  { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'ignore'] },
)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find(t => t.type === 'page')
      if (page) return page
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  throw new Error('no target')
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((resolve) => {
          const mid = ++id
          pending.set(mid, resolve)
          ws.send(JSON.stringify({ id: mid, method, params }))
        })
      },
      close: () => ws.close(),
    })
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result)
        pending.delete(m.id)
      }
    }
    ws.onerror = reject
  })
}

const page = await getTarget()
const c = await connect(page.webSocketDebuggerUrl)
await c.send('Runtime.enable')
const js = async (expr) => {
  const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.value
}

const results = []
const check = (cond, label) => {
  results.push([cond, label])
  console.log((cond ? '  ok - ' : '  FAIL - ') + label)
}

const stagedFiles = () =>
  js(`window.api.git(${JSON.stringify(REPO)}, ['diff', '--cached', '--name-only']).then(r => r.stdout.split('\\n').filter(Boolean))`)
const headMsg = () =>
  js(`window.api.git(${JSON.stringify(REPO)}, ['log', '-1', '--pretty=%s']).then(r => r.stdout.trim())`)

await sleep(3000)
for (let i = 0; i < 30; i++) {
  const n = await js(`document.querySelectorAll('.file-row').length`)
  if (n > 0) break
  await sleep(500)
}
console.log('flow-test: app loaded, files =', await js(`document.querySelectorAll('.file-row').length`))

console.log('flow-test: tracked changes auto-staged on load')
let staged = await stagedFiles()
check(
  ['app.ts', 'engine.ts', 'util.js', 'README.md'].every(f => staged.includes(f)),
  `tracked changes auto-staged on load: ${JSON.stringify(staged)}`,
)
check(!staged.includes('notes.txt'), `untracked file not auto-staged (${JSON.stringify(staged)})`)

console.log('flow-test: uncheck engine.ts')
await js(`[...document.querySelectorAll('.file-row')].find(r => r.querySelector('.file-name')?.textContent === 'engine.ts').querySelector('.file-checkbox').click()`)
await sleep(1500)
staged = await stagedFiles()
check(!staged.includes('engine.ts'), `engine.ts stays unstaged after uncheck (${JSON.stringify(staged)})`)

console.log('flow-test: check engine.ts again')
await js(`[...document.querySelectorAll('.file-row')].find(r => r.querySelector('.file-name')?.textContent === 'engine.ts').querySelector('.file-checkbox').click()`)
await sleep(1500)
staged = await stagedFiles()
check(staged.includes('engine.ts'), `engine.ts staged after check (${JSON.stringify(staged)})`)

console.log('flow-test: unstage all')
await js(`[...document.querySelectorAll('.btn-link')].find(b => b.textContent.includes('Unstage all'))?.click()`)
await sleep(1500)
staged = await stagedFiles()
check(staged.length === 0, `unstage-all left index clean (${JSON.stringify(staged)})`)

console.log('flow-test: stage all')
await js(`[...document.querySelectorAll('.btn-link')].find(b => b.textContent.includes('Stage all'))?.click()`)
await sleep(1500)
staged = await stagedFiles()
check(staged.length === 5, `stage-all staged all 5 files (${JSON.stringify(staged)})`)

console.log('flow-test: commit everything')
await js(`(() => { const el = document.querySelector('.commit-summary'); const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'Commit all via GUI'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`)
await sleep(300)
await js(`document.querySelector('.btn-commit').click()`)
await sleep(2000)
const msg = await headMsg()
check(msg === 'Commit all via GUI', `HEAD message: "${msg}"`)
const files = await js(`document.querySelectorAll('.file-row').length`)
check(files === 0, `0 files remain after commit (${files})`)
const commitDisabled = await js(`document.querySelector('.btn-commit')?.disabled`)
check(commitDisabled === true, `commit button disabled after commit (disabled=${commitDisabled})`)

console.log('flow-test: history now has 2 commits')
await js(`[...document.querySelectorAll('.tab')].find(b => b.textContent.includes('History')).click()`)
await sleep(1500)
const rows = await js(`document.querySelectorAll('.commit-row').length`)
check(rows === 2, `history shows 2 commits (${rows})`)

console.log('flow-test: discard a modified file')
writeFileSync(REPO + '/engine.ts', '\n// discard me\n', { flag: 'a' })
await js(`window.dispatchEvent(new Event('focus'))`)
await sleep(1500)
await js(`[...document.querySelectorAll('.tab')].find(b => b.textContent.includes('Changes')).click()`)
await sleep(800)
const before = await js(`document.querySelectorAll('.file-row').length`)
await js(`[...document.querySelectorAll('.file-row')].find(r => r.querySelector('.file-name')?.textContent === 'engine.ts').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }))`)
await sleep(600)
await js(`[...document.querySelectorAll('.context-item')].find(b => b.textContent.includes('Discard changes'))?.click()`)
await sleep(800)
await js(`[...document.querySelectorAll('.btn')].find(b => b.textContent === 'Discard changes')?.click()`)
await sleep(1500)
const after = await js(`document.querySelectorAll('.file-row').length`)
check(after === before - 1, `discard removed engine.ts from list (${before} -> ${after})`)
const gitStatus = await js(`window.api.git(${JSON.stringify(REPO)}, ['status', '--porcelain']).then(r => r.stdout)`)
check(!gitStatus.includes('engine.ts'), 'engine.ts no longer modified after discard')

c.close()
child.kill()
console.log(results.every(([c]) => c) ? '\nALL FLOW TESTS PASSED' : `\n${results.filter(([c]) => !c).length} FLOW FAILURES`)
process.exit(results.every(([c]) => c) ? 0 : 1)
