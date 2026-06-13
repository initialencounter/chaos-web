/**
 * 比赛排行榜前端类型
 */

export interface CompetitionLeaderboardEntry {
  rank: number
  uid: string
  nickName: string
  avatar: string
  recordId: number
  /** 完成时间（秒） */
  time: number
  bv: number
  bvs: number
  tap: number
  effectiveTap: number
  /** IOE = bv / tap */
  ioe: number
  /** 最终得分 = ioe - time * 0.005 */
  score: number
  /** 录像创建时间戳 */
  createTime: number
  /** 是否已上传录像 */
  upload: boolean
  /** 评论 ID */
  commentId: number
  /** 评论原文内容 */
  commentText: string
  /** 是否为回复（楼中楼） */
  isReply: boolean
  finished: boolean
}

export interface CompetitionLeaderboardResponse {
  code: number
  data: {
    entries: CompetitionLeaderboardEntry[]
    lastUpdated: number
    competitionTitle: string
    competitionTimeWindow: string
    competitionDescription: string
    totalSubmissions: number
    totalValidEntries: number
    totalFinalEntries: number
  }
  msg: string | null
}
