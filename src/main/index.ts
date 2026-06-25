import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  computeMD5,
  decryptAESECB,
  encryptAESECB,
  executeRequest,
  LOGIN_CONFIG,
  randomBase64String,
} from '@tapsss/server'
import { app, BrowserWindow, globalShortcut, ipcMain, net, session } from 'electron'
import { WebSocket } from 'ws'

const VITE_DEV_SERVER_URL = process.env.DS_RENDERER_URL
const TARGET_HOST = 'minesweeper.natapp1.cc'
export const TARGET_BASE_URL = `http://${TARGET_HOST}`

let mainWindow: BrowserWindow | null = null
let chaosWs: WebSocket | null = null

// ==================== Image Cache ====================

function getImgCacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'img-cache')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getImgCachePath(url: string): string {
  const hash = createHash('md5').update(url).digest('hex')
  return path.join(getImgCacheDir(), hash)
}

function detectMimeType(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return 'image/png'
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    return 'image/jpeg'
  }
  if (buf[0] === 0x47 && buf[1] === 0x49) {
    return 'image/gif'
  }
  if (buf[0] === 0x52 && buf[1] === 0x49) {
    return 'image/webp'
  }
  return 'image/png'
}

async function downloadAndCache(url: string): Promise<string> {
  const cachePath = getImgCachePath(url)

  if (fs.existsSync(cachePath)) {
    const buf = fs.readFileSync(cachePath)
    return `data:${detectMimeType(buf)};base64,${buf.toString('base64')}`
  }

  try {
    const resp = await net.fetch(url)
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer())
      fs.writeFileSync(cachePath, buf)
      const mime = resp.headers.get('content-type') || detectMimeType(buf)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  }
  catch (e) {
    console.error('[imgcache] download failed:', url, e)
  }
  return url // fallback to original URL
}

// ==================== Credential Storage ====================

interface Credentials {
  id: string
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

function clearCredentials(): void {
  LOGIN_CONFIG.uid = ''
  LOGIN_CONFIG.token = ''
}

function applyCredentials(uid: string, token: string): void {
  LOGIN_CONFIG.uid = uid
  LOGIN_CONFIG.token = token
}

// ==================== WebSocket Proxy ====================

function makeHeaders(): any {
  const timeStamp = Date.now().toString()
  const apiKey = computeMD5(`${LOGIN_CONFIG.uid + LOGIN_CONFIG.token + timeStamp}api`)
  return {
    'Upgrade': 'websocket',
    'Connection': 'Upgrade',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Extensions': 'permessage-deflate',
    'Sec-WebSocket-Key': randomBase64String(),
    'device': 'OPD2413',
    'version': '30610',
    'channel': 'App',
    'token': LOGIN_CONFIG.token,
    'uid': LOGIN_CONFIG.uid,
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
  if (!LOGIN_CONFIG.uid) {
    console.error('[Main] Cannot connect: no uid set')
    return false
  }

  disposeChaosWs()

  const targetUrl = `ws://${TARGET_HOST}/Minesweeper/socket/chaos/${LOGIN_CONFIG.uid}`
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
  id: string,
  password: string,
): Promise<{ success: boolean, code?: number, msg?: string, data?: any }> {
  try {
    const passwordMD = computeMD5(password)
    const resp: any = await executeRequest('/Minesweeper/user/login', 'POST', {
      id,
      password: passwordMD,
      platform: 0,
    })

    if (resp.code === 200 && resp.data) {
      const { uid, token } = resp.data
      applyCredentials(uid, token)
      saveCredentials({ id, uid, token, password })
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
    if (!creds || !creds.token) {
      if (creds && creds.password && creds.id) {
        return { loggedIn: false, reason: 'token_expired', id: creds.id, password: creds.password }
      }
      return { loggedIn: false, reason: '请先登录' }
    }

    applyCredentials(creds.uid, creds.token)

    const online = await checkOnlineStatus()
    if (online) {
      applyCredentials(creds.uid, creds.token)
      return { loggedIn: true, uid: creds.uid }
    }

    return { loggedIn: false, reason: 'token_expired', id: creds.id, password: creds.password }
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

  ipcMain.handle('login:save-credentials', async (_event, uid: string, token: string) => {
    applyCredentials(uid, token)
    saveCredentials({ id: '', uid, token, password: '' })

    const online = await checkOnlineStatus()
    if (online) {
      return { success: true }
    }
    return { success: false, msg: '在线状态检查失败，UID 或 Token 可能已过期' }
  })

  ipcMain.handle('login:logout', () => {
    disposeChaosWs()
    const creds = loadCredentials()
    if (creds) {
      saveCredentials({ id: creds.id, uid: '', token: '', password: creds.password })
    }
    clearCredentials()
    return true
  })

  // Generic API request — no need to register a new IPC handler per endpoint
  ipcMain.handle('api:request', async (_event, path: string, method: string, params: Record<string, any>) => {
    try {
      const resp: any = await executeRequest(path, method, params)
      return { success: resp.code === 200, code: resp.code, msg: resp.msg, data: resp.data }
    }
    catch (e: any) {
      return { success: false, msg: e.message }
    }
  })

  // Image cache
  ipcMain.handle('cache:image', async (_event, url: string) => {
    return downloadAndCache(url)
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
    if (!LOGIN_CONFIG.uid || !LOGIN_CONFIG.token) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }
    const timeStamp = Date.now().toString()
    const apiKey = computeMD5(`${LOGIN_CONFIG.uid + LOGIN_CONFIG.token + timeStamp}api`)
    details.requestHeaders.token = LOGIN_CONFIG.token
    details.requestHeaders.uid = LOGIN_CONFIG.uid
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
