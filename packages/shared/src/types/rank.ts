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
