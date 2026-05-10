export interface LonginResponse {
  code: number
  data: Data | null
  msg: string | null
  url: null
}

export interface Data {
  accountStatus: number
  auth: number
  avatar: string
  background: null
  birthday: null
  chaosInGame: boolean
  chaosInView: boolean
  country: null
  createTime: number
  id: number
  loginUserId: string
  mail: string
  mark: null
  nickName: string
  online: boolean
  password: string
  phone: null
  province: null
  puzzleRank: number
  pvpInGame: boolean
  pvpInWait: boolean
  registerIp: string
  relation: number
  sex: number
  sign: null
  timingLevel: number
  timingRank: number
  token: string
  uid: string
  userId: string
  vip: boolean
  visits: number
}
