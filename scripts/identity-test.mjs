import { spawn, execFileSync } from 'child_process'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const results = []
const check = (cond, label) => {
  results.push([cond, label])
  console.log((cond ? '  ok - ' : '  FAIL - ') + label)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const REPO = '/tmp/opencode/identityrepo'
let app = null

function launch(repoPath, port) {
  const profile = `/tmp/opencode/igui-profile-${port}`
  rmSync(profile, { recursive: true, force: true })
  const child = spawn(
    'node_modules/electron/dist/electron',
    ['.', repoPath, '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
    { cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: '/tmp/opencode/test-global-config' } },
  )
  let page
  const poll = async () => {
    for (let i = 0; i < 60; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        page = list.find((t) => t.type === 'page')
        if (page) break
      } catch {}
      await sleep(400)
    }
  }
  return poll().then(async () => {
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    let id = 0
    const pending = new Map()
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
    }
    const send = (method, params = {}) => new Promise((res) => {
      const mid = ++id
      pending.set(mid, res)
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
    await send('Runtime.enable')
    app = {
      js: async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
        return r.result?.value
      },
      close: () => { try { ws.close() } catch {} child.kill('SIGKILL') },
    }
    return app
  })
}

const setInput = (selector, value) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(proto, 'value').set; s.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`

async function main() {
  rmSync(REPO, { recursive: true, force: true })
  rmSync('/tmp/opencode/test-global-config', { force: true })
  mkdirSync(REPO, { recursive: true })
  execFileSync('git', ['init', '-b', 'main', '-q'], { cwd: REPO })
  writeFileSync(REPO + '/a.txt', 'hello\n')

  const port = 9500 + Math.floor(Math.random() * 100)
  await launch(REPO, port)
  await sleep(4000)

  const waitFor = async (expr, tries = 15) => {
    for (let i = 0; i < tries; i++) {
      if (await app.js(expr)) return true
      await sleep(400)
    }
    return false
  }

  const warnVisible = await waitFor(`document.querySelector('.identity-warn-btn') !== null`)
  check(warnVisible, 'identity warning shown when not configured')

  await app.js(setInput('.commit-summary', 'Commit with identity'))
  await sleep(300)
  await app.js(`document.querySelector('.btn-commit').click()`)
  const modalOpened = await waitFor(`document.querySelector('.modal-header h3')?.textContent === 'Set your Git identity'`)
  check(modalOpened, 'commit failure opens identity modal')

  const termBtn = await app.js(`[...document.querySelectorAll('.modal .btn')].some(b => b.textContent.includes('Open Terminal'))`)
  check(termBtn, 'Open Terminal button present in modal')

  await app.js(setInput('.modal .field:nth-of-type(1) input', 'Test Dev'))
  await app.js(setInput('.modal .field:nth-of-type(2) input', 'dev@example.com'))
  await sleep(200)
  await app.js(`[...document.querySelectorAll('.modal .btn-primary')].at(-1).click()`)
  await waitFor(`document.querySelector('.modal') === null`)
  const modalClosed = await app.js(`document.querySelector('.modal') === null`)
  check(modalClosed, 'identity modal closes after saving')
  const warnGone = await waitFor(`document.querySelector('.identity-warn-btn') === null`)
  check(warnGone, 'identity warning disappears after saving')
  const author = await app.js(`document.querySelector('.commit-author-name')?.textContent`)
  check(author === 'Test Dev', `commit box shows saved identity (${author})`)

  await app.js(`document.querySelector('.file-row .file-checkbox').click()`)
  await sleep(600)
  await app.js(`document.querySelector('.btn-commit').click()`)
  await waitFor(`document.querySelectorAll('.file-row').length === 0`)
  const committed = await app.js(`document.querySelectorAll('.file-row').length`)
  check(committed === 0, 'commit succeeds after setting identity')
  const logAuthor = execFileSync('git', ['log', '-1', '--pretty=%an|%ae'], { cwd: REPO, encoding: 'utf8' }).trim()
  check(logAuthor === 'Test Dev|dev@example.com', `commit author on disk (${logAuthor})`)

  const overflow = await app.js(`(() => {
    const side = document.querySelector('.sidebar').getBoundingClientRect()
    const btn = document.querySelector('.btn-commit').getBoundingClientRect()
    return { btnRight: Math.round(btn.right), sideRight: Math.round(side.right), ok: btn.right <= side.right + 1 }
  })()`)
  check(overflow.ok, `commit button inside sidebar border (btnRight=${overflow.btnRight} sideRight=${overflow.sideRight})`)

  await app.js(`window.resizeTo(1000, 620)`)
  await sleep(600)
  const overflow2 = await app.js(`(() => {
    const side = document.querySelector('.sidebar').getBoundingClientRect()
    const btn = document.querySelector('.btn-commit').getBoundingClientRect()
    return { btnRight: Math.round(btn.right), sideRight: Math.round(side.right), ok: btn.right <= side.right + 1 }
  })()`)
  check(overflow2.ok, `commit button inside border at 1000px window (btnRight=${overflow2.btnRight} sideRight=${overflow2.sideRight})`)
}

try {
  await main()
} finally {
  if (app) app.close()
}
console.log(results.every(([c]) => c) ? '\nALL IDENTITY TESTS PASSED' : `\n${results.filter(([c]) => !c).length} IDENTITY FAILURES`)
process.exit(results.every(([c]) => c) ? 0 : 1)
