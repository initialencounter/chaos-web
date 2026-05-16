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
      onAskJoinBrawl: (callback: (data: any) => void) => void
      sendJoinBrawlResponse: (join: boolean) => Promise<boolean>
      onStartGame: (callback: () => void) => void
      logout: () => Promise<boolean>
      apiRequest: (path: string, method: string, params: Record<string, any>) => Promise<{ success: boolean, code?: number, msg?: string, data?: any }>
      cacheImage: (url: string) => Promise<string>
    }
  }
}
