export interface NonoHistroyRecord {
  code: number
  data: Datum[]
  msg: null
  url: null
}

export interface Datum {
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
  row: number
  themeId: number
  time: number
  type: number
  uid: string
  upload: boolean
}
