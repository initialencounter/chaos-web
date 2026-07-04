/**
 * 按扫雷(timing)分数排名抓取前 1000 名玩家的扫雷历史记录
 *
 * 用法: npx tsx bar_chart_race/minesweeper/fetch_data_by_timing_rank.ts
 *
 * 与 fetch_data.ts 的区别:
 *   - 该脚本按 composite-rank-state.json 中 games.timing.score 降序排列取前 1000
 *   - 而非按综合总分 totalScore 排序
 *   - 复用同一个 data 目录，已有的玩家数据不会重复抓取
 */

import type { PlayerData, ProgressData } from './fetch_data.js'
import fs from 'node:fs'

import path from 'node:path'
import {
  DATA_DIR,
  fetchAllRecords,
  LEVELS,

  RANK_FILE,
  REQUEST_DELAY_MS,
  savePlayerData,
  sleep,
} from './fetch_data.js'

// ======== 配置 ========
const TOP_N = 1000
const PROGRESS_FILE = path.join(DATA_DIR, 'progress_timing_rank.json')

// ======== 类型 ========
interface RankEntry {
  uid: string
  nickName: string
  avatar: string
  timingScore: number
}

// ======== 读取排行榜，按扫雷(timing)分数排序 ========

function readRankEntries(): RankEntry[] {
  const raw = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'))
  const entries = raw.entries as any[]

  // 筛选有扫雷(timing)数据的玩家，按 timing.score 降序排列
  return entries
    .filter((e: any) => e.games?.timing?.score != null)
    .sort((a: any, b: any) => b.games.timing.score - a.games.timing.score)
    .slice(0, TOP_N)
    .map((e: any) => ({
      uid: String(e.uid),
      nickName: e.nickName,
      avatar: e.avatar,
      timingScore: e.games.timing.score,
    }))
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

// ======== 主流程 ========

async function main() {
  console.log('=== 扫雷历史记录抓取工具 (按timing分数排名) ===')
  console.log(`排行榜文件: ${RANK_FILE}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`按 games.timing.score 降序取前 ${TOP_N} 名玩家`)
  console.log('')

  // 读取排行榜
  const entries = readRankEntries()
  console.log(`读取到 ${entries.length} 名扫雷玩家`)
  console.log(`最高分: ${entries[0]?.timingScore.toFixed(2)} (${entries[0]?.nickName})`)
  console.log(`最低分: ${entries[entries.length - 1]?.timingScore.toFixed(2)} (${entries[entries.length - 1]?.nickName})`)
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
    const { uid, nickName, avatar, timingScore } = entry

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

    console.log(`\n[${i + 1}/${entries.length}] 玩家: ${nickName} (uid=${uid}, timingScore=${timingScore.toFixed(2)})`)

    const playerData: PlayerData = {
      uid,
      nickName,
      avatar,
      records: {},
    }

    for (const level of LEVELS) {
      const levelNames = { 3: '高级', 2: '中级', 1: '初级' } as const
      console.log(`  开始抓取 level=${level} (${levelNames[level as keyof typeof levelNames]})`)
      const records = await fetchAllRecords(uid, level)
      playerData.records[level] = records

      await sleep(REQUEST_DELAY_MS)
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
