import { spawn, execFileSync } from 'child_process'
import { rmSync, mkdirSync, writeFileSync } from 'fs'

const results = []
const check = (cond, label) => {
  results.push([cond, label])
  console.log((cond ? '  ok - ' : '  FAIL - ') + label)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch(repoPath, port) {
  const child = spawn(
    'node_modules/electron/dist/electron',
    ['.', repoPath, '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'ignore'] },
  )
  let page
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      page = list.find((t) => t.type === 'page')
      if (page) break
    } catch {}
    await sleep(400)
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id
    pending.set(mid, res)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
  }
  await send('Runtime.enable')
  return {
    js: async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      return r.result?.value
    },
    close: () => { ws.close(); child.kill() },
  }
}

const DEMO = '/tmp/opencode/demorepo'

// ---------------- branch creation
console.log('test: branch creation via dropdown')
{
  const app = await launch(DEMO, 9341)
  await sleep(4000)
  await app.js(`document.querySelector('.branch-chip')?.parentElement?.click()`)
  await sleep(700)
  await app.js(`[...document.querySelectorAll('.menu-item')].find(b => b.textContent.includes('New branch'))?.click()`)
  await sleep(500)
  await app.js(`(() => { const el = document.querySelector('.branch-create input'); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'feature/ux'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await sleep(300)
  await app.js(`[...document.querySelectorAll('.branch-create .btn')].find(b => b.textContent.includes('Create branch'))?.click()`)
  await sleep(2500)
  const chip = await app.js(`document.querySelector('.branch-chip .chip-label')?.textContent`)
  check(chip === 'feature/ux', `switched to new branch (chip=${chip})`)
  const branchOut = execFileSync('git', ['branch', '--list'], { cwd: DEMO, encoding: 'utf8' })
  const branches = branchOut.trim().split('\n')
  check(branches.some((b) => b.replace('*', '').trim() === 'feature/ux'), 'branch exists via git')
  const isOpen = await app.js(`document.querySelector('.branch-chip')?.parentElement?.classList.contains('open')`)
  if (!isOpen) {
    await app.js(`document.querySelector('.branch-chip')?.parentElement?.click()`)
    await sleep(500)
  }
  const actives = await app.js(`[...document.querySelectorAll('.branch-item')].filter(b => b.classList.contains('active')).map(b => b.querySelector('.menu-item-label')?.textContent)`)
  check(actives.includes('feature/ux'), `active branch item is feature/ux (${JSON.stringify(actives)})`)
  app.close()
  execFileSync('git', ['switch', 'main', '-q'], { cwd: DEMO })
  execFileSync('git', ['branch', '-D', 'feature/ux'], { cwd: DEMO, stdio: 'ignore' })
}

// ---------------- empty repo first commit
console.log('test: empty repo first commit')
{
  const EMPTY = '/tmp/opencode/emptygui'
  rmSync(EMPTY, { recursive: true, force: true })
  mkdirSync(EMPTY, { recursive: true })
  execFileSync('git', ['init', '-b', 'main', '-q'], { cwd: EMPTY })
  execFileSync('git', ['config', 'user.name', 'New Dev'], { cwd: EMPTY })
  execFileSync('git', ['config', 'user.email', 'new@example.com'], { cwd: EMPTY })
  writeFileSync(EMPTY + '/hello.txt', 'hello world\n')
  const app = await launch(EMPTY, 9342)
  await sleep(4000)
  await app.js(`(() => { const el = document.querySelector('.commit-summary'); const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(el, 'Initial commit'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await sleep(300)
  const commitBtn = await app.js(`document.querySelector('.btn-commit')?.textContent`)
  check(commitBtn?.includes('Commit to main'), `empty repo commit button: "${commitBtn}"`)
  const warn = await app.js(`document.querySelector('.commit-warn')?.textContent`)
  check(warn?.includes('first commit'), 'first-commit warning shown')
  await app.js(`document.querySelector('.file-row .file-checkbox').click()`)
  await sleep(600)
  const staged = await app.js(`document.querySelector('.file-row .file-checkbox .box')?.classList.contains('checked')`)
  check(staged === true, 'untracked file staged via checkbox')
  await app.js(`document.querySelector('.btn-commit').click()`)
  await sleep(1500)
  const toast = await app.js(`document.querySelector('.toast-msg')?.textContent`)
  console.log(`  debug: toast="${toast}"`)
  const emptyNow = await app.js(`document.querySelectorAll('.file-row').length`)
  check(emptyNow === 0, 'file list empty after first commit')
  const headRaw = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: EMPTY, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const head = headRaw
  check(head === 'Initial commit', `first commit created: "${head}"`)
  app.close()
}

console.log(results.every(([c]) => c) ? '\nALL FEATURE TESTS PASSED' : `\n${results.filter(([c]) => !c).length} FEATURE FAILURES`)
process.exit(results.every(([c]) => c) ? 0 : 1)
