import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerFileHandlers } from './ipc/file'
import { registerSettingsHandlers } from './ipc/settings'
import { registerAiHandlers } from './ipc/ai'
import { registerAgentSessionHandlers } from './ipc/agentSession'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f3f3f3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-changed', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-changed', false))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL in development; load the built file otherwise.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerWindowControls(): void {
  const senderWindow = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
  ): BrowserWindow | null => BrowserWindow.fromWebContents(event.sender)

  ipcMain.on('window:minimize', (event) => senderWindow(event)?.minimize())
  ipcMain.on('window:toggle-maximize', (event) => {
    const win = senderWindow(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', (event) => senderWindow(event)?.close())
  ipcMain.handle('window:is-maximized', (event) => senderWindow(event)?.isMaximized() ?? false)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.wordclone.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerWindowControls()
  registerFileHandlers()
  registerSettingsHandlers()
  registerAiHandlers()
  registerAgentSessionHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
