import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { computeMD5, decryptAESECB, encryptAESECB, randomBase64String } from './encrypt';
import { CONFIG } from './encrypt';
const PORT = 8080;
const TARGET_HOST = 'minesweeper.natapp1.cc'; // 真实的服务器域名

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
    Host: 'minesweeper.natapp1.cc',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.7.2',
}

export function makeHeaders(): any {
    const timeStamp = Date.now().toString();
    const apiKey = computeMD5(CONFIG.uid + CONFIG.token + timeStamp + 'api');;
    const headers: any = HEADERS;
    headers['Sec-WebSocket-Key'] = randomBase64String();
    headers['time-stamp'] = timeStamp;
    headers['api-key'] = apiKey;
    return headers;
}


const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Proxy is running\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs, req) => {
    // 构建真实请求到服务端的 URL
    const targetUrl = `ws://${TARGET_HOST}/Minesweeper/socket/chaos/${CONFIG.uid}`;

    // nodejs 的 ws 库允许直接注入 header (原生浏览器不行)
    const headers = makeHeaders(); // 你可以根据需要动态生成 headers

    const targetWs = new WebSocket(targetUrl, { headers });

    // 建立双向数据流 Relay: Target -> Client
    targetWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(decryptAESECB(data.toString()));
        }
    });

    targetWs.on('open', () => {
        clientWs.send(JSON.stringify({ url: 'ready' }));
        targetWs.send(encryptAESECB(JSON.stringify({ url: 'enter' })));
    });

    // 建立双向数据流 Relay: Client -> Target
    clientWs.on('message', (data) => {
        if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(encryptAESECB(JSON.stringify(data)));
        }
    });

    // 连接关闭处理
    clientWs.on('close', () => {
        console.log('[Proxy] Client disconnected');
        if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.close();
        }
    });

    targetWs.on('close', () => {
        console.log('[Proxy] Target server disconnected');
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
        }
    });

    // 异常处理
    clientWs.on('error', (err) => console.error('[Proxy] Client WS error:', err.message));
    targetWs.on('error', (err) => console.error('[Proxy] Target WS error:', err.message));
});

server.listen(PORT, () => {
    console.log(`---------------------------------------------------`);
    console.log(` Node.js WebSocket Proxy Layer   `);
    console.log(` Target Server : ws://${TARGET_HOST}`);
    console.log(` Local Service : ws://localhost:${PORT}`);
    console.log(`---------------------------------------------------`);
    console.log(` Waiting for connections...`);
});
