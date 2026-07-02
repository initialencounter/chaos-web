import type { CompositeRankEntry, CompositeRankGameScore, RankDatum } from '@tapsss/shared'
import type { CompositeRankConfig, CompositeRankDeps, CompositeRankEngine, CompositeRankState, GameApi } from './types'
import fs from 'node:fs'
import path from 'node:path'

// ---- 游戏 API 定义（与 RadarChart.vue 顺序一致） ----
const GAME_APIS: GameApi[] = [
  { key: 'timing', label: '扫雷', path: '/Minesweeper/rank/timing/list', params: { type: 0, mode: -1, level: 4 } },
  { key: 'schulte', label: '舒尔特', path: '/Minesweeper/rank/schulte/list', params: { row: 5, column: 5, type: 0, blind: false } },
  { key: 'puzzle', label: '华容道', path: '/Minesweeper/rank/puzzle/list', params: { blind: false } },
  { key: 'tzfe', label: '2048', path: '/Minesweeper/rank/tzfe/list', params: { row: 4, colum: 4, type: 0 } },
  { key: 'nono', label: '数织', path: '/Minesweeper/rank/nono/list', params: { level: 5 } },
  { key: 'sudoku', label: '数独', path: '/Minesweeper/rank/sudoku/list', params: {} },
]

const GAME_LABELS: Record<string, string> = Object.fromEntries(
  GAME_APIS.map(g => [g.key, g.label]),
)

// ---- 评分算法（来自 RadarChart.vue） ----
function computeScore(rank: number): number {
  let r = rank
  if (r === 0) {
    r = 3000
  }
  if (r < 1) {
    r = 1
  }
  if (r <= 10) {
    return 5 - (r - 1) / 36
  }
  return Math.max(0, 5 - 0.25 * (Math.log10(r)) ** 2)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 创建综合排行榜引擎
 * - 每 pollIntervalMs 毫秒拉取一次各游戏排名
 * - 按 uid 合并，计算综合评分
 * - 持久化到磁盘，重启后恢复
 */
export function createCompositeRankEngine(
  config: CompositeRankConfig,
  deps: CompositeRankDeps,
): CompositeRankEngine {
  const { executeRequest, cacheDir, logger } = deps
  const stateFilePath = path.join(cacheDir, 'composite-rank-state.json')

  const state: CompositeRankState = {
    config,
    entries: [],
    lastPollTime: null,
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function saveToDisk(): void {
    try {
      fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2))
      logger.log('[CompositeRank] 状态已保存到磁盘')
    }
    catch (err) {
      logger.error('[CompositeRank] 保存状态失败:', err)
    }
  }

  function loadFromDisk(): void {
    try {
      if (fs.existsSync(stateFilePath)) {
        const raw = fs.readFileSync(stateFilePath, 'utf-8')
        const loaded = JSON.parse(raw) as CompositeRankState
        state.entries = loaded.entries || []
        state.lastPollTime = loaded.lastPollTime
        logger.log(`[CompositeRank] 从磁盘加载了 ${state.entries.length} 条记录`)
      }
    }
    catch (err) {
      logger.error('[CompositeRank] 加载磁盘状态失败:', err)
    }
  }

  async function fetchGameRanks(api: GameApi): Promise<RankDatum[]> {
    try {
      const res = await executeRequest<{ code: number, data: RankDatum[] }>(
        api.path,
        'POST',
        { page: 0, count: config.pageSize, ...api.params },
      )
      if (res && res.code === 200 && Array.isArray(res.data)) {
        return res.data
      }
      logger.warn(`[CompositeRank] ${api.label} 排行获取异常:`, res)
      return []
    }
    catch (err) {
      logger.error(`[CompositeRank] ${api.label} 排行请求失败:`, err)
      return []
    }
  }

  async function poll(): Promise<void> {
    const now = Date.now()
    logger.log(`[CompositeRank] ===== 开始轮询 ${new Date(now).toISOString()} =====`)

    try {
      // 1. 并行拉取所有游戏排行
      const results = await Promise.all(GAME_APIS.map(api => fetchGameRanks(api)))

      // 2. 按 uid 合并
      const userMap = new Map<string, {
        uid: string
        nickName: string
        avatar: string
        games: Record<string, { rank: number }>
      }>()

      GAME_APIS.forEach((api, idx) => {
        for (const item of results[idx]!) {
          const uid = item.uid
          if (!uid)
            continue

          let entry = userMap.get(uid)
          if (!entry) {
            entry = {
              uid,
              nickName: item.user?.nickName || '',
              avatar: item.user?.avatar || '',
              games: {},
            }
            userMap.set(uid, entry)
          }

          entry.games[api.key] = {
            rank: item.rank || 0,
          }
        }
      })

      // 3. 计算评分
      const entries: CompositeRankEntry[] = []

      for (const user of userMap.values()) {
        const games: Record<string, CompositeRankGameScore> = {}
        let totalScore = 0

        for (const api of GAME_APIS) {
          const rank = user.games[api.key]?.rank || 0
          const score = round2(computeScore(rank))
          games[api.key] = { rank, score }
          totalScore += score
        }

        entries.push({
          uid: user.uid,
          nickName: user.nickName,
          avatar: user.avatar,
          games: Object.fromEntries(
            Object.entries(games).map(([k, v]) => [k, { rank: v.rank, score: round2(v.score) }]),
          ),
          totalScore: round2(totalScore),
          compositePercent: round2(totalScore * 100 / 30),
        })
      }

      // 4. 按综合评分降序排列
      entries.sort((a, b) => b.totalScore - a.totalScore)

      state.entries = entries
      state.lastPollTime = now

      logger.log(`[CompositeRank] 轮询完成: ${entries.length} 名玩家上榜`)

      // 5. 持久化
      saveToDisk()
    }
    catch (err) {
      logger.error('[CompositeRank] 轮询异常:', err)
    }
  }

  function getLeaderboard(): CompositeRankEntry[] {
    return state.entries
  }

  function getLastPollTime(): number | null {
    return state.lastPollTime
  }

  function getConfig(): CompositeRankConfig {
    return { ...state.config }
  }

  function getGameLabels(): Record<string, string> {
    return { ...GAME_LABELS }
  }

  function startAutoPoll(): void {
    if (pollTimer)
      return
    pollTimer = setInterval(() => {
      poll().catch(err => logger.error('[CompositeRank] 定时轮询出错:', err))
    }, config.pollIntervalMs)
    logger.log(`[CompositeRank] 自动轮询已启动，间隔 ${config.pollIntervalMs / 1000}s`)
  }

  function stopAutoPoll(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
      logger.log('[CompositeRank] 自动轮询已停止')
    }
  }

  return {
    poll,
    getLeaderboard,
    getLastPollTime,
    getConfig,
    getGameLabels,
    loadFromDisk,
    saveToDisk,
    startAutoPoll,
    stopAutoPoll,
  }
}
