import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Game server base URL for resolving image URLs
  targetBaseUrl: 'http://minesweeper.natapp1.cc',

  // WebSocket communication
  wsConnect: () => ipcRenderer.invoke('ws:connect'),
  wsSend: (data: any) => ipcRenderer.invoke('ws:send', data),
  wsClose: () => ipcRenderer.invoke('ws:close'),
  onWsMessage: (callback: (data: any) => void) => {
    ipcRenderer.on('ws:message', (_event, data) => callback(data))
  },
  removeWsMessageListener: () => {
    ipcRenderer.removeAllListeners('ws:message')
  },

  // Login management
  getLoginStatus: () => ipcRenderer.invoke('login:check'),
  login: (id: string, password: string) => ipcRenderer.invoke('login:submit', id, password),
  getStoredCredentials: () => ipcRenderer.invoke('login:get-credentials'),
  saveCredentials: (uid: string, token: string) => ipcRenderer.invoke('login:save-credentials', uid, token),

  // Brawl room prompt
  onAskJoinBrawl: (callback: (data: any) => void) => {
    ipcRenderer.on('login:ask-join', (_event, data) => callback(data))
  },
  sendJoinBrawlResponse: (join: boolean) => ipcRenderer.invoke('login:join-response', join),

  // Game start signal from main process
  onStartGame: (callback: () => void) => {
    ipcRenderer.on('login:start-game', () => callback())
  },

  // Logout
  logout: () => ipcRenderer.invoke('login:logout'),

  // Generic API request
  apiRequest: (path: string, method: string, params: Record<string, any>) => ipcRenderer.invoke('api:request', path, method, params),

  // Proxy server request (for non-Minesweeper endpoints like /api/rank/composite)
  proxyRequest: (path: string) => ipcRenderer.invoke('proxy:request', path),

  // Image cache
  cacheImage: (url: string) => ipcRenderer.invoke('cache:image', url),

  // OSS upload — 通过主进程绕过 CORS
  ossUpload: (buffer: ArrayBuffer, filename: string, contentType: string) =>
    ipcRenderer.invoke('oss:upload', buffer, filename, contentType),
})
