export interface HistroyRecord {
  code: number
  data: Datum[]
  msg: null
  url: null
  [property: string]: any
}

export interface Datum {
  bv: number
  bvs: number
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
  row: number
  solvedBv: number
  tap: number
  themeId: number
  time: number
  type: number
  uid: null
  upload: boolean
  [property: string]: any
}
