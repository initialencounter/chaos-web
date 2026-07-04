/**
 * 生成 bar_chart_race 的 race_data JSON 文件
 *
 * 用法: npx tsx bar_chart_race/scripts/generate_race_data.ts
 *
 * 按日汇总每个玩家的最佳成绩，生成累积最优曲线。
 * 支持的游戏和指标:
 *   扫雷 time  — sum of min(time) per level (1+2+3)
 *   扫雷 3bvs — sum of max(bvs) per level (1+2+3)
 *   Nono time  — sum of min(time) per level (1+2+3+4)
 *   Puzzle time  — sum of min(time) per level (3+4+5)
 *   Puzzle steps — sum of min(step) per level (3+4+5)
 *   Schulte time — sum of min(time) per level (3+4+5)
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// ======== 配置 ========

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const WEB_DIR = path.join(ROOT_DIR, 'web')
const AVATARS_DIR = path.join(WEB_DIR, 'avatars')
const IMAGE_CACHE_DIR = path.join(ROOT_DIR, '..', 'tapsss-forum', 'image-cache')

interface GameSpec {
  dir: string
  levels: string[]
  metrics: MetricSpec[]
}

interface MetricSpec {
  key: string // 'time' | '3bvs' | 'steps'
  field: string // 记录中的字段名
  aggregate: 'min' | 'max' // 每 level 的聚合方式
  sortOrder: 'asc' | 'desc' // asc=越小越好
  msToSec?: boolean // 毫秒转秒
  decimals?: number // 小数位数
}

const GAMES: GameSpec[] = [
  {
    dir: 'minesweeper',
    levels: ['1', '2', '3'],
    metrics: [
      { key: 'time', field: 'time', aggregate: 'min', sortOrder: 'asc', msToSec: true, decimals: 1 },
      { key: '3bvs', field: 'bvs', aggregate: 'max', sortOrder: 'desc', decimals: 3 },
    ],
  },
  {
    dir: 'nono',
    levels: ['1', '2', '3', '4'],
    metrics: [
      { key: 'time', field: 'time', aggregate: 'min', sortOrder: 'asc', msToSec: true, decimals: 1 },
    ],
  },
  {
    dir: 'puzzle',
    levels: ['3', '4', '5'],
    metrics: [
      { key: 'time', field: 'time', aggregate: 'min', sortOrder: 'asc', msToSec: true, decimals: 1 },
      { key: 'steps', field: 'step', aggregate: 'min', sortOrder: 'asc', decimals: 0 },
    ],
  },
  {
    dir: 'schulte',
    levels: ['3', '4', '5'],
    metrics: [
      { key: 'time', field: 'time', aggregate: 'min', sortOrder: 'asc', msToSec: true, decimals: 1 },
    ],
  },
]

// ======== 类型 ========

interface RawRecord {
  time: number
  bvs?: number
  step?: number
  createTime: number
  [key: string]: any
}

interface RawPlayerData {
  uid: string
  nickName: string
  avatar: string
  records: Record<string, RawRecord[]>
}

interface PlayerData {
  uid: string
  name: string
  avatar: string | null
  values: (number | null)[]
}

interface RaceData {
  meta: {
    totalPlayers: number
    totalDates: number
    dateRange: [string, string]
  }
  dates: string[]
  players: PlayerData[]
}

// ======== 工具函数 ========

function toDateStr(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtValue(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

// ======== 头像缓存 ========

/**
 * 扫描所有游戏数据文件中的头像 URL，从 image-cache 复制已缓存的头像到 web/avatars。
 * 返回 URL → 本地路径 的映射，用于替换 race_data 中的远程头像地址。
 */
