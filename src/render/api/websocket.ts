type EventCallback = (data: any) => void

class WsClient {
  private listeners: Map<string, EventCallback[]> = new Map()
  private isConnected = false
  private isManualClose = false

  async connect(_url: string): Promise<void> {
    this.isManualClose = false

    try {
      await window.electronAPI.wsConnect()

      window.electronAPI.onWsMessage((data: any) => {
        // console.log('WS Receive:', data)

        if (data.url === 'ready') {
          this.isConnected = true
        }

        if (data.url) {
          this.emit(data.url, data)
        }
      })

      window.electronAPI.onStartGame(() => {
        this.isConnected = true
        this.emit('ready', { url: 'ready' })
      })
    }
    catch (e) {
      console.error('Failed to connect via IPC', e)
      throw e
    }
  }

  send(data: any): void {
    if (!this.isConnected) {
      console.warn('WebSocket not connected, queuing message')
    }
    // console.log('WS Send:', data)
    window.electronAPI.wsSend(data)
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)?.push(callback)
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(cb => cb(data))
    }
  }

  async close(): Promise<void> {
    this.isManualClose = true
    this.isConnected = false
    this.listeners.clear()
    window.electronAPI.removeWsMessageListener()
    try {
      await window.electronAPI.wsClose()
    }
    catch (e) {
      console.error('Failed to close WS via IPC', e)
    }
  }
}

export const wsClient = new WsClient()
