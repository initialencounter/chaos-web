// ========== 游戏核心类型 (来自 Electron 扫雷游戏) ==========

// ========== 格子 ==========
export interface Cell {
  Id: number
  Mines: number // 0-8 数字, 9 = 雷(服务器用9表示雷)
  IsMine: boolean
  IsOpen: boolean
  IsFlagged: boolean
}

// ========== 特殊区域 ==========
export interface ZoneRect {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

// ========== 道具 ==========
export interface Prop {
  id: number
  name: string
  icon: string
  num: number
  active: boolean
  duration: number
  type: number
  consumeCount: number
}

// ========== 激活道具状态(前端跟踪) ==========
export interface ActivePropEffect {
  propId: number
  propName: string
  remainingMs: number
  startTime: number
  centerCol?: number
  centerRow?: number
}

// ========== 玩家信息(服务器推送) ==========
export interface ChaosUser {
  countCorrect: number
  countError: number
  countIncorrect: number
  join: boolean
  joinTime: number
  lastOpen: boolean
  score: number
  usePropCount: number
  user: {
    id: number
    uid: string
    nickName: string
    avatar: string
    mail?: string
    mark?: string
    vip?: boolean
    province?: string
    country?: string
    [key: string]: any
  }
}

// ========== 地图数据 ==========
export interface Minefield {
  Width: number
  Height: number
  Cells: number
  Mines: number
  Cell: Cell[]
  First: boolean
  StartTimeStamp: number
  highScoreZone: ZoneRect | null
  noFlagZone: ZoneRect | null
  maxTime: number
}

// ========== 记分板 ==========
export interface ScoreEntry {
  uid: string
  name: string
  avatar: string
  score: number
  correct: number
  incorrect: number
  usePropCount: number
  lastOpen: boolean
}

export interface ScoreBoard {
  [uid: string]: ScoreEntry
}

// ========== WebSocket 通信类型 ==========
export interface GameRequestType {
  Ids: number[]
  IsFlag: boolean
  TimeStamp: number
}

export interface GameResult {
  Cell: Cell[]
  Result: {
    IsWin: boolean
    IsBoom: boolean
    RemainCells: boolean
    Message: string
    TimeStamp: number
  }
}

export interface GameScoreBoard {
  [key: string]: number
}

export interface GameResponse {
  PlayerQuit: boolean
  NewPlayer: boolean
  UserName: string
  ChangeCell: GameResult
  TimeStamp: number
  StartTimeStamp: number
  EarnScore: number
  ScoreBoard: GameScoreBoard
}