function ensureAvatars(): Map<string, string> {
  console.log('\n--- 头像缓存同步 ---')
  fs.mkdirSync(AVATARS_DIR, { recursive: true })

  // 收集所有唯一的头像 URL
  const avatarUrls = new Set<string>()
  for (const spec of GAMES) {
    const dataDir = path.join(ROOT_DIR, spec.dir, 'data')
    if (!fs.existsSync(dataDir))
      continue
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const filePath = path.join(dataDir, file)
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (raw.avatar && typeof raw.avatar === 'string') {
        avatarUrls.add(raw.avatar)
      }
    }
  }
  console.log(`  发现 ${avatarUrls.size} 个唯一头像 URL`)

  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    console.log(`  ⚠ 镜像缓存目录不存在: ${IMAGE_CACHE_DIR}`)
    console.log('  跳过头像同步')
    return new Map()
  }

  const urlToLocal = new Map<string, string>()
  let copied = 0
  let missing = 0

  const cacheFiles = fs.readdirSync(IMAGE_CACHE_DIR)

  for (const url of avatarUrls) {
    const hash = createHash('md5').update(url).digest('hex')
    const match = cacheFiles.find(f => f.startsWith(hash))

    if (match) {
      const ext = path.extname(match)
      const destFile = path.join(AVATARS_DIR, `${hash}${ext}`)

      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(path.join(IMAGE_CACHE_DIR, match), destFile)
        copied++
      }

      // 映射远程 URL → 本地相对路径（Vite publicDir 为 web，根路径即为 web/ 下内容）
      urlToLocal.set(url, `avatars/${hash}${ext}`)
    }
    else {
      missing++
      // 无缓存时保留远程 URL
      urlToLocal.set(url, url)
    }
  }

  console.log(`  头像同步完成: ${copied} 个新复制, ${missing} 个无缓存, ${avatarUrls.size - copied - missing} 个已存在`)
  return urlToLocal
}

// ======== 核心：生成单个 RaceData ========

