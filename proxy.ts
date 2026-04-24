import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { computeMD5, decryptAESECB, encryptAESECB, randomBase64String } from './encrypt';
import { CONFIG } from './encrypt';

const PORT = 8080;
const TARGET_HOST = 'minesweeper.natapp1.cc';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let chaosWs: WebSocket | null = null;
let clientWs: WebSocket | null = null;

const HEADERS = {
    Upgrade: 'websocket',
    Connection: 'Upgrade',
    'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Extensions': 'permessage-deflate',
    device: 'OPD2413',
    version: '30610',
    channel: 'App',
    token: CONFIG.token,
    uid: CONFIG.uid,
    Host: TARGET_HOST,
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.7.2',
}

export function makeHeaders(): any {
    const timeStamp = Date.now().toString();
    const apiKey = computeMD5(CONFIG.uid + CONFIG.token + timeStamp + 'api');
    const headers: any = { ...HEADERS };
    headers['Sec-WebSocket-Key'] = randomBase64String();
    headers['time-stamp'] = timeStamp;
    headers['api-key'] = apiKey;
    return headers;
}

// REST API for managing WebSocket connection
function disposeChaosWs() {
    if (chaosWs) {
        chaosWs.removeAllListeners();
        if (chaosWs.readyState === WebSocket.OPEN || chaosWs.readyState === WebSocket.CONNECTING) {
            chaosWs.terminate(); // 彻底强制关闭和回收底层Socket与内存
        }
        chaosWs = null;
    }
}

function disposeClientWs() {
    if (clientWs) {
        clientWs.removeAllListeners();
        if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
            clientWs.terminate();
        }
        clientWs = null;
    }
}

app.post('/api/ws/create', (req, res) => {
    if (chaosWs && chaosWs.readyState === WebSocket.OPEN) {
        return res.status(200).json({ success: true, message: 'WebSocket already connected' });
    }

    // 确保清理旧的遗留连接
    disposeChaosWs();

    const targetUrl = `ws://${TARGET_HOST}/Minesweeper/socket/chaos/${CONFIG.uid}`;
    const headers = makeHeaders();

    chaosWs = new WebSocket(targetUrl, { headers });

    chaosWs.on('message', (data) => {
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            const decrypted = decryptAESECB(data.toString());
            if (!decrypted.includes('chaos/action')) {
                console.log('[Recv]:', decrypted);
            }
            clientWs.send(decrypted);
        }
    });

    chaosWs.on('open', () => {
        console.log('[Proxy] Connected to target server');
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ url: 'ready' }));
        }
    });

    chaosWs.on('close', () => {
        console.log('[Proxy] Target server disconnected');
        disposeClientWs();
        disposeChaosWs();
    });

    chaosWs.on('error', (err) => {
        console.error('[Proxy] Target WS error:', err.message);
        disposeClientWs();
        disposeChaosWs();
    });

    res.status(200).json({ success: true, message: 'WebSocket connection initiated' });
});

app.post('/api/ws/close', (req, res) => {
    disposeChaosWs();
    disposeClientWs();
    res.status(200).json({ success: true, message: 'WebSockets closed and disposed' });
});

// WebSocket Server for Client (Frontend)
wss.on('connection', (ws) => {
    // 强制回收旧的 clientWs（保证单例）
    disposeClientWs();
    
    clientWs = ws;
    console.log('[Proxy] Client connected');

    ws.on('message', (data: string) => {
        if (chaosWs && chaosWs.readyState === WebSocket.OPEN) {
            const parsed = JSON.parse(data.toString());
            console.log('[Send]:', parsed);
            chaosWs.send(encryptAESECB(data));
        } else {
            console.warn('[Proxy] Cannot send, target WS not connected');
        }
    });

    ws.on('close', () => {
        console.log('[Proxy] Client disconnected');
        disposeClientWs();
    });

    ws.on('error', (err) => {
        console.error('[Proxy] Client WS error:', err.message);
        disposeClientWs();
    });
    
    if (chaosWs && chaosWs.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ url: 'ready' }));
    }
});

server.listen(PORT, () => {
    console.log(`---------------------------------------------------`);
    console.log(` Node.js WebSocket Proxy Layer (Express+WS) `);
    console.log(` Target Server : ws://${TARGET_HOST}`);
    console.log(` Local Service : ws://localhost:${PORT}`);
    console.log(` HTTP API      : http://localhost:${PORT}/api/ws`);
    console.log(`---------------------------------------------------`);
    console.log(` Waiting for connections...`);
});
