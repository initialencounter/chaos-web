export interface MinesweeperChaosListUserRecord {
  code: number
  data: Datum[]
  msg: null
  url: null
}

export interface Datum {
  correct: number
  createTime: number
  id: number
  incorrect: number
  rank: number
  recordId: number
  score: number
  uid: string
}
