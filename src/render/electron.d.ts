export {}

declare global {
  interface Window {
    electronAPI: {
      targetBaseUrl: string
      wsConnect: () => Promise<boolean>
      wsSend: (data: any) => Promise<boolean>
      wsClose: () => Promise<boolean>
      onWsMessage: (callback: (data: any) => void) => void
      removeWsMessageListener: () => void
      getLoginStatus: () => Promise<{
        loggedIn: boolean
        reason?: string
        uid?: string
        id?: string
        password?: string
        msg?: string
      }>
      login: (id: string, password: string) => Promise<{
        success: boolean
        code?: number
        msg?: string
      }>
      getStoredCredentials: () => Promise<{
        uid: string
        token: string
        id: string
        password: string
      } | null>
      saveCredentials: (uid: string, token: string) => Promise<{ success: boolean, msg?: string }>
      onAskJoinBrawl: (callback: (data: any) => void) => void
      sendJoinBrawlResponse: (join: boolean) => Promise<boolean>
      onStartGame: (callback: () => void) => void
      logout: () => Promise<boolean>
      apiRequest: (path: string, method: string, params: Record<string, any>) => Promise<{ success: boolean, code?: number, msg?: string, data?: any }>
      proxyRequest: (path: string) => Promise<{ success: boolean, code?: number, msg?: string, data?: any }>
      cacheImage: (url: string) => Promise<string>
      ossUpload: (buffer: ArrayBuffer, filename: string, contentType: string) => Promise<{ success: boolean, url?: string, msg?: string }>
    }
  }
}
