import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createCompetitionEngine, createTranscendenceCupEngine, executeRequest, loadSpeedCompetitionConfig, loadTranscendenceCupConfig, LOGIN_CONFIG } from '@tapsss/server'
import cors from 'cors'
import express from 'express'
import { TOKEN, UID } from './secrets'

const app = express()
const PORT = 3001
const DEV = process.env.DEV === 'true'

LOGIN_CONFIG.uid = UID
LOGIN_CONFIG.token = TOKEN

const rootDir = path.resolve(process.cwd(), process.env.TOP_DIR ? 'tapsss-forum' : '.')

// 缓存目录
const IMAGE_CACHE_DIR = path.join(rootDir, 'image-cache')
const RECORD_CACHE_DIR = path.join(rootDir, 'record-cache')
const COMPETITION_CACHE_DIR = path.join(rootDir, 'competition-cache')
fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true })
fs.mkdirSync(RECORD_CACHE_DIR, { recursive: true })
fs.mkdirSync(COMPETITION_CACHE_DIR, { recursive: true })

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// 静态资源缓存策略
const distDir = path.join(rootDir, 'dist')

if (!DEV) {
  // Vite 带 hash 的产物文件 — 永久缓存
  app.use('/assets', express.static(path.join(distDir, 'assets'), {
    maxAge: '365d',
    immutable: true,
  }))

  // 公共静态资源（icon, themes, audio）— 7天缓存
  for (const dir of ['icon', 'themes', 'audio']) {
    app.use(`/${dir}`, express.static(path.join(distDir, dir), {
      maxAge: '7d',
    }))
  }

  // 其余静态文件（index.html 等）— 不缓存，始终重新验证
  app.use(express.static(distDir, {
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  }))
}

const apiPaths = [
  '/Minesweeper/post/list',
  '/Minesweeper/post/get',
  '/Minesweeper/post/comment/list',
  '/Minesweeper/post/list/search',
  '/Minesweeper/post/comment/list/reply',
  '/Minesweeper/post/list/good/user',
  '/Minesweeper/post/list/user',
  '/Minesweeper/user/search',
  '/Minesweeper/minesweeper/record/list',
  '/Minesweeper/schulte/record/list/filter',
  '/Minesweeper/puzzle/record/list/filter',
  '/Minesweeper/tzfe/record/list/filter',
  '/Minesweeper/nono/record/list/filter',
  '/Minesweeper/user/config/get',
  '/Minesweeper/minesweeper/timing/career/simple',
  '/Minesweeper/sudoku/career',
  '/Minesweeper/puzzle/career/simple',
  '/Minesweeper/nono/career/simple',
  '/Minesweeper/tzfe/career',
  '/Minesweeper/schulte/career',
  '/Minesweeper/rank/timing/list',
  '/Minesweeper/rank/puzzle/list',
  '/Minesweeper/rank/schulte/list',
  '/Minesweeper/rank/tzfe/list',
  '/Minesweeper/rank/nono/list',
  '/Minesweeper/rank/all',
  '/Minesweeper/game/news/user',
]

apiPaths.forEach((path) => {
  app.all(path, async (req, res) => {
    try {
      if (req.method !== 'POST') {
        req.body = new URLSearchParams(req.query as Record<string, string>)
      }
      const data = await executeRequest(path, 'POST', req.body)
      res.json(data)
    }
    catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })
})

app.post('/Minesweeper/user/home', async (req, res) => {
  try {
    const data: any = await executeRequest('/Minesweeper/user/home', 'POST', req.body)
    delete data.data.user.mail // 删除敏感字段
    delete data.data.user.password
    delete data.data.user.phone
    delete data.data.user.registerIp
    delete data.data.user.token
    delete data.data.user.userId
    res.json(data)
  }
  catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ======== 图片代理缓存 ========
app.get('/image-proxy', async (req, res) => {
  const imageUrl = req.query.url as string
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  // SSRF 防护：只允许 http/https
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  }
  catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' })
  }

  const hash = crypto.createHash('md5').update(imageUrl).digest('hex')
  // 检查缓存目录中是否存在以此 hash 为前缀的文件
  const cachedFiles = fs.readdirSync(IMAGE_CACHE_DIR).filter(f => f.startsWith(hash))

  if (cachedFiles.length > 0) {
    const cachedFile = path.join(IMAGE_CACHE_DIR, cachedFiles[0])
    const ext = path.extname(cachedFiles[0]).slice(1)
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    }
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return res.sendFile(cachedFile)
  }

  try {
    const controller = new AbortController()
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_IMAGE_SIZE) {
      controller.abort()
      return res.status(413).json({ error: 'Image too large' })
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: 'Image too large' })
    }

    // 根据 Content-Type 确定扩展名
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    }
    const ext = extMap[contentType.split(';')[0].trim()] || 'bin'
    const cacheFile = path.join(IMAGE_CACHE_DIR, `${hash}.${ext}`)
    fs.writeFileSync(cacheFile, buffer)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(buffer)
  }
  catch (err) {
    res.status(502).json({ error: `Failed to fetch image: ${String(err)}` })
  }
})

// ======== 录像 API 缓存（不可变数据，永久缓存） ========
const recordPaths: Record<string, string> = {
  '/Minesweeper/minesweeper/record/get': 'minesweeper',
  '/Minesweeper/puzzle/record/get': 'puzzle',
  '/Minesweeper/schulte/record/get': 'schulte',
}

