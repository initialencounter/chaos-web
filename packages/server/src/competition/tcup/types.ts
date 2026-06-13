import type { TcupLeaderboard } from '@tapsss/shared'
import type { CompetitionEntry } from '../types'

// ─── 难度配置 ───

export interface TcupDifficultyConfig {
  /** 难度标识: 'primary' | 'intermediate' | 'advanced' */
  key: string
  /** 显示名称: '初级' | '中级' | '高级' */
  name: string
  /** 棋盘面积 (row * column) */
  area: number
  /** 雷数 */
  mine: number
  /** 时间排名第一名积分 */
  timeMaxPoints: number
  /** 3BV/s 排名第一名积分 */
  bvsMaxPoints: number
  /** 最小3BV 排名第一名积分 */
  minBvMaxPoints: number
  /** 最大3BV 排名第一名积分 */
  maxBvMaxPoints: number
}

// ─── 比赛配置 ───

export interface TcupConfig {
  /** 比赛名称 */
  name: string
  postId: number
  startTime: number
  endTime: number
  replayPrefix: string
  requiredType: number
  pollIntervalMs: number
  commentsPerPage: number
  repliesPerPage: number
  blacklist: string[]
  difficulties: TcupDifficultyConfig[]
  /** 总时间排名第一名积分 */
  totalTimeMaxPoints: number
  /** 总3BV/s 排名第一名积分 */
  totalBvsMaxPoints: number
}

// ─── 最佳值 ───

export interface MetricBest {
  entry: CompetitionEntry
  value: number
}

// ─── 玩家单难度最佳 ───

export interface DifficultyPlayerBest {
  bestTime: MetricBest | null
  bestBvs: MetricBest | null
  minBv: MetricBest | null
  maxBv: MetricBest | null
}

// ─── 玩家聚合 ───

export interface PlayerAggregate {
  uid: string
  nickName: string
  avatar: string
  difficultyBests: Record<string, DifficultyPlayerBest>
  /** 三难度最佳时间之和 (秒), 若缺难度则为 Infinity */
  totalTime: number
  /** 三难度最佳 3BV/s 之和, 若缺难度则为 -Infinity */
  totalBvs: number
  /** 总积分 */
  totalPoints: number
  /** 各类别得分明细, key 如 'primary-time', 'total-bvs' */
  categoryPoints: Record<string, number>
}

// ─── 引擎状态 ───

export interface TcupState {
  config: TcupConfig
  entries: Record<string, CompetitionEntry>
  lastPollTime: number | null
  statistics: {
    totalSubmissions: number
    totalValid: number
    totalFinal: number
  }
}

// ─── 引擎接口 ───

export interface TranscendenceCupEngine {
  poll: () => Promise<void>
  getLeaderboards: () => { leaderboards: TcupLeaderboard[], competitionTitle: string, competitionTimeWindow: string, totalSubmissions: number, totalValidEntries: number, totalFinalEntries: number }
  getLastPollTime: () => number | null
  getStatistics: () => TcupState['statistics']
  loadFromDisk: () => void
  saveToDisk: () => void
  startAutoPoll: () => void
  stopAutoPoll: () => void
}
