// ========== 通用工具类型 ==========
export type Nullable<T> = T | null

export type Voidable<T> = T | null | undefined

// ========== 通用 API 响应包装 ==========
export interface ApiResponse<T> {
  code: number
  data: T
  msg: null
  url: null
}

// ========== 基础用户信息（可空字段版本 - 用于列表项） ==========
export interface BaseUser {
  avatar: string
  background: null | string
  chaosInGame: boolean
  chaosInView: boolean
  country: null | string
  id: number
  mark: null | string
  nickName: string
  online: boolean
  puzzleRank: number
  pvpInGame: boolean
  pvpInWait: boolean
  relation: number
  sex: number
  sign: null | string
  timingLevel: number
  timingRank: number
  uid: string
  vip: boolean
}

// ========== 完整用户信息（非空字段版本 - 用于详情页） ==========
export interface FullUser {
  avatar: string
  background: string
  chaosInGame: boolean
  chaosInView: boolean
  country: string
  id: number
  mark: string
  nickName: string
  online: boolean
  puzzleRank: number
  pvpInGame: boolean
  pvpInWait: boolean
  relation: number
  sex: number
  sign: string
  timingLevel: number
  timingRank: number
  uid: string
  vip: boolean
}
