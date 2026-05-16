import type { ApiResponse, BaseUser } from './common'

// ========== 通用段位排名结构 ==========
export interface TimeRankRecord {
  bvs: number
  column: number
  createTime: number | null
  finished: boolean
  id: number
  mine: number
  row: number
  time: number
}

export interface TimeRankUser extends BaseUser {
  background: string
  country: string
  mark: string
  sign: string
}

export interface TimeRank {
  bvs: number
  createTime: number | null
  exp: number
  level: number
  lose: number
  movesArray: null
  rank: number
  rankHistory: number
  record: TimeRankRecord
  recordId: number
  score: number
  stage: number
  time: number
  timeArray: null
  timeBeg: number
  timeExp: number
  timeInt: number
  timePro: number
  uid: string
  user: TimeRankUser
  win: number
}

// ========== 扫雷生涯 (计时模式) ==========
export type MinesweeperCareerResponse = ApiResponse<{
  begBvsRank: null
  begTimeRank: TimeRank | null
  expBvsRank: null
  expTimeRank: TimeRank | null
  intBvsRank: null
  intTimeRank: TimeRank | null
  statistics: null
  totalBvsRank: null
  totalTimeRank: TimeRank | null
  user: null
}>

// ========== 数独生涯 ==========
export type SudokuCareerResponse = ApiResponse<{
  countEasy: number
  countHard: number
  countHell: number
  countNormal: number
  rank: number
  scoreEasy: number
  scoreHard: number
  scoreHell: number
  scoreNormal: number
  user: null
}>

// ========== 拼图生涯 ==========
export interface PuzzleCareerUser {
  avatar: null
  background: null
  chaosInGame: boolean
  chaosInView: boolean
  country: null
  id: number
  mark: null
  nickName: null
  online: boolean
  puzzleRank: number
  pvpInGame: boolean
  pvpInWait: boolean
  relation: number
  sex: number
  sign: null
  timingLevel: number
  timingRank: number
  uid: string
  vip: boolean
}

export interface PuzzleCareerRank {
  bvs: number
  createTime: null
  exp: number
  level: number
  lose: number
  movesArray: null
  rank: number
  rankHistory: number
  record: TimeRankRecord
  recordId: number
  score: number
  stage: number
  time: number
  timeArray: null
  timeBeg: number
  timeExp: number
  timeInt: number
  timePro: number
  uid: string
  user: PuzzleCareerUser
  win: number
}

export type PuzzleCareerResponse = ApiResponse<{
  info3: PuzzleCareerRank
  info4: PuzzleCareerRank
  info5: PuzzleCareerRank
  infoTotal: PuzzleCareerRank
  user: null
}>

// ========== 数织生涯 ==========
export type NonoCareerResponse = ApiResponse<{
  begTimeRank: TimeRank
  expTimeRank: TimeRank
  intTimeRank: TimeRank
  proTimeRank: TimeRank
  statistics: null
  totalTimeRank: TimeRank
  user: null
}>

// ========== 2048 生涯 ==========
export type TzfeCareerResponse = ApiResponse<{
  countTotal: number
  level: number
  rankScore: number
  rankTime: number
  score: number
  scoreRecordId: number
  time: number
  timeRecordId: number
  value: number
}>

// ========== 舒尔特生涯 ==========
export type SchulteCareerResponse = ApiResponse<{
  countTotal: number
  rank: number
  time: number
}>

// ========== 混沌扫雷生涯 ==========
export type MinesweeperChaosCareer = ApiResponse<{
  lose: number
  rank: number
  win: number
}>
