import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, globalShortcut, ipcMain, session } from 'electron'

import { WebSocket } from 'ws'
import {
  computeMD5,
  CONFIG,
  decryptAESECB,
  encryptAESECB,
  executeRequest,
  LOGIN_CONFIG,
  randomBase64String,
} from './encrypt'

const VITE_DEV_SERVER_URL = process.env.DS_RENDERER_URL
const TARGET_HOST = 'minesweeper.natapp1.cc'
export const TARGET_BASE_URL = `http://${TARGET_HOST}`

let mainWindow: BrowserWindow | null = null
let chaosWs: WebSocket | null = null

// ==================== Credential Storage ====================

interface Credentials {
  uid: string
  token: string
  password: string
}

function getCredPath(): string {
  return path.join(app.getPath('userData'), 'credentials.json')
}

function loadCredentials(): Credentials | null {
  try {
    const p = getCredPath()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  }
  catch (e) {
    console.error('[Main] Failed to load credentials:', e)
  }
  return null
}

function saveCredentials(creds: Credentials): void {
  try {
    fs.writeFileSync(getCredPath(), JSON.stringify(creds, null, 2))
  }
  catch (e) {
    console.error('[Main] Failed to save credentials:', e)
  }
}

function deleteCredentials(): void {
  try {
    const p = getCredPath()
    if (fs.existsSync(p)) {
      fs.unlinkSync(p)
    }
  }
  catch (e) {
    console.error('[Main] Failed to delete credentials:', e)
  }
}

function clearCredentials(): void {
  CONFIG.uid = ''
  CONFIG.token = ''
  LOGIN_CONFIG.uid = ''
  LOGIN_CONFIG.token = ''
}

function applyCredentials(uid: string, token: string): void {
  CONFIG.uid = uid
  CONFIG.token = token
  LOGIN_CONFIG.uid = uid
  LOGIN_CONFIG.token = token
}

// ==================== WebSocket Proxy ====================

function makeHeaders(): any {
  const timeStamp = Date.now().toString()
  const apiKey = computeMD5(`${CONFIG.uid + CONFIG.token + timeStamp}api`)
  return {
    'Upgrade': 'websocket',
    'Connection': 'Upgrade',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Extensions': 'permessage-deflate',
    'Sec-WebSocket-Key': randomBase64String(),
    'device': 'OPD2413',
    'version': '30610',
    'channel': 'App',
    'token': CONFIG.token,
    'uid': CONFIG.uid,
    'Host': TARGET_HOST,
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.7.2',
    'time-stamp': timeStamp,
    'api-key': apiKey,
  }
}

function disposeChaosWs(): void {
  if (chaosWs) {
    chaosWs.removeAllListeners()
    if (chaosWs.readyState === WebSocket.OPEN || chaosWs.readyState === WebSocket.CONNECTING) {
      chaosWs.terminate()
    }
    chaosWs = null
  }
}

function sendToRenderer(data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ws:message', data)
  }
}

function connectToGameServer(): boolean {
  if (!CONFIG.uid) {
    console.error('[Main] Cannot connect: no uid set')
    return false
  }

  disposeChaosWs()

  const targetUrl = `ws://${TARGET_HOST}/Minesweeper/socket/chaos/${CONFIG.uid}`
  const headers = makeHeaders()

  chaosWs = new WebSocket(targetUrl, { headers })

  chaosWs.on('message', (data) => {
    const decrypted = decryptAESECB(data.toString())
    if (decrypted) {
      // if (!decrypted.includes('chaos/action')) {
      //   console.log('[Recv]:', decrypted)
      // }
      try {
        sendToRenderer(JSON.parse(decrypted))
      }
      catch {
        // ignore parse errors from partial/invalid messages
      }
    }
  })

  chaosWs.on('open', () => {
    console.warn('[Main] Connected to game server')
    sendToRenderer({ url: 'ready' })
  })

  chaosWs.on('close', () => {
    console.warn('[Main] Game server disconnected')
    sendToRenderer({ url: 'disconnect' })
  })

  chaosWs.on('error', (err) => {
    console.error('[Main] Game server WS error:', err.message)
    sendToRenderer({ url: 'disconnect' })
  })

  return true
}

// ==================== Login Flow ====================

async function checkOnlineStatus(): Promise<boolean> {
  try {
    const resp: any = await executeRequest('/Minesweeper/relation/online/push', 'POST', {})
    return resp.code === 200
  }
  catch {
    return false
  }
}

async function doLogin(
  targetUid: string,
  password: string,
): Promise<{ success: boolean, code?: number, msg?: string, data?: any }> {
  try {
    const resp: any = await executeRequest('/Minesweeper/user/home', 'POST', {
      targetUid,
    })

    if (resp.code === 200 && resp.data) {
      if (resp.data.user.password !== password)
        return { success: false, code: resp.code, msg: 'uid或密码错误' }
      const { uid, token } = resp.data.user
      applyCredentials(uid, token)
      saveCredentials({ uid, token, password })
      return { success: true, data: resp.data }
    }
    return { success: false, code: resp.code, msg: resp.msg ?? '' }
  }
  catch (e: any) {
    return { success: false, msg: e.message }
  }
}