function generateRaceData(spec: GameSpec, metric: MetricSpec, urlToLocal: Map<string, string>): RaceData {
  const dataDir = path.join(ROOT_DIR, spec.dir, 'data')
  if (!fs.existsSync(dataDir)) {
    throw new Error(`数据目录不存在: ${dataDir}`)
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'))
  console.log(`  [${spec.dir}/${metric.key}] 读取 ${files.length} 个玩家数据文件...`)

  // Step 1: 收集所有日期的所有记录
  // dateMap: dateStr → uid → level → aggregatedValue
  const dateMap = new Map<string, Map<string, Map<string, number>>>()

  let loaded = 0
  for (const file of files) {
    const filePath = path.join(dataDir, file)
    const raw: RawPlayerData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    // Skip non-player data files (e.g. progress.json)
    if (!raw.records || typeof raw.records !== 'object')
      continue
    const uid = raw.uid

    for (const [level, records] of Object.entries(raw.records)) {
      if (!spec.levels.includes(level))
        continue
      if (!Array.isArray(records))
        continue

      for (const rec of records) {
        const val = (rec as any)[metric.field]
        if (val == null)
          continue

        const dateStr = toDateStr(rec.createTime)

        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, new Map())
        }
        const uidMap = dateMap.get(dateStr)!
        if (!uidMap.has(uid)) {
          uidMap.set(uid, new Map())
        }
        const levelMap = uidMap.get(uid)!

        const current = levelMap.get(level)
        if (current == null || (metric.aggregate === 'min' ? val < current : val > current)) {
          const converted = metric.msToSec ? val / 1000 : val
          levelMap.set(level, converted)
        }
      }
    }

    loaded++
    if (loaded % 200 === 0) {
      console.log(`    已处理 ${loaded}/${files.length} 个文件...`)
    }
  }

  // Step 2: 排序所有日期
  const dates = Array.from(dateMap.keys()).sort()
  if (dates.length === 0) {
    throw new Error('没有找到任何记录')
  }
  console.log(`    日期范围: ${dates[0]} ~ ${dates[dates.length - 1]}, 共 ${dates.length} 天`)

  // Step 3: 收集所有有完整数据的玩家 uid
  const allUids = new Set<string>()
  for (const [, uidMap] of dateMap) {
    for (const uid of uidMap.keys()) {
      allUids.add(uid)
    }
  }

  // Step 4: 加载玩家元信息（name, avatar）
  const playerMeta = new Map<string, { name: string, avatar: string | null }>()
  for (const file of files) {
    const filePath = path.join(dataDir, file)
    const raw: RawPlayerData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (!raw.records || typeof raw.records !== 'object')
      continue
    const localAvatar = raw.avatar ? (urlToLocal.get(raw.avatar) || raw.avatar) : null
    playerMeta.set(raw.uid, {
      name: raw.nickName || raw.uid,
      avatar: localAvatar,
    })
  }

  // Step 5: 计算每个玩家的累积最优 values 数组
  const players: PlayerData[] = []

  for (const uid of allUids) {
    const meta = playerMeta.get(uid) || { name: uid, avatar: null }
    const values: (number | null)[] = []

    // 追踪每个 level 的累积最优值
    const cumulativeBest: Map<string, number> = new Map()

    for (const dateStr of dates) {
      const uidMap = dateMap.get(dateStr)
      const levelMap = uidMap?.get(uid)

      if (levelMap) {
        for (const [level, val] of levelMap) {
          const prev = cumulativeBest.get(level)
          if (prev == null || (metric.aggregate === 'min' ? val < prev : val > prev)) {
            cumulativeBest.set(level, val)
          }
        }
      }

      // 检查是否所有 level 都有数据
      if (spec.levels.every(l => cumulativeBest.has(l))) {
        let sum = 0
        for (const l of spec.levels) {
          sum += cumulativeBest.get(l)!
        }
        values.push(fmtValue(sum, metric.decimals!))
      }
      else {
        values.push(null)
      }
    }

    // 只保留最终有数据的玩家
    if (values.some(v => v !== null)) {
      players.push({
        uid,
        name: meta.name,
        avatar: meta.avatar,
        values,
      })
    }
  }

  // Step 6: 按最终值排序（与 sortOrder 一致）
  players.sort((a, b) => {
    const aLast = a.values.filter(v => v !== null).pop()
    const bLast = b.values.filter(v => v !== null).pop()
    if (aLast == null && bLast == null)
      return 0
    if (aLast == null)
      return 1
    if (bLast == null)
      return -1
    return metric.sortOrder === 'asc' ? aLast - bLast : bLast - aLast
  })

  console.log(`    最终玩家数: ${players.length}`)

  return {
    meta: {
      totalPlayers: players.length,
      totalDates: dates.length,
      dateRange: [dates[0]!, dates[dates.length - 1]!],
    },
    dates,
    players,
  }
}

// ======== 主流程 ========

function main() {
  console.log('=== Bar Chart Race 数据生成工具 ===')
  console.log(`输出目录: ${WEB_DIR}`)
  console.log('')

  fs.mkdirSync(WEB_DIR, { recursive: true })

  // 先同步头像缓存
  const urlToLocal = ensureAvatars()
  console.log('')

  for (const spec of GAMES) {
    for (const metric of spec.metrics) {
      const fileName = `race_data_${spec.dir}_${metric.key}.json`
      const filePath = path.join(WEB_DIR, fileName)
      console.log(`生成: ${fileName}`)

      try {
        const raceData = generateRaceData(spec, metric, urlToLocal)
        fs.writeFileSync(filePath, JSON.stringify(raceData))
        const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2)
        console.log(`  ✅ 已保存 — ${sizeMB} MB, ${raceData.meta.totalPlayers} 玩家, ${raceData.meta.totalDates} 天`)
        console.log(`     日期: ${raceData.meta.dateRange[0]} ~ ${raceData.meta.dateRange[1]}`)
      }
      catch (err) {
        console.error(`  ❌ 失败:`, err)
      }
    }
  }

  console.log('\n=== 全部完成 ===')
}

main()
