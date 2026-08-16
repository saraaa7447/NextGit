'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  git: (cwd, args) => ipcRenderer.invoke('git', cwd, args),
  getCliPath: () => ipcRenderer.invoke('get-cli-path'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  addRepo: folder => ipcRenderer.invoke('add-repo', folder),
  scanDirectory: dir => ipcRenderer.invoke('scan-directory', dir),
  createRepo: folder => ipcRenderer.invoke('create-repo', folder),
  homeDir: () => ipcRenderer.invoke('home-dir'),
  setIdentity: (name, email) => ipcRenderer.invoke('set-identity', name, email),
  cloneRepo: (url, dest) => ipcRenderer.invoke('clone-repo', url, dest),
  openFolder: folder => ipcRenderer.invoke('open-folder', folder),
  revealFile: filePath => ipcRenderer.invoke('reveal-file', filePath),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  openTerminal: cwd => ipcRenderer.invoke('open-terminal', cwd),
})
