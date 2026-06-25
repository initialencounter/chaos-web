import type { ApiResponse, BaseUser, FullUser } from './common'

// ========== 扫雷记录 ==========
export interface ActionRecord {
  action: number
  column: number
  row: number
  time: number
}

export interface RecordGetData {
  bv: number
  bvs: number
  collect: boolean
  column: number
  createTime: number
  effectiveTap: number
  estimatedTime: number
  finished: boolean
  handle: string
  id: number
  map: string
  mapStatus: string
  mine: number
  mode: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  solvedBv: number
  tap: number
  themeId: number
  time: number
  type: number
  uid: string
  upload: boolean
  user: BaseUser
}

export interface ReplyData extends RecordGetData {
  actions: ActionRecord[]
}

export type RecordGetResponse = ApiResponse<RecordGetData>

/** 经典模式提交成功后的返回值 */
export interface TimingSuccessData {
  recordId: number
  postId: number
  rankPercent: number
  newRank: number
  oldRank: number
  newTime: number
  timeDay: number
  timeDayNew: number
  timeWeek: number
  timeWeekNew: number
  timeMonth: number
  timeMonthNew: number
  newBvs: number
  bvsDay: number
  bvsDayNew: number
  bvsWeek: number
  bvsWeekNew: number
  bvsMonth: number
  bvsMonthNew: number
  coin: number
  times: number[]
  bvs: number[]
  timeRefreshes: boolean[]
  bvsRefreshes: boolean[]
}

export type TimingSuccessResponse = ApiResponse<TimingSuccessData>

export interface MinesweeperRecordListUser extends BaseUser {
  background: null
  country: null
  mark: null
  sign: null
}

export interface MinesweeperRecordListDatum {
  bv: number
  bvs: number
  collect: boolean
  column: number
  createTime: number
  effectiveTap: number
  estimatedTime: number
  finished: boolean
  handle: null
  id: number
  map: null
  mapStatus: null
  mine: number
  mode: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  solvedBv: number
  tap: number
  themeId: number
  time: number
  type: number
  uid: string
  upload: boolean
  user: MinesweeperRecordListUser
}

export type MinesweeperRecordListResponse = ApiResponse<MinesweeperRecordListDatum[]>

// ========== 舒尔特记录 ==========
export interface SchulteActionRecord {
  idx: number
  right: 0 | 1
  time: number
}

export interface SchulteRecordListUser extends BaseUser {
  background: null
  country: null
  mark: null
  sign: null
}

export interface SchulteRecordListDatum {
  actions: null
  blind: boolean
  collect: boolean
  column: number
  createTime: number
  id: number
  map: null
  maps: null
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  reactionTime: number
  row: number
  tap: number
  tapCorrect: number
  time: number
  type: number
  uid: null
  user: SchulteRecordListUser
}

export type SchulteRecordListFilterResponse = ApiResponse<SchulteRecordListDatum[]>

export type SchulteRecordGetResponse = ApiResponse<{
  actions: string
  blind: boolean
  collect: boolean
  column: number
  createTime: number
  id: number
  map: string
  maps: string
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  reactionTime: number
  row: number
  tap: number
  tapCorrect: number
  time: number
  type: number
  uid: null
  user: FullUser
}>

// ========== 拼图记录 ==========
export interface PuzzleActionRecord {
  column: number
  row: number
  time: number
}

export interface TzfeActionRecord {
  action: number // 0左, 1上, 2右, 3下
  time: number
}

export interface PuzzleRecordListUser extends BaseUser {
  background: null
  country: null
  mark: null
  sign: null
}

export interface PuzzleRecordListDatum {
  action: null
  blind: boolean
  collect: boolean
  column: number
  createTime: number
  id: number
  map: null
  observeTime: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  step: number
  swipe: boolean
  time: number
  uid: null
  user: PuzzleRecordListUser
}

export type PuzzleRecordListFilterResponse = ApiResponse<PuzzleRecordListDatum[]>

export type PuzzleRecordGetResponse = ApiResponse<{
  action: string
  blind: boolean
  collect: boolean
  column: number
  createTime: number
  id: number
  map: string
  observeTime: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  step: number
  swipe: boolean
  time: number
  uid: null
  user: FullUser
}>

// ========== 2048 记录 ==========
export interface TzfeRecordListUser extends BaseUser {
  background: null
  country: null
  mark: null
  sign: null
}

export interface TzfeRecordListDatum {
  actions: null
  beginMap: null
  collect: boolean
  column: number
  createTime: number
  id: number
  map: string
  maxValue: number
  playCount: number
  postId: number
  row: number
  score: number
  scoreRank: number
  scoreRankPercent: number
  seed: number
  stageTimes: string
  time: number
  timeRankPercent: number
  timeTank: number
  uid: string
  user: TzfeRecordListUser
}

export type TzfeRecordListFilterResponse = ApiResponse<TzfeRecordListDatum[]>

export type TzfeRecordGetResponse = ApiResponse<{
  actions: string | null
  beginMap: string | null
  collect: boolean
  column: number
  createTime: number
  id: number
  map: string
  maxValue: number
  playCount: number
  postId: number
  row: number
  score: number
  scoreRank: number
  scoreRankPercent: number
  seed: number
  stageTimes: string | null
  time: number
  timeRankPercent: number
  timeTank: number
  uid: string
  user: FullUser
}>

// ========== 数织记录 ==========
export interface NonoRecordListUser extends BaseUser {
  background: null
  country: null
  mark: null
  sign: null
}

export interface NonoRecordListDatum {
  collect: boolean
  column: number
  createTime: number
  finishMode: number
  handle: null
  id: number
  map: null
  mine: number
  mode: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  themeId: number
  time: number
  type: number
  uid: string
  upload: boolean
  user: NonoRecordListUser
}

export type NonoRecordListFilterResponse = ApiResponse<NonoRecordListDatum[]>

export interface NonoRecordGetData {
  collect: boolean
  column: number
  createTime: number
  finishMode: number
  handle: string
  id: number
  map: string
  mine: number
  mode: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  themeId: number
  time: number
  type: number
  uid: string
  upload: boolean
  user: BaseUser
}

export type NonoRecordGetResponse = ApiResponse<NonoRecordGetData>

// ========== 混沌扫雷用户记录 ==========
export interface ChaosUserRecordDatum {
  correct: number
  createTime: number
  id: number
  incorrect: number
  rank: number
  recordId: number
  score: number
  uid: string
}

export type MinesweeperChaosListUserRecord = ApiResponse<ChaosUserRecordDatum[]>
