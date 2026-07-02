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
  getLeaderboard: () => CompositeRankEntry[]
  getLastPollTime: () => number | null
  getConfig: () => CompositeRankConfig
  getGameLabels: () => Record<string, string>
  loadFromDisk: () => void
  saveToDisk: () => void
  startAutoPoll: () => void
  stopAutoPoll: () => void
}
