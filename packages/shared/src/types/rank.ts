import type { ApiResponse, BaseUser } from './common'

// ========== 通用排行榜条目 ==========
export interface RankDatum {
  bvs: number
  createTime: unknown
  exp: number
  level: number
  lose: number
  movesArray: unknown
  rank: number
  rankHistory: number
  record: unknown
  recordId: number
  score: number
  stage: number
  time: number
  timeArray: unknown
  timeBeg: number
  timeExp: number
  timeInt: number
  timePro: number
  uid: string
  user: BaseUser
  win: number
}

// ========== 混沌排行榜 (奖牌) ==========
export type RankChaosList = ApiResponse<RankDatum[]>

// ========== 混沌排行榜 (分数) ==========
export type RankChaosScoreList = ApiResponse<RankDatum[]>

// ========== 财富排行榜 ==========
export type RankCoinList = ApiResponse<RankDatum[]>

// ========== 综合游戏排行榜 ==========
export interface CompositeRankGameScore {
  /** 排名 */
  rank: number
  /** 0-5 评分 */
  score: number
}

export interface CompositeRankEntry {
  uid: string
  nickName: string
  avatar: string
  /** 各游戏排名与评分 */
  games: Record<string, CompositeRankGameScore>
  /** 最终得分 s_final = 10√(S^T·w)，范围 0-100 */
  totalScore: number
  /** 综合百分比（同 totalScore，范围 0-100） */
  compositePercent: number
}

export interface CompositeRankResponse {
  code: number
  data: {
    entries: CompositeRankEntry[]
    lastUpdated: number
    configName: string
    gameLabels: Record<string, string>
  }
  msg: string | null
}
