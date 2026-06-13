import type { TcupConfig } from './types'

/**
 * 超越杯比赛配置
 * 时间: 2026-06-14 08:00 ~ 2026-06-18 22:00 (Asia/Shanghai UTC+8)
 */
export const TCUP_CONFIG: TcupConfig = {
  postId: 1943446,
  startTime: new Date('2026-06-10T08:00:00+08:00').getTime(),
  endTime: new Date('2026-06-18T22:00:00+08:00').getTime(),
  replayPrefix: 'ms',
  requiredType: 2, // 经典
  pollIntervalMs: 15 * 60 * 1000,
  commentsPerPage: 20,
  repliesPerPage: 20,
  blacklist: [],
  difficulties: [
    { key: 'primary', name: '初级', area: 64, mine: 10, timeMaxPoints: 20, bvsMaxPoints: 10, minBvMaxPoints: 2, maxBvMaxPoints: 2 },
    { key: 'intermediate', name: '中级', area: 256, mine: 40, timeMaxPoints: 30, bvsMaxPoints: 15, minBvMaxPoints: 4, maxBvMaxPoints: 4 },
    { key: 'advanced', name: '高级', area: 480, mine: 99, timeMaxPoints: 40, bvsMaxPoints: 20, minBvMaxPoints: 6, maxBvMaxPoints: 6 },
  ],
  totalTimeMaxPoints: 20,
  totalBvsMaxPoints: 10,
}
