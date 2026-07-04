/**
 * 按舒尔特方格分数排名抓取前 1000 名玩家的舒尔特历史记录
 *
 * 用法: npx tsx bar_chart_race/schulte/fetch_data_by_timing_rank.ts
 *
 * API: POST /Minesweeper/schulte/record/list
 * 参数: targetUid, level (3~10), type=0, blind=false, page, count
 *
 * 与 minesweeper/fetch_data_by_timing_rank.ts 共享 fetchApi 等加密/请求工具，
 * 使用 Promise.allSettled 并行请求多个 level 以加速获取。
 * 支持断点续抓：已存在的玩家数据文件会被读取，只抓取缺失的 level 并合并。
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
const LEVELS = [3, 4, 5, 6, 7, 8, 9, 10] // 3x3 ~ 10x10

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

  let successCount = 0
  let skipCount = 0

  let startIndex = progress.lastIndex + 1

  // 如果上次进度已到末尾，从头开始重新检查缺失的 level
  if (startIndex >= entries.length) {
    console.log('进度已到末尾，重置索引以检查缺失的 level...')
    startIndex = 0
  }

  for (let i = startIndex; i < entries.length; i++) {
    const entry = entries[i]
    const { uid, nickName, avatar, schulteScore } = entry

    // 加载已有数据，确定需要抓取的 level
    const dataFile = path.join(DATA_DIR, `${uid}.json`)
    let playerData: SchultePlayerData = {
      uid,
      nickName,
      avatar,
      records: {},
    }
    let existingLevels: Set<number>

    if (fs.existsSync(dataFile)) {
      const existing = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as SchultePlayerData
      existingLevels = new Set(
        Object.keys(existing.records).map(Number).filter(l => existing.records[l].length > 0),
      )
      // 合并已更新的 nickName/avatar
      playerData = {
        uid: existing.uid,
        nickName: existing.nickName || nickName,
        avatar: existing.avatar || avatar,
        records: { ...existing.records },
      }
    }
    else {
      existingLevels = new Set()
    }

    const levelsToFetch = LEVELS.filter(l => !existingLevels.has(l))

    if (levelsToFetch.length === 0) {
      console.log(`  ⏭ 所有 level 已获取，跳过`)
      skipCount++
      progress.fetchedUids.push(uid)
      progress.lastIndex = i
      progress.totalPlayers = entries.length
      saveProgress(progress)
      continue
    }

    console.log(`\n[${i + 1}/${entries.length}] 玩家: ${nickName} (uid=${uid}, schulteScore=${schulteScore.toFixed(2)})`)
    console.log(`  已有 level: ${[...existingLevels].join(', ') || '(无)'}, 待抓取: ${levelsToFetch.join(', ')}`)

    // 并行请求缺失的 level
    const results = await Promise.allSettled(
      levelsToFetch.map(level => fetchAllRecords(uid, level)),
    )

    for (let j = 0; j < levelsToFetch.length; j++) {
      const level = levelsToFetch[j]
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
