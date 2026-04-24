type EventCallback = (data: any) => void;

const API_BASE_URL = 'http://localhost:8080/api/ws';

class WsClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private connectPromise: Promise<void> | null = null;

  private isManualClose: boolean = false;

  constructor() {
  }

  public async connect(url: string): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    try {
      // Create server-side websocket via HTTP
      await fetch(`${API_BASE_URL}/create`, { method: 'POST' });

      this.isManualClose = false;
      this.connectPromise = new Promise((resolve, reject) => {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WS Receive:', data);

            if (data.url) {
              this.emit(data.url, data);
            }
          } catch (e) {
            console.error('Failed to parse WS message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.connectPromise = null;
          if (!this.isManualClose) {
            this.emit('disconnect', {});
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(error);
          }
        };
      });

      return this.connectPromise;
    } catch (e) {
      console.error('Failed to initialize connection via HTTP', e);
      throw e;
    }
  }

  public send(data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
    this.ws.send(JSON.stringify(data));
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  public off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  public async close() {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connectPromise = null;
    }
    try {
      await fetch(`${API_BASE_URL}/close`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to close server websocket', e);
    }
  }
}

export const wsClient = new WsClient();
