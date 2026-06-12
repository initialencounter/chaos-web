import type { CompetitionLeaderboardEntry, RecordGetData } from '@tapsss/shared'

/**
 * 比赛配置 —— 描述一场比赛的所有规则参数
 */
export interface CompetitionConfig {
  /** 比赛帖子 ID */
  postId: number
  /** 比赛开始时间 (UTC epoch ms) */
  startTime: number
  /** 比赛结束时间 (UTC epoch ms) */
  endTime: number
  /** 录像类型前缀，如 'ms' = 扫雷 */
  replayPrefix: string
  /** 要求棋盘面积 (高级=30x16=480)，-1 不检查。支持横屏竖屏 */
  requiredArea: number
  /** 要求雷数 (高级=99)，-1 不检查 */
  requiredMine: number
  /** 要求游戏类型 (经典=2)，-1 不检查 */
  requiredType: number
  /** 评分公式标识 */
  scoreFormula: 'ioe_minus_time_penalty'
  /** 时间惩罚系数 */
  timePenaltyCoefficient: number
  /** 黑名单 UID，不上榜 */
  blacklist: string[]
  /** 轮询间隔 (毫秒) */
  pollIntervalMs: number
  /** 评论分页大小 */
  commentsPerPage: number
  /** 回复分页大小 */
  repliesPerPage: number
}

/**
 * 一条通过验证的比赛记录
 */
export interface CompetitionEntry {
  /** 录像 ID */
  recordId: number
  /** 评论者 UID */
  uid: string
  /** 评论 ID */
  commentId: number
  /** 是否为回复（楼中楼） */
  isReply: boolean
  /** 父评论 ID（只有 isReply 时有效） */
  parentCommentId: number | null
  /** 录像原始数据（精简版，仅保留必要字段） */
  recordData: Pick<RecordGetData, 'id' | 'uid' | 'time' | 'bv' | 'bvs' | 'tap' | 'effectiveTap' | 'row' | 'column' | 'mine' | 'type' | 'mode' | 'finished' | 'upload' | 'createTime'>
  /** 录像对应的用户显示名 */
  nickName: string
  /** 录像对应的用户头像 */
  avatar: string
  /** 计算得出的 IOE */
  ioe: number
  /** 最终得分 */
  score: number
  /** 是否已上传录像 (最终成绩) */
  isFinal: boolean
  /** 评论原文 */
  commentText: string
  /** 首次发现时间戳 */
  firstSeen: number
  /** 最后发现时间戳 */
  lastSeen: number
}

/**
 * 引擎内部状态
 */
export interface CompetitionState {
  config: CompetitionConfig
  entries: Record<string, CompetitionEntry>
  lastPollTime: number | null
  statistics: {
    totalSubmissions: number
    totalValid: number
    totalFinal: number
  }
}

/**
 * 引擎依赖
 */
export interface EngineDeps {
  /** API 请求函数 */
  executeRequest: <T>(path: string, method: string, params: Record<string, any>) => Promise<T>
  /** 比赛状态缓存目录 */
  cacheDir: string
  /** proxy-server 录像磁盘缓存目录 */
  recordCacheDir: string
  /** 日志输出 */
  logger: Pick<Console, 'log' | 'warn' | 'error'>
}

/**
 * 引擎公开接口
 */
export interface CompetitionEngine {
  poll: () => Promise<void>
  getLeaderboard: () => CompetitionLeaderboardEntry[]
  getLastPollTime: () => number | null
  getStatistics: () => CompetitionState['statistics']
  loadFromDisk: () => void
  saveToDisk: () => void
  startAutoPoll: () => void
  stopAutoPoll: () => void
}
