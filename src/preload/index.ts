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

  // Register
  registerSendCode: (mail: string) => ipcRenderer.invoke('register:send-code', mail),
  registerSubmit: (mail: string, code: string, password: string) => ipcRenderer.invoke('register:submit', mail, code, password),

  // Password reset
  passwordSendCode: (mail: string) => ipcRenderer.invoke('password:send-code', mail),
  passwordReset: (mail: string, code: string, password: string) => ipcRenderer.invoke('password:reset', mail, code, password),
})
