import type { CompetitionConfig } from './types'

/**
 * 当前比赛配置 —— 全标速效
 * 时间: 2026-06-10 20:00 ~ 2026-06-18 00:00 (Asia/Shanghai UTC+8)
 */
export const CURRENT_COMPETITION_CONFIG: CompetitionConfig = {
  postId: 1943446,
  startTime: new Date('2026-06-10T20:00:00+08:00').getTime(),
  endTime: new Date('2026-06-18T00:00:00+08:00').getTime(),
  replayPrefix: 'ms',
  // 高级: 30x16 或 16x30 (横屏竖屏皆可), 面积480, 99雷
  // 改为用面积和雷数判断，兼容两种朝向
  requiredArea: 480,
  requiredMine: 99,
  // 经典
  requiredType: 2,
  scoreFormula: 'ioe_minus_time_penalty',
  timePenaltyCoefficient: 0.005,
  pollIntervalMs: 15 * 60 * 1000,
  commentsPerPage: 20,
  repliesPerPage: 20,
}
