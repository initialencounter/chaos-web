export interface PuzzleHistroyRecord {
  code: number
  data: Datum[]
  msg: null
  url: null
}

export interface Datum {
  action: null
  blind: boolean
  column: number
  createTime: number
  id: number
  map: null
  observeTime: number
  playCount: number
  postId: number
  row: number
  step: number
  swipe: boolean
  time: number
  uid: string
}
