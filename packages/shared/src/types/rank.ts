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
    total: number
    /** 搜索匹配的条目数（无搜索时为 0） */
    matchCount: number
    /** 搜索命中的第一个玩家 UID（前端用于高亮），无搜索时为空字符串 */
    matchUid: string
    page: number
    pageSize: number
    lastUpdated: number | null
    configName: string
    gameLabels: Record<string, string>
  }
  msg: string | null
}

/** 单项游戏排行榜响应（与 CompositeRankResponse 结构一致，但 entries 按该游戏分数排序） */
export type SingleGameRankResponse = CompositeRankResponse
