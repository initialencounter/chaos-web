import type { ApiResponse, FullUser } from './common'

// ========== 用户主页 ==========
export interface SaoleiOauth {
  avatar: string
  createTime: string
  id: number
  name: string
  openId: string
  platform: number
  uid: string
}

export interface UserMatchMedal {
  icon: null | string
  id: number
  rank: number
  title: string
  uid: string
}

export interface HomeUser extends FullUser {
  accountStatus: number
  auth: number
  birthday: number | null
  createTime: number
  loginUserId: null
  province: string
  registerIp: string
  userId: string
  visits: number
}

export type UserHomeResponse = ApiResponse<{
  distance: number
  fansCount: number
  followCount: number
  saoleiOauth: null | SaoleiOauth
  user: HomeUser
  userMatchMedals: UserMatchMedal[]
}>

// ========== 用户搜索 ==========
export interface SearchUser {
  avatar?: string
  background?: string
  chaosInGame?: boolean
  chaosInView?: boolean
  country?: string
  id?: number
  mark?: string
  nickName?: string
  online?: boolean
  puzzleRank?: number
  pvpInGame?: boolean
  pvpInWait?: boolean
  relation?: number
  sex?: number
  sign?: string
  timingLevel?: number
  timingRank?: number
  uid?: string
  vip?: boolean
}

export type UserSearchResponse = ApiResponse<SearchUser[]>

// ========== 用户配置 ==========
export type UserConfigGetResponse = ApiResponse<{
  invisible: boolean
  minesweeperStyle: string
  puzzleStyle: string
  uid: string
}>
