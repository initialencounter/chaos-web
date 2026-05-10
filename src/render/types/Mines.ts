// ========== 格子 ==========
export interface Cell {
  Id: number
  Mines: number // 0-8 数字, 9 = 雷(服务器用9表示雷)
  IsMine: boolean // 本地计算: val === '9' → true
  IsOpen: boolean // mapStatus === '1' → 已打开
  IsFlagged: boolean // mapStatus === '8' → 已标记
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
  id: number // 101=探测仪, 102=雷之奥义, 1001=双倍, 1002=护盾
  name: string // chaos_detector / chaos_xjbd / chaos_double_score / chaos_shield
  icon: string // 图标 URL
  num: number // 持有数量
  active: boolean // true=主动道具(需手动使用), false=自动使用
  duration: number // 持续时间 ms (探测仪 8000, 雷之奥义 1500, 双倍 10000, 护盾 6000)
  type: number // 道具类型
  consumeCount: number // 消耗计数
}

// ========== 激活道具状态(前端跟踪) ==========
export interface ActivePropEffect {
  propId: number
  propName: string
  remainingMs: number // 剩余时间 ms
  startTime: number // 激活时的时间戳
  // 探测仪专用
  centerCol?: number
  centerRow?: number
}

// ========== 玩家信息(服务器推送) ==========
export interface ChaosUser {
  countCorrect: number // 正确操作次数
  countError: number // 错误次数(可能与 countIncorrect 重复)
  countIncorrect: number // 错误操作次数
  join: boolean // 是否已加入
  joinTime: number // 加入时间戳
  lastOpen: boolean // 是否最后一击
  score: number // 当前分数
  usePropCount: number // 道具使用次数
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

// ========== 地图数据(来自 chaos/enter) ==========
export interface Minefield {
  Width: number
  Height: number
  Cells: number
  Mines: number
  Cell: Cell[]
  First: boolean
  StartTimeStamp: number
  // 特殊区域
  highScoreZone: ZoneRect | null
  noFlagZone: ZoneRect | null // 红区 - 只能打开不能标记
  maxTime: number // 最大时长 ms (3600000 = 60min)
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
