import { execFileSync, spawn } from 'child_process'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const results = []
const check = (cond, label) => {
  results.push([cond, label])
  console.log((cond ? '  ok - ' : '  FAIL - ') + label)
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function launch(repoPath, port) {
  const profile = `/tmp/opencode/egui-profile-${port}`
  rmSync(profile, { recursive: true, force: true })
  const args = ['--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`]
  if (repoPath) args.unshift('.', repoPath)
  else args.unshift('.')
  const child = spawn('node_modules/electron/dist/electron', args, { cwd: process.cwd(), stdio: 'ignore' })
  let page
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      page = list.find(t => t.type === 'page')
      if (page) break
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result)
      pending.delete(m.id)
    }
  }
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id
    pending.set(mid, resolve)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  await send('Runtime.enable')
  return {
    js: async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      return r.result?.value
    },
    close: () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      child.kill('SIGKILL')
    },
  }
}

const setInput = (selector, value) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(proto, 'value').set; s.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`

// source repo with one commit + a couple of files
const SRC = '/tmp/opencode/sourceremote'
rmSync(SRC, { recursive: true, force: true })
rmSync('/tmp/opencode/clonetest', { recursive: true, force: true })
mkdirSync(SRC, { recursive: true })
execFileSync('git', ['init', '-b', 'main', '-q'], { cwd: SRC })
execFileSync('git', ['config', 'user.name', 'Src User'], { cwd: SRC })
execFileSync('git', ['config', 'user.email', 'src@example.com'], { cwd: SRC })
writeFileSync(SRC + '/readme.md', '# Source\n')
writeFileSync(SRC + '/code.ts', 'export const v = 1\n')
execFileSync('git', ['add', '-A'], { cwd: SRC })
execFileSync('git', ['commit', '-qm', 'init source'], { cwd: SRC })

console.log('test: clone via welcome screen')
const app = await launch(null, 9360)
await sleep(4000)

// open clone modal from welcome screen
await app.js(`[...document.querySelectorAll('.welcome-actions button')].find(b => b.textContent.includes('Clone a repository'))?.click()`)
await sleep(600)
const modalTitle = await app.js(`document.querySelector('.modal-header h3')?.textContent`)
check(modalTitle === 'Clone a repository', `clone modal opens (${modalTitle})`)

await app.js(setInput('.modal input', 'file://' + SRC))
await sleep(800)
const suggested = await app.js(`document.querySelector('.modal .field:nth-of-type(2) input')?.value`)
check(suggested?.includes('Documents/GitHub/sourceremote'), `destination auto-filled (${suggested})`)

const DEST = '/tmp/opencode/clonetest/sourceremote'
await app.js(setInput('.modal .field:nth-of-type(2) input', DEST))
await sleep(300)
const hint = await app.js(`document.querySelector('.field-hint')?.textContent`)
check(hint?.includes('sourceremote'), `hint shows repo name (${hint?.trim()})`)

const btnText = await app.js(`[...document.querySelectorAll('.modal .btn-primary')].at(-1)?.textContent`)
check(btnText?.includes('Clone repository'), 'clone button present')

await app.js(`[...document.querySelectorAll('.modal .btn-primary')].at(-1).click()`)
await sleep(5000)
const modalGone = await app.js(`document.querySelector('.modal') === null`)
check(modalGone, 'modal closes after successful clone')
const chip = await app.js(`document.querySelector('.repo-chip .chip-label')?.textContent`)
check(chip === 'sourceremote', `app switches to cloned repo (chip=${chip})`)
const branchChip = await app.js(`document.querySelector('.branch-chip .chip-label')?.textContent`)
check(branchChip === 'main', `branch is main (${branchChip})`)
const commits = execFileSync('git', ['log', '--oneline'], { cwd: DEST, encoding: 'utf8' }).trim().split('\n')
check(commits[0]?.includes('init source'), `cloned repo on disk with commit (${commits[0]})`)
const files = execFileSync('ls', ['-1'], { cwd: DEST, encoding: 'utf8' }).trim().split('\n').sort()
check(files.join(',') === 'code.ts,readme.md', `files cloned (${files.join(',')})`)

// error path: bad URL keeps modal open with inline error
console.log('test: clone failure shows inline error')
await app.js(`document.querySelector('.repo-chip')?.parentElement?.click()`)
await sleep(500)
await app.js(`[...document.querySelectorAll('.menu-item')].find(b => b.textContent.includes('Clone repository'))?.click()`)
await sleep(600)
await app.js(setInput('.modal .field:nth-of-type(1) input', 'file:///tmp/opencode/does-not-exist-xyz'))
await sleep(800)
await app.js(setInput('.modal .field:nth-of-type(2) input', '/tmp/opencode/clonetest/bad'))
await sleep(300)
await app.js(`[...document.querySelectorAll('.modal .btn-primary')].at(-1).click()`)
await sleep(4000)
const stillOpen = await app.js(`document.querySelector('.modal') !== null`)
check(stillOpen, 'modal stays open on failure')
const err = await app.js(`document.querySelector('.form-error')?.textContent`)
check(!!err && err.length > 0, `inline error shown (${err?.slice(0, 40)}...)`)
await app.js(`[...document.querySelectorAll('.modal .btn')].find(b => b.textContent === 'Cancel')?.click()`)
await sleep(300)

app.close()
console.log(results.every(([c]) => c) ? '\nALL CLONE TESTS PASSED' : `\n${results.filter(([c]) => !c).length} CLONE FAILURES`)
process.exit(results.every(([c]) => c) ? 0 : 1)
