import type { ProgressData } from '../minesweeper/fetch_data.js'
/**
 * 按数织(nono)分数排名抓取前 1000 名玩家的历史记录
 *
 * 用法: npx tsx bar_chart_race/nono/fetch_data_by_timing_rank.ts
 *
 * API: POST /Minesweeper/nono/record/user/list
 * 参数: uid, level (1=初级, 2=中级, 3=高级, 4=专家), page, count
 */
import type { Datum } from './types.js'
import fs from 'node:fs'
import path from 'node:path'
import {
  fetchApi,
  RANK_FILE,
  REQUEST_DELAY_MS,
  sleep,
} from '../minesweeper/fetch_data.js'

// ======== 配置 ========
const TOP_N = 1000
const COUNT_PER_PAGE = 20
const API_PATH = '/Minesweeper/nono/record/user/list'
/** 1=初级, 2=中级, 3=高级, 4=专家 */
const LEVELS = [1, 2, 3, 4]

const DATA_DIR = path.join(import.meta.dirname, 'data')
const PROGRESS_FILE = path.join(DATA_DIR, 'progress_timing_rank.json')

// ======== 类型 ========
type NonoRecord = Datum

interface NonoApiResponse {
  code: number
  data: NonoRecord[]
  msg: string | null
}

interface PlayerData {
  uid: string
  nickName: string
  avatar: string
  records: {
    [level: string]: NonoRecord[]
  }
}

interface RankEntry {
  uid: string
  nickName: string
  avatar: string
  nonoScore: number
}

// ======== 分页获取某个玩家某个难度的所有记录 ========

async function fetchAllRecords(uid: string, level: number): Promise<NonoRecord[]> {
  const allRecords: NonoRecord[] = []
  let page = 0

  while (true) {
    const params = {
      uid,
      level: level.toString(),
      page: page.toString(),
      count: COUNT_PER_PAGE.toString(),
    }

    try {
      const res = await fetchApi(API_PATH, params) as unknown as NonoApiResponse

      if (res.code !== 200 || !Array.isArray(res.data)) {
        console.warn(`  [WARN] uid=${uid} level=${level} page=${page} code=${res.code}`)
        break
      }

      if (res.data.length === 0)
        break

      allRecords.push(...res.data)
      console.log(`  uid=${uid} level=${level} page=${page} → ${res.data.length} 条记录`)

      if (res.data.length < COUNT_PER_PAGE)
        break

      page++
    }
    catch (err) {
      console.error(`  [ERROR] uid=${uid} level=${level} page=${page}:`, err)
      break
    }
  }

  return allRecords
}

// ======== 保存玩家数据 ========

function savePlayerData(player: PlayerData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, `${player.uid}.json`)
  fs.writeFileSync(filePath, JSON.stringify(player, null, 2))
}

// ======== 读取排行榜，按数织(nono)分数排序 ========

function readRankEntries(): RankEntry[] {
  const raw = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'))
  const entries = raw.entries as any[]

  return entries
    .filter((e: any) => e.games?.nono?.score != null)
    .sort((a: any, b: any) => b.games.nono.score - a.games.nono.score)
    .slice(0, TOP_N)
    .map((e: any) => ({
      uid: String(e.uid),
      nickName: e.nickName,
      avatar: e.avatar,
      nonoScore: e.games.nono.score,
    }))
}

// ======== 读取/保存进度 ========

function loadProgress(): ProgressData {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  }
  return { fetchedUids: [], lastIndex: -1, totalPlayers: 0 }
}

function saveProgress(progress: ProgressData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ======== 主流程 ========

async function main() {
  console.log('=== 数织历史记录抓取工具 (按nono分数排名) ===')
  console.log(`排行榜文件: ${RANK_FILE}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`按 games.nono.score 降序取前 ${TOP_N} 名玩家`)
  console.log(`难度: 初级(1), 中级(2), 高级(3), 专家(4)`)
  console.log('')

  // 读取排行榜
  const entries = readRankEntries()
  console.log(`读取到 ${entries.length} 名数织玩家`)
  console.log(`最高分: ${entries[0]?.nonoScore.toFixed(2)} (${entries[0]?.nickName})`)
  console.log(`最低分: ${entries[entries.length - 1]?.nonoScore.toFixed(2)} (${entries[entries.length - 1]?.nickName})`)
  console.log('')

  // 读取进度
  const progress = loadProgress()
  console.log(`已抓取: ${progress.fetchedUids.length} 名玩家, 上次索引: ${progress.lastIndex}`)

  const fetchedSet = new Set(progress.fetchedUids)
  let successCount = 0
  let skipCount = 0

  const startIndex = progress.lastIndex + 1

  const levelNames = { 1: '初级', 2: '中级', 3: '高级', 4: '专家' } as const

  for (let i = startIndex; i < entries.length; i++) {
    const entry = entries[i]
    const { uid, nickName, avatar, nonoScore } = entry

    // 跳过已抓取的
    if (fetchedSet.has(uid)) {
      skipCount++
      continue
    }

    // 已有数据则跳过
    const dataFile = path.join(DATA_DIR, `${uid}.json`)
    if (fs.existsSync(dataFile)) {
      console.log(`  ⏭ 数据已存在，跳过`)
      skipCount++
      progress.fetchedUids.push(uid)
      progress.lastIndex = i
      progress.totalPlayers = entries.length
      saveProgress(progress)
      fetchedSet.add(uid)
      continue
    }

    console.log(`\n[${i + 1}/${entries.length}] 玩家: ${nickName} (uid=${uid}, nonoScore=${nonoScore.toFixed(2)})`)

    const playerData: PlayerData = {
      uid,
      nickName,
      avatar,
      records: {},
    }

    // 并行请求所有难度
    await Promise.all(LEVELS.map(async (level) => {
      console.log(`  开始抓取 level=${level} (${levelNames[level as keyof typeof levelNames]})`)
      const records = await fetchAllRecords(uid, level)
      playerData.records[level] = records
    }))

    savePlayerData(playerData)
    const totalRecords = Object.values(playerData.records).reduce((sum, r) => sum + r.length, 0)
    console.log(`  ✅ 已保存, 共 ${totalRecords} 条记录`)

    // 更新进度
    progress.fetchedUids.push(uid)
    progress.lastIndex = i
    progress.totalPlayers = entries.length
    saveProgress(progress)
    fetchedSet.add(uid)
    successCount++

    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\n=== 抓取完成 ===`)
  console.log(`成功: ${successCount}, 跳过: ${skipCount}`)
  console.log(`数据保存在: ${DATA_DIR}`)
}

main().catch((err) => {
  console.error('抓取失败:', err)
  process.exit(1)
})
