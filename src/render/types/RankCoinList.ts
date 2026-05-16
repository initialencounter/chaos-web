export interface RankCoinList {
  code: number
  data: Datum[]
  msg: null
  url: null
}

export interface Datum {
  bvs: number
  createTime: null
  exp: number
  level: number
  lose: number
  movesArray: null
  rank: number
  rankHistory: number
  record: null
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
  user: User
  win: number
}

export interface User {
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