// ==================== IPC Handlers ====================

function setupIPC(): void {
  ipcMain.handle('ws:connect', () => {
    return connectToGameServer()
  })

  ipcMain.handle('ws:send', (_event, data: any) => {
    if (chaosWs && chaosWs.readyState === WebSocket.OPEN) {
      // console.log('[Send]:', data)
      chaosWs.send(encryptAESECB(JSON.stringify(data)))
      return true
    }
    console.warn('[Main] Cannot send, target WS not connected')
    return false
  })

  ipcMain.handle('ws:close', () => {
    disposeChaosWs()
    return true
  })

  ipcMain.handle('login:get-credentials', () => {
    return loadCredentials()
  })

  ipcMain.handle('login:check', async () => {
    const creds = loadCredentials()
    if (!creds || !creds.uid || !creds.token) {
      return { loggedIn: false, reason: 'no_credentials' }
    }

    applyCredentials(creds.uid, creds.token)

    const online = await checkOnlineStatus()
    if (online) {
      return { loggedIn: true, uid: creds.uid }
    }

    if (creds.uid && creds.password) {
      const result = await doLogin(creds.uid, creds.password)
      if (result.success) {
        return { loggedIn: true, uid: CONFIG.uid }
      }
      return { loggedIn: false, reason: 'login_failed', msg: result.msg }
    }

    return { loggedIn: false, reason: 'token_expired' }
  })

  ipcMain.handle('login:submit', async (_event, id: string, password: string) => {
    const result = await doLogin(id, password)
    if (result.success) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('login:ask-join', {})
      }
    }
    return result
  })

  ipcMain.handle('login:join-response', (_event, join: boolean) => {
    if (join && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('login:start-game')
    }
    return true
  })

  ipcMain.handle('login:logout', () => {
    disposeChaosWs()
    clearCredentials()
    deleteCredentials()
    return true
  })

  // Register
  ipcMain.handle('register:send-code', async (_event, mail: string) => {
    try {
      const resp: any = await executeRequest('/Minesweeper/code/register/mail', 'POST', { mail })
      return { success: resp.code === 200, code: resp.code, msg: resp.msg }
    }
    catch (e: any) {
      return { success: false, msg: e.message }
    }
  })

  ipcMain.handle('register:submit', async (_event, mail: string, code: string, password: string) => {
    try {
      const resp: any = await executeRequest('/Minesweeper/user/register/mail', 'POST', { mail, code, password, platform: '0' })
      return { success: resp.code === 200, code: resp.code, msg: resp.msg, data: resp.data }
    }
    catch (e: any) {
      return { success: false, msg: e.message }
    }
  })

  // Password reset
  ipcMain.handle('password:send-code', async (_event, mail: string) => {
    try {
      const resp: any = await executeRequest('/Minesweeper/code/password/reset/mail', 'POST', { mail })
      return { success: resp.code === 200, code: resp.code, msg: resp.msg }
    }
    catch (e: any) {
      return { success: false, msg: e.message }
    }
  })

  ipcMain.handle('password:reset', async (_event, mail: string, code: string, password: string) => {
    try {
      const resp: any = await executeRequest('/Minesweeper/user/password/reset/mail', 'POST', { mail, code, password })
      return { success: resp.code === 200, code: resp.code, msg: resp.msg }
    }
    catch (e: any) {
      return { success: false, msg: e.message }
    }
  })
}

// ==================== App Lifecycle ====================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Mines Client Lite',
    icon: path.join(__dirname, '../../logo.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools()
      }
    })
  }
  else {
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools()
      }
    })
    mainWindow.loadFile(path.join(__dirname, '../render/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ==================== Image Auth Proxy ====================
// Inject auth headers for all HTTP requests to the game server
// so that <img> tags can load avatars/icons without CORS/auth issues

function setupImageAuthProxy(): void {
  const filter = { urls: [`http://${TARGET_HOST}/*`, `https://${TARGET_HOST}/*`] }
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    if (!CONFIG.uid || !CONFIG.token) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }
    const timeStamp = Date.now().toString()
    const apiKey = computeMD5(`${CONFIG.uid + CONFIG.token + timeStamp}api`)
    details.requestHeaders.token = CONFIG.token
    details.requestHeaders.uid = CONFIG.uid
    details.requestHeaders['time-stamp'] = timeStamp
    details.requestHeaders['api-key'] = apiKey
    details.requestHeaders.device = 'OPD2413'
    details.requestHeaders.version = '30610'
    details.requestHeaders.channel = 'App'
    callback({ requestHeaders: details.requestHeaders })
  })
}

app.whenReady().then(() => {
  setupImageAuthProxy()
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  disposeChaosWs()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
