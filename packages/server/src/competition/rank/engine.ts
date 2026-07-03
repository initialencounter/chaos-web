import type { CompositeRankEntry, CompositeRankGameScore, RankDatum } from '@tapsss/shared'
import type { CompositeRankConfig, CompositeRankDeps, CompositeRankEngine, CompositeRankState, GameApi, LeaderboardQuery, LeaderboardResult } from './types'
import fs from 'node:fs'
import path from 'node:path'
import { computeScore, computeTotalScore } from '@tapsss/shared'

// ---- 游戏 API 定义（与 RadarChart.vue 顺序一致） ----
const GAME_APIS: GameApi[] = [
  { key: 'timing', label: '扫雷', path: '/Minesweeper/rank/timing/list', params: { type: 0, mode: -1, level: 4 } },
  { key: 'schulte', label: '舒尔特', path: '/Minesweeper/rank/schulte/list', params: { row: 5, column: 5, type: 0, blind: false } },
  { key: 'puzzle', label: '华容道', path: '/Minesweeper/rank/puzzle/list', params: { blind: false } },
  { key: 'tzfe', label: '2048', path: '/Minesweeper/rank/tzfe/list', params: { row: 4, colum: 4, type: 0 } },
  { key: 'sudoku', label: '数独', path: '/Minesweeper/rank/sudoku/list', params: {} },
  { key: 'nono', label: '数织', path: '/Minesweeper/rank/nono/list', params: { level: 5 } },
]

const GAME_LABELS: Record<string, string> = Object.fromEntries(
  GAME_APIS.map(g => [g.key, g.label]),
)

// 权重向量 w = (5, 3.5, 4.5, 3, 1, 3)^T（按游戏 key 匹配）
const GAME_WEIGHTS: Record<string, number> = {
  timing: 5,
  schulte: 3.5,
  puzzle: 4.5,
  tzfe: 3,
  sudoku: 1,
  nono: 3,
}

/**
 * 判断两个时间戳是否在同一天
 */
function isSameDay(t1: number, t2: number): boolean {
  const d1 = new Date(t1)
  const d2 = new Date(t2)
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate()
}

/**
 * 计算下一个更新时间（每天 updateHour 点整）
 */
