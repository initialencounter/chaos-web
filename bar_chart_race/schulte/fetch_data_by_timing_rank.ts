/**
 * 按舒尔特方格分数排名抓取前 1000 名玩家的舒尔特历史记录
 *
 * 用法: npx tsx bar_chart_race/schulte/fetch_data_by_timing_rank.ts
 *
 * API: POST /Minesweeper/schulte/record/list
 * 参数: targetUid, level (3=3x3, 4=4x4, 5=5x5), type=0, blind=false, page, count
 *
 * 与 minesweeper/fetch_data_by_timing_rank.ts 共享 fetchApi 等加密/请求工具，
 * 使用 Promise.allSettled 并行请求 3 个 level 以加速获取。
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
const API_PATH = '/Minesweeper/schulte/record/list'
const LEVELS = [3, 4, 5] // 3x3, 4x4, 5x5

// ======== 路径 ========
const DATA_DIR = path.join(import.meta.dirname, 'data')
const PROGRESS_FILE = path.join(DATA_DIR, 'progress_timing_rank.json')

// ======== 类型 ========
interface RankEntry {
  uid: string
  nickName: string
  avatar: string
  schulteScore: number
}

interface SchultePlayerData {
  uid: string
  nickName: string
  avatar: string
  records: {
    [level: string]: Datum[]
  }
}

interface ProgressData {
  fetchedUids: string[]
  lastIndex: number
  totalPlayers: number
}

// ======== 读取排行榜，按舒尔特(schulte)分数排序 ========

function readRankEntries(): RankEntry[] {
  const raw = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'))
  const entries = raw.entries as any[]

  // 筛选有舒尔特数据的玩家，按 schulte.score 降序排列
  return entries
    .filter((e: any) => e.games?.schulte?.score != null)
    .sort((a: any, b: any) => b.games.schulte.score - a.games.schulte.score)
    .slice(0, TOP_N)
    .map((e: any) => ({
      uid: String(e.uid),
      nickName: e.nickName,
      avatar: e.avatar,
      schulteScore: e.games.schulte.score,
    }))
}

// ======== 分页获取某个玩家某个模式的所有记录 ========

async function fetchAllRecords(uid: string, level: number): Promise<Datum[]> {
  const allRecords: Datum[] = []
  let page = 0

  while (true) {
    const params = {
      targetUid: uid,
      level: level.toString(),
      type: '0',
      blind: 'false',
      page: page.toString(),
      count: COUNT_PER_PAGE.toString(),
    }

    try {
      const res = await (fetchApi(API_PATH, params) as Promise<{ code: number, data: Datum[], msg: string | null }>)

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

// ======== 读取进度 ========

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

// ======== 保存玩家数据 ========

function savePlayerData(player: SchultePlayerData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, `${player.uid}.json`)
  fs.writeFileSync(filePath, JSON.stringify(player, null, 2))
}

// ======== 主流程 ========

async function main() {
  console.log('=== 舒尔特方格历史记录抓取工具 (按schulte分数排名) ===')
  console.log(`排行榜文件: ${RANK_FILE}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`按 games.schulte.score 降序取前 ${TOP_N} 名玩家`)
  console.log(`并行请求 level: ${LEVELS.join(', ')}`)
  console.log('')

  // 读取排行榜
  const entries = readRankEntries()
  console.log(`读取到 ${entries.length} 名舒尔特玩家`)
  console.log(`最高分: ${entries[0]?.schulteScore.toFixed(2)} (${entries[0]?.nickName})`)
  console.log(`最低分: ${entries[entries.length - 1]?.schulteScore.toFixed(2)} (${entries[entries.length - 1]?.nickName})`)
  console.log('')

  // 读取进度
  const progress = loadProgress()
  console.log(`已抓取: ${progress.fetchedUids.length} 名玩家, 上次索引: ${progress.lastIndex}`)

  const fetchedSet = new Set(progress.fetchedUids)
  let successCount = 0
  let skipCount = 0

  const startIndex = progress.lastIndex + 1

  for (let i = startIndex; i < entries.length; i++) {
    const entry = entries[i]
    const { uid, nickName, avatar, schulteScore } = entry

    // 跳过已抓取的（通过 progress 记录）
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

    console.log(`\n[${i + 1}/${entries.length}] 玩家: ${nickName} (uid=${uid}, schulteScore=${schulteScore.toFixed(2)})`)

    const playerData: SchultePlayerData = {
      uid,
      nickName,
      avatar,
      records: {},
    }

    // 并行请求所有 level
    const results = await Promise.allSettled(
      LEVELS.map(level => fetchAllRecords(uid, level)),
    )

    for (let j = 0; j < LEVELS.length; j++) {
      const level = LEVELS[j]
      const result = results[j]
      if (result.status === 'fulfilled') {
        playerData.records[level] = result.value
      }
      else {
        console.error(`  ❌ level=${level} 请求失败:`, result.reason)
        playerData.records[level] = []
      }
    }

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
