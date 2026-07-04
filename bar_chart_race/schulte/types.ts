export interface SchulteHistroyRecord {
  code: number
  data: Datum[]
  msg: null
  url: null
}

export interface Datum {
  actions: null
  blind: boolean
  column: number
  createTime: number
  id: number
  map: null
  maps: null
  playCount: number
  postId: number
  reactionTime: number
  row: number
  tap: number
  tapCorrect: number
  time: number
  type: number
  uid: string
}
