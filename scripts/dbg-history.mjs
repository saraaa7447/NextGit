import { spawn } from 'child_process'
import { execFile } from 'child_process'

const PORT = 9334
const repoPath = '/tmp/opencode/demorepo'

const child = spawn(
  'node_modules/electron/dist/electron',
  ['.', repoPath, '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`],
  { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'inherit'] },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await sleep(400)
  }
  throw new Error('no target')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    const events = []
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res) => {
          const mid = ++id
          pending.set(mid, res)
          ws.send(JSON.stringify({ id: mid, method, params }))
        })
      },
      events,
      close: () => ws.close(),
    })
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result)
        pending.delete(m.id)
      } else if (m.method) {
        events.push(m)
      }
    }
    ws.onerror = reject
  })
}

const page = await getTarget()
const c = await connect(page.webSocketDebuggerUrl)
await c.send('Runtime.enable')
await c.send('Log.enable')
const js = async (expr) => {
  const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true })
  return r.result?.value
}

await sleep(4000)
console.log('switching to history')
await js(`[...document.querySelectorAll('.tab')].find(b => b.textContent.includes('History')).click()`)
await sleep(1000)
console.log('right after switch:', await js(`({ loading: document.querySelectorAll('.diff-pane.loading').length, emptyTitle: document.querySelector('.empty-state .empty-title')?.textContent, files: document.querySelectorAll('.diff-file').length, selected: !!document.querySelector('.commit-row.selected'), rows: document.querySelectorAll('.commit-row').length, initializing: !!document.querySelector('.loading-full') })`))
await sleep(2500)
console.log('after 3.5s total:', await js(`({ loading: document.querySelectorAll('.diff-pane.loading').length, emptyTitle: document.querySelector('.empty-state .empty-title')?.textContent, files: document.querySelectorAll('.diff-file').length, paths: [...document.querySelectorAll('.diff-file-path')].map(e=>e.textContent), selected: document.querySelector('.commit-row.selected')?.textContent?.slice(0,40), selectedShaInfo: document.querySelector('.commit-sha')?.textContent })`))

const errs = c.events
  .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
  .map((e) => JSON.stringify(e.params.args?.[0]?.value || e.params.args?.[0]?.description))
console.log('console errors:', errs.slice(0, 10))
const logs = c.events.filter((e) => e.method === 'Log.entryAdded').map((e) => `${e.params.entry.level}: ${e.params.entry.text}`)
console.log('log entries:', logs.slice(0, 15))
c.close()
child.kill()
process.exit(0)
