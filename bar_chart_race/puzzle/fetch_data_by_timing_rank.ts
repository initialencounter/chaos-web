import type { ProgressData } from '../minesweeper/fetch_data.js'
/**
 * 按数字华容道(puzzle)分数排名抓取前 1000 名玩家的历史记录
 *
 * 用法: npx tsx bar_chart_race/puzzle/fetch_data_by_timing_rank.ts
 *
 * 与扫雷脚本的区别:
 *   - 按 composite-rank-state.json 中 games.puzzle.score 降序排列取前 1000
 *   - API: /Minesweeper/puzzle/record/list
 *   - level: 3=3x3, 4=4x4, 5=5x5, 6=6x6, 7=7x7, 8=8x8, 9=9x9, 10=10x10
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
const COUNT_PER_PAGE = 100
const API_PATH = '/Minesweeper/puzzle/record/list'
/** 3=3x3, 4=4x4, 5=5x5, 6=6x6, 7=7x7, 8=8x8, 9=9x9, 10=10x10 */
const LEVELS = [3, 4, 5, 6, 7, 8, 9, 10]

const DATA_DIR = path.join(import.meta.dirname, 'data')
const PROGRESS_FILE = path.join(DATA_DIR, 'progress_timing_rank.json')

// ======== 类型 ========
type PuzzleRecord = Datum

interface PuzzleApiResponse {
  code: number
  data: PuzzleRecord[]
  msg: string | null
}

interface PlayerData {
  uid: string
  nickName: string
  avatar: string
  records: {
    [level: string]: PuzzleRecord[]
  }
}

interface RankEntry {
  uid: string
  nickName: string
  avatar: string
  puzzleScore: number
}

// ======== 分页获取某个玩家某个难度的所有记录 ========

async function fetchAllRecords(uid: string, level: number): Promise<PuzzleRecord[]> {
  const allRecords: PuzzleRecord[] = []
  let page = 0

  while (true) {
    const params = {
      targetUid: uid,
      level: level.toString(),
      blind: 'false',
      page: page.toString(),
      count: COUNT_PER_PAGE.toString(),
    }

    try {
      const res = await fetchApi(API_PATH, params) as unknown as PuzzleApiResponse

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

// ======== 读取排行榜，按数字华容道(puzzle)分数排序 ========

function readRankEntries(): RankEntry[] {
  const raw = JSON.parse(fs.readFileSync(RANK_FILE, 'utf-8'))
  const entries = raw.entries as any[]

  return entries
    .filter((e: any) => e.games?.puzzle?.score != null)
    .sort((a: any, b: any) => b.games.puzzle.score - a.games.puzzle.score)
    .slice(0, TOP_N)
    .map((e: any) => ({
      uid: String(e.uid),
      nickName: e.nickName,
      avatar: e.avatar,
      puzzleScore: e.games.puzzle.score,
    }))
}

// ======== 读取/保存进度 ========

function loadProgress(): ProgressData {
  if (fs.existsSync(PROGRESS_FILE)) {
    const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    // 如果 LEVELS 发生了变更（例如新增了 6-10），重置进度以重新检查所有玩家
    if (raw.levels != null) {
      const oldLevels = raw.levels as number[]
      if (oldLevels.length !== LEVELS.length || oldLevels.some((l, i) => l !== LEVELS[i])) {
        console.log(`⚠️  检测到 LEVELS 变更 (上次: [${oldLevels.join(',')}], 当前: [${LEVELS.join(',')}])`)
        console.log('   将重新检查所有玩家，补充缺失的难度数据')
        return { fetchedUids: [], lastIndex: -1, totalPlayers: 0 }
      }
    }
    return { fetchedUids: raw.fetchedUids ?? [], lastIndex: raw.lastIndex ?? -1, totalPlayers: raw.totalPlayers ?? 0 }
  }
  return { fetchedUids: [], lastIndex: -1, totalPlayers: 0 }
}

function saveProgress(progress: ProgressData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ ...progress, levels: LEVELS }, null, 2))
}

// ======== 主流程 ========

async function main() {
  console.log('=== 数字华容道历史记录抓取工具 (按puzzle分数排名) ===')
  console.log(`排行榜文件: ${RANK_FILE}`)
  console.log(`数据目录: ${DATA_DIR}`)
  console.log(`按 games.puzzle.score 降序取前 ${TOP_N} 名玩家`)
  console.log(`难度: 3x3 ~ 10x10`)
  console.log('')

  // 读取排行榜
  const entries = readRankEntries()
  console.log(`读取到 ${entries.length} 名数字华容道玩家`)
  console.log(`最高分: ${entries[0]?.puzzleScore.toFixed(2)} (${entries[0]?.nickName})`)
  console.log(`最低分: ${entries[entries.length - 1]?.puzzleScore.toFixed(2)} (${entries[entries.length - 1]?.nickName})`)
  console.log('')

  // 读取进度
  const progress = loadProgress()
  console.log(`已抓取: ${progress.fetchedUids.length} 名玩家, 上次索引: ${progress.lastIndex}`)

  let successCount = 0
  let skipCount = 0

  // 如果上次进度已到末尾，从头开始重新检查缺失的 level
  let startIndex = progress.lastIndex + 1
  if (startIndex >= entries.length) {
    console.log('进度已到末尾，重置索引以检查缺失的 level...')
    startIndex = 0
  }

  for (let i = startIndex; i < entries.length; i++) {
    const entry = entries[i]
    const { uid, nickName, avatar, puzzleScore } = entry

    // 加载已有数据，确定需要抓取的 level
    const dataFile = path.join(DATA_DIR, `${uid}.json`)
    let playerData: PlayerData = {
      uid,
      nickName,
      avatar,
      records: {},
    }
    let existingLevels: Set<number>

    if (fs.existsSync(dataFile)) {
      const existing = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as PlayerData
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

    console.log(`\n[${i + 1}/${entries.length}] 玩家: ${nickName} (uid=${uid}, puzzleScore=${puzzleScore.toFixed(2)})`)
    console.log(`  已有 level: ${[...existingLevels].join(', ') || '(无)'}, 待抓取: ${levelsToFetch.join(', ')}`)

    for (const level of levelsToFetch) {
      console.log(`  开始抓取 level=${level}`)
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