for (const [apiPath, recordType] of Object.entries(recordPaths)) {
  app.post(apiPath, async (req, res) => {
    // eslint-disable-next-line no-console
    console.log(`Received request for ${recordType} record:`, req.body)
    const recordId = req.body.recordId
    if (!recordId) {
      return res.status(400).json({ error: 'Missing recordId' })
    }

    const cacheKey = `${recordType}-${recordId}.json`
    const cacheFile = path.join(RECORD_CACHE_DIR, cacheKey)

    // 检查服务端缓存
    if (fs.existsSync(cacheFile)) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return res.sendFile(cacheFile)
    }

    try {
      const data = await executeRequest(apiPath, 'POST', req.body)
      // 只缓存成功的响应
      if ((data as any).code === 200) {
        fs.writeFileSync(cacheFile, JSON.stringify(data))
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.json(data)
    }
    catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })
}

const COMPETITION_CONFIG_DIR = path.join(rootDir, 'competition-config')

// ======== 全标速效比赛引擎 ========
const SPEED_CONFIG = loadSpeedCompetitionConfig(COMPETITION_CONFIG_DIR)
const competitionEngine = createCompetitionEngine(
  SPEED_CONFIG,
  {
    executeRequest,
    cacheDir: COMPETITION_CACHE_DIR,
    recordCacheDir: RECORD_CACHE_DIR,
    logger: console,
  },
)

// 从磁盘恢复状态
competitionEngine.loadFromDisk()

// ======== 超越杯比赛引擎 ========
const TCUP_CONFIG = loadTranscendenceCupConfig(COMPETITION_CONFIG_DIR)
const tcupEngine = createTranscendenceCupEngine(
  TCUP_CONFIG,
  {
    executeRequest,
    cacheDir: COMPETITION_CACHE_DIR,
    recordCacheDir: RECORD_CACHE_DIR,
    logger: console,
  },
)
tcupEngine.loadFromDisk()

// 获取排行榜
app.get('/api/competition/leaderboard', (req, res) => {
  try {
    const entries = competitionEngine.getLeaderboard()
    const stats = competitionEngine.getStatistics()
    res.json({
      code: 200,
      data: {
        entries,
        lastUpdated: competitionEngine.getLastPollTime(),
        competitionTitle: '全标速效比赛',
        competitionTimeWindow: '2026-06-10 20:00 ~ 2026-06-18 00:00',
        totalSubmissions: stats.totalSubmissions,
        totalValidEntries: stats.totalValid,
        totalFinalEntries: stats.totalFinal,
      },
      msg: null,
    })
  }
  catch (err) {
    res.status(500).json({ code: 500, data: null, msg: String(err) })
  }
})

// 手动刷新排行榜
app.post('/api/competition/refresh', async (req, res) => {
  try {
    await competitionEngine.poll()
    res.json({ code: 200, data: { success: true }, msg: null })
  }
  catch (err) {
    res.status(500).json({ code: 500, data: null, msg: String(err) })
  }
})

// ======== 超越杯 API ========

// 获取超越杯排行榜
app.get('/api/tcup/leaderboards', (req, res) => {
  try {
    const data = tcupEngine.getLeaderboards()
    res.json({
      code: 200,
      data: {
        ...data,
        lastUpdated: tcupEngine.getLastPollTime(),
      },
      msg: null,
    })
  }
  catch (err) {
    res.status(500).json({ code: 500, data: null, msg: String(err) })
  }
})

// 手动刷新超越杯排行榜
app.post('/api/tcup/refresh', async (req, res) => {
  try {
    await tcupEngine.poll()
    res.json({ code: 200, data: { success: true }, msg: null })
  }
  catch (err) {
    res.status(500).json({ code: 500, data: null, msg: String(err) })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 处理前端的路由
if (DEV) {
  // dev 模式：将所有非 API 请求转发到 Vite dev server (port 5173)
  const VITE_PORT = Number(process.env.VITE_PORT) || 5173
  app.use((req, res) => {
    const proxyReq = http.request(
      {
        hostname: 'localhost',
        port: VITE_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${VITE_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode!, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )
    proxyReq.on('error', () => {
      res.status(502).send(`Vite dev server not running on port ${VITE_PORT}`)
    })
    // express 中间件已消耗 stream，需手动重新写入 body；同时合并 query 参数
    const hasBody = req.body !== undefined && Object.keys(req.body).length > 0
    const hasQuery = Object.keys(req.query).length > 0
    if (hasBody || hasQuery) {
      const contentType = req.headers['content-type'] || ''
      let bodyData: string
      if (contentType.includes('application/json')) {
        bodyData = JSON.stringify({ ...req.query, ...req.body })
        proxyReq.setHeader('Content-Type', 'application/json')
      }
      else {
        const params = new URLSearchParams({
          ...(req.query as Record<string, string>),
          ...req.body,
        })
        bodyData = params.toString()
        proxyReq.setHeader('Content-Type', 'application/x-www-form-urlencoded')
      }
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
      proxyReq.end(bodyData)
    }
    else {
      req.pipe(proxyReq)
    }
  })
}
else {
  // SPA 支持
  app.use((req, res) => {
    res.sendFile(path.join(rootDir, 'dist', 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`代理服务器运行在 http://localhost:${PORT}`)

  // 5 秒后首次轮询，之后每 15 分钟自动轮询
  setTimeout(() => {
    competitionEngine.poll().then(() => {
      // eslint-disable-next-line no-console
      console.log('[Competition] 首次轮询完成')
    }).catch((err: Error) => {
      console.error('[Competition] 首次轮询失败:', err)
    })
  }, 5000)

  competitionEngine.startAutoPoll()

  // 超越杯: 7 秒后首次轮询 (错开与全标速效的 API 请求)
  setTimeout(() => {
    tcupEngine.poll().then(() => {
      // eslint-disable-next-line no-console
      console.log('[TranscendenceCup] 首次轮询完成')
    }).catch((err: Error) => {
      console.error('[TranscendenceCup] 首次轮询失败:', err)
    })
  }, 7000)

  tcupEngine.startAutoPoll()
})
