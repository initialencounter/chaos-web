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

const targetUrl = `ws://${TARGET_HOST}/Minesweeper/socket/chaos/${CONFIG.uid}`;

let chaosWs: WebSocket | null = null;

const wss = new WebSocketServer({ server });

wss.on('connection', (WebUIWs, req) => {
    // 构建真实请求到服务端的 URL

    // nodejs 的 ws 库允许直接注入 header (原生浏览器不行)
    const headers = makeHeaders(); // 你可以根据需要动态生成 headers

    chaosWs = new WebSocket(targetUrl, { headers });

    // 建立双向数据流 Relay: Target -> Client
    chaosWs.on('message', (data) => {
        if (WebUIWs.readyState === WebSocket.OPEN) {
            const decrypted = decryptAESECB(data.toString());
            if (!decrypted.includes('chaos/action')) {
                console.log('[Recv]:', decrypted);
            }
            WebUIWs.send(decrypted);
        }
    });

    chaosWs.on('open', () => {
        WebUIWs.send(JSON.stringify({ url: 'ready' }));
    });

    // 建立双向数据流 Relay: Client -> Target
    WebUIWs.on('message', (data: string) => {
        if (chaosWs?.readyState === WebSocket.OPEN) {
            const parsed = JSON.parse(data.toString());
            console.log('[Send]:', parsed);
            chaosWs.send(encryptAESECB(data));
        }
    });

    // 连接关闭处理
    WebUIWs.on('close', () => {
        console.log('[Proxy] Client disconnected');
        if (chaosWs?.readyState === WebSocket.OPEN) {
            chaosWs.close();
        }
    });

    chaosWs.on('close', () => {
        console.log('[Proxy] Target server disconnected');
        if (WebUIWs.readyState === WebSocket.OPEN) {
            WebUIWs.close();
        }
    });

    // 异常处理
    WebUIWs.on('error', (err) => console.error('[Proxy] Client WS error:', err.message));
    chaosWs.on('error', (err) => console.error('[Proxy] Target WS error:', err.message));
});

server.listen(PORT, () => {
    console.log(`---------------------------------------------------`);
    console.log(` Node.js WebSocket Proxy Layer   `);
    console.log(` Target Server : ws://${TARGET_HOST}`);
    console.log(` Local Service : ws://localhost:${PORT}`);
    console.log(`---------------------------------------------------`);
    console.log(` Waiting for connections...`);
});
