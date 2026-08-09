'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile, spawn } = require('child_process')
const os = require('os')

const isDev = !app.isPackaged

let mainWindow = null

function cliPath() {
  const args = process.argv.slice(1)
  for (const a of args) {
    if (!a.startsWith('-') && a !== 'electron' && a !== 'electron.js' && a !== '.') {
      const p = path.resolve(a)
      if (fs.existsSync(p)) return p
    }
  }
  return null
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1200, workArea.width - 120)
  const height = Math.min(800, workArea.height - 120)
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(940, width),
    minHeight: Math.min(600, height),
    center: true,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    title: 'NextGit',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---------------------------------------------------------------------------
// Git helper
// ---------------------------------------------------------------------------

const MAX_BUFFER = 256 * 1024 * 1024

function runGit(cwd, args, opts = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' }
    execFile(
      'git',
      ['--no-pager', ...args],
      { cwd, env, maxBuffer: MAX_BUFFER, windowsHide: true },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          error: err ? err.message : null,
        })
      }
    )
  })
}

ipcMain.handle('git', async (_evt, cwd, args) => {
  return runGit(cwd, args)
})

// ---------------------------------------------------------------------------
// Repository discovery
// ---------------------------------------------------------------------------

ipcMain.handle('get-cli-path', () => cliPath())

ipcMain.handle('add-repo', async (_evt, folder) => {
  if (!folder) return { ok: false, error: 'No folder given' }
  const top = await runGit(folder, ['rev-parse', '--show-toplevel'])
  if (top.code !== 0) {
    return { ok: false, error: (top.stderr || 'Not a git repository').trim() }
  }
  const root = top.stdout.trim()
  const name = path.basename(root)
  const exists = fs.existsSync(path.join(root, '.git'))
  if (!exists) return { ok: false, error: 'Not a git repository' }
  return { ok: true, path: root, name }
})

ipcMain.handle('choose-folder', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose a folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
})

ipcMain.handle('scan-directory', async (_evt, dir) => {
  const skipDirs = new Set([
    'node_modules', 'target', 'vendor', 'build', 'dist', '.cache',
    '__pycache__', '.git', 'Library', 'bin', 'obj', 'Pods', '.venv', 'venv',
  ])
  const results = []
  const stack = [dir]
  const seen = new Set()
  let guard = 0
  while (stack.length > 0 && guard < 60000) {
    guard++
    const current = stack.pop()
    if (seen.has(current)) continue
    seen.add(current)
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = path.join(current, e.name)
      if (e.name === '.git') {
        const st = fs.lstatSync(full)
        if (st.isDirectory() || st.isFile()) {
          const top = await runGit(current, ['rev-parse', '--show-toplevel'])
          const root = top.code === 0 ? top.stdout.trim() : current
          if (!results.some((r) => r.path === root)) {
            results.push({ path: root, name: path.basename(root) })
          }
        }
        continue
      }
      if (e.isDirectory()) {
        if (skipDirs.has(e.name) || e.name.startsWith('.')) continue
        stack.push(full)
      }
    }
    if (results.length >= 200) break
  }
  return results
})

ipcMain.handle('create-repo', async (_evt, folder) => {
  try {
    fs.mkdirSync(folder, { recursive: true })
  } catch (err) {
    return { ok: false, error: err.message }
  }
  const r = await runGit(folder, ['init', '-b', 'main'])
  if (r.code !== 0) return { ok: false, error: r.stderr.trim() || 'git init failed' }
  return { ok: true, path: folder }
})

ipcMain.handle('home-dir', () => os.homedir())

ipcMain.handle('set-identity', async (_evt, name, email) => {
  if (!name || !email) return { ok: false, error: 'Name and email are required' }
  const home = os.homedir()
  const n = await runGit(home, ['config', '--global', 'user.name', name])
  if (n.code !== 0) return { ok: false, error: n.stderr.trim() || 'Failed to set name' }
  const e = await runGit(home, ['config', '--global', 'user.email', email])
  if (e.code !== 0) return { ok: false, error: e.stderr.trim() || 'Failed to set email' }
  return { ok: true }
})

ipcMain.handle('clone-repo', async (_evt, url, dest) => {
  if (!url || !dest) return { ok: false, error: 'Repository URL and destination are required' }
  const target = path.resolve(dest)
  const parent = path.dirname(target)
  try {
    fs.mkdirSync(parent, { recursive: true })
  } catch (err) {
    return { ok: false, error: err.message }
  }
  const r = await runGit(parent, ['clone', url.trim(), path.basename(target)])
  if (r.code !== 0) {
    const msg = r.stderr.trim() || r.error || 'git clone failed'
    return { ok: false, error: msg }
  }
  return { ok: true, path: target, name: path.basename(target) }
})

// ---------------------------------------------------------------------------
// Misc shell integration
// ---------------------------------------------------------------------------

ipcMain.handle('open-folder', async (_evt, folder) => {
  if (folder) shell.openPath(folder)
  return true
})

ipcMain.handle('reveal-file', async (_evt, filePath) => {
  if (filePath) shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('open-external', async (_evt, url) => {
  if (url) shell.openExternal(url)
  return true
})

ipcMain.handle('open-terminal', async (_evt, cwd) => {
  const candidates = [
    process.env.TERMINAL,
    'gnome-terminal', 'konsole', 'xfce4-terminal', 'mate-terminal',
    'kitty', 'alacritty', 'wezterm', 'tilix', 'x-terminal-emulator', 'xterm',
  ].filter(Boolean)

  const argsFor = {
    'gnome-terminal': ['--', '--working-directory', cwd],
    'konsole': ['--workdir', cwd],
    'xfce4-terminal': ['--working-directory', cwd],
    'mate-terminal': ['--working-directory', cwd],
    'tilix': ['--working-directory', cwd],
    'kitty': ['--directory', cwd],
    'alacritty': ['--working-directory', cwd],
    'wezterm': ['start', '--cwd', cwd],
  }

  for (const term of candidates) {
    if (typeof term !== 'string') continue
    const args = argsFor[term]
    if (args === undefined) continue
    try {
      const child = spawn(term, args, { detached: true, stdio: 'ignore' })
      child.on('error', () => {})
      return true
    } catch {
      // try next
    }
  }
  return false
})
