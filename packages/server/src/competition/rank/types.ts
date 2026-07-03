import type { CompositeRankEntry } from '@tapsss/shared'

/**
 * 综合排行榜配置
 */
export interface CompositeRankConfig {
  /** 是否启用 */
  enabled: boolean
  /** 排行榜名称 */
  name: string
  /** 轮询间隔 (毫秒) */
  pollIntervalMs: number
  /** 每页拉取数量 */
  pageSize: number
}

/**
 * 游戏 API 定义
 */
export interface GameApi {
  key: string
  label: string
  path: string
  params?: Record<string, any>
}

/**
 * 排行榜查询参数
 */
export interface LeaderboardQuery {
  /** 页码，从 1 开始 */
  page?: number
  /** 每页条数，默认 100 */
  pageSize?: number
  /** 搜索关键词（匹配昵称或 UID） */
  search?: string
  /** 按哪个游戏排序，不传则按综合评分排序 */
  gameKey?: string
}

/**
 * 排行榜查询结果
 */
export interface LeaderboardResult {
  entries: CompositeRankEntry[]
  /** 全部条目总数（用于分页） */
  total: number
  /** 搜索匹配的条目数（无搜索时为 0） */
  matchCount: number
  /** 搜索命中的第一个玩家 UID（前端用于高亮），无搜索时为空 */
  matchUid: string
  page: number
  pageSize: number
}

/**
 * 引擎内部状态
 */
export interface CompositeRankState {
  config: CompositeRankConfig
  entries: CompositeRankEntry[]
  lastPollTime: number | null
}

/**
 * 引擎依赖
 */
export interface CompositeRankDeps {
  executeRequest: <T>(path: string, method: string, params: Record<string, any>) => Promise<T>
  cacheDir: string
  logger: Pick<Console, 'log' | 'warn' | 'error'>
}

/**
 * 引擎公开接口
 */
export interface CompositeRankEngine {
  poll: () => Promise<void>
  /** 查询排行榜（支持分页、搜索、按游戏排序） */
  getLeaderboard: (query?: LeaderboardQuery) => LeaderboardResult
  getLastPollTime: () => number | null
  getConfig: () => CompositeRankConfig
  getGameLabels: () => Record<string, string>
  loadFromDisk: () => void
  saveToDisk: () => void
  startAutoPoll: () => void
  stopAutoPoll: () => void
}
