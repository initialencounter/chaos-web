/**
 * 超越杯前端类型
 */

/** 单个排行榜中的一条记录 */
export interface TcupLeaderboardEntry {
  rank: number
  uid: string
  nickName: string
  avatar: string
  /** 该榜主要指标值 (积分/秒/bvs/bv) */
  value: number
  /** 该类别获得的积分 (总积分榜为 0) */
  points: number
  /** 总榜的难度明细文本，如 "初:12s / 中:45s / 高:98s" */
  detail?: string
  /** 来源录像 ID (总榜为 null) */
  recordId: number | null
  /** 完成时间 (秒) */
  time: number | null
  /** 3BV */
  bv: number | null
  /** 3BV/s */
  bvs: number | null
  /** 点击数 */
  tap: number | null
  /** 来源评论 ID */
  commentId: number | null
  /** 评论原文 */
  commentText: string | null
  /** 是否已上传录像 */
  upload: boolean | null
}

/** 一个排行榜 */
export interface TcupLeaderboard {
  /** 标识: 'totalPoints' | 'totalTime' | 'primary-time' | ... */
  id: string
  /** 显示标题: '总积分' | '初级 · 时间成绩' | ... */
  title: string
  entries: TcupLeaderboardEntry[]
}

/** API 响应 */
export interface TcupLeaderboardResponse {
  code: number
  data: {
    leaderboards: TcupLeaderboard[]
    lastUpdated: number
    competitionTitle: string
    competitionTimeWindow: string
    totalSubmissions: number
    totalValidEntries: number
    totalFinalEntries: number
  }
  msg: string | null
}