function getNextUpdateTime(updateHour: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(updateHour, 0, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime()
}

/**
 * 创建综合排行榜引擎
 * - 每天 updateHour 点定时拉取一次各游戏排名
 * - 按 uid 合并，计算综合评分
 * - 持久化到磁盘，重启后恢复（根据 JSON 中的 lastPollTime 判断当天是否已更新）
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

  let nextUpdateTimer: ReturnType<typeof setTimeout> | null = null

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
    const allData: RankDatum[] = []
    let page = 0

    while (true) {
      try {
        const res = await executeRequest<{ code: number, data: RankDatum[] }>(
          api.path,
          'POST',
          { page, count: config.pageSize, ...api.params },
        )
        if (res && res.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
          allData.push(...res.data)
          page++
          if (allData.length >= 3000)
            break
        }
        else {
          break
        }
      }
      catch (err) {
        logger.error(`[CompositeRank] ${api.label} 排行请求失败 (page=${page}):`, err)
        break
      }
    }

    logger.log(`[CompositeRank] ${api.label} 共拉取 ${allData.length} 条记录 (${page} 页)`)
    return allData
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
        const scores: number[] = []
        const weights: number[] = []

        for (const api of GAME_APIS) {
          const rank = user.games[api.key]?.rank || 0
          const score = computeScore(rank)
          const weight = GAME_WEIGHTS[api.key] || 1
          games[api.key] = { rank, score }
          scores.push(score)
          weights.push(weight)
        }

        // s_final = 10 × √(s_w)
        const finalScore = computeTotalScore(scores)

        entries.push({
          uid: user.uid,
          nickName: user.nickName,
          avatar: user.avatar,
          games: Object.fromEntries(
            Object.entries(games).map(([k, v]) => [k, { rank: v.rank, score: v.score }]),
          ),
          totalScore: finalScore,
          compositePercent: finalScore,
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

  function getLeaderboard(query: LeaderboardQuery = {}): LeaderboardResult {
    const {
      search = '',
      gameKey,
      pageSize = 100,
    } = query

    // 构建排序后的列表
    let sorted: CompositeRankEntry[]
    if (gameKey) {
      // 按指定游戏的 score 降序，无该游戏的排末尾
      sorted = [...state.entries].sort((a, b) => {
        const sa = a.games[gameKey]?.score ?? -1
        const sb = b.games[gameKey]?.score ?? -1
        return sb - sa
      })
    }
    else {
      // state.entries 已经是 totalScore 降序
      sorted = state.entries
    }

    const fullTotal = sorted.length
    let matchCount = 0
    let matchUid = ''
    let targetPage = query.page || 1

    // 搜索：定位到第一个匹配玩家所在的页
    if (search) {
      const q = search.toLowerCase()
      const matchIndexes: number[] = []

      for (let i = 0; i < sorted.length; i++) {
        const e = sorted[i]!
        if (e.nickName.toLowerCase().includes(q) || e.uid.includes(q)) {
          matchIndexes.push(i)
        }
      }

      matchCount = matchIndexes.length

      if (matchCount > 0) {
        const firstMatchIdx = matchIndexes[0]!
        targetPage = Math.floor(firstMatchIdx / pageSize) + 1
        matchUid = sorted[firstMatchIdx]!.uid
      }
    }

    const start = (targetPage - 1) * pageSize
    const entries = sorted.slice(start, start + pageSize)

    return { entries, total: fullTotal, matchCount, matchUid, page: targetPage, pageSize }
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

  /**
   * 执行一次更新，如果当天已更新过则跳过
   */
  async function scheduledUpdate(): Promise<void> {
    const now = Date.now()

    // 根据 JSON 中的 lastPollTime 判断当天是否已更新
    if (state.lastPollTime && isSameDay(state.lastPollTime, now)) {
      logger.log(`[CompositeRank] 今天已更新过 (${new Date(state.lastPollTime).toISOString()})，跳过`)
      scheduleNext()
      return
    }

    await poll()
    scheduleNext()
  }

  /**
   * 计算并安排在下一个 updateHour 触发更新
   */
  function scheduleNext(): void {
    if (nextUpdateTimer) {
      clearTimeout(nextUpdateTimer)
    }
    const nextTime = getNextUpdateTime(config.updateHour)
    const delayMs = nextTime - Date.now()
    nextUpdateTimer = setTimeout(() => {
      nextUpdateTimer = null
      scheduledUpdate().catch(err => logger.error('[CompositeRank] 定时更新出错:', err))
    }, delayMs)
    logger.log(`[CompositeRank] 下次更新时间: ${new Date(nextTime).toLocaleString()} (${Math.round(delayMs / 1000 / 60)} 分钟后)`)
  }

  function startAutoPoll(): void {
    if (nextUpdateTimer)
      return

    // 加载磁盘状态后，根据 lastPollTime 判断是否需要立即更新
    if (state.lastPollTime) {
      const now = Date.now()
      if (isSameDay(state.lastPollTime, now)) {
        // 今天已更新过，只安排下一次
        logger.log(`[CompositeRank] 今天已更新过，跳过启动更新，直接安排下次定时`)
        scheduleNext()
        return
      }
    }

    // 今天还没更新过，但重启不触发更新，直接安排到下一个零点
    logger.log(`[CompositeRank] 重启不触发更新，安排到下一个零点`)
    scheduleNext()
  }

  function stopAutoPoll(): void {
    if (nextUpdateTimer) {
      clearTimeout(nextUpdateTimer)
      nextUpdateTimer = null
      logger.log('[CompositeRank] 定时更新已停止')
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
