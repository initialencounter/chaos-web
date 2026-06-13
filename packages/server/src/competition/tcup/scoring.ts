import type { TcupLeaderboard, TcupLeaderboardEntry } from '@tapsss/shared'
import type { CompetitionEntry } from '../types'
import type { DifficultyPlayerBest, MetricBest, PlayerAggregate, TcupConfig, TcupDifficultyConfig } from './types'
import { round3 } from '../shared'

// ─── 辅助: 根据录像规格匹配难度 ───

function matchDifficulty(entry: CompetitionEntry, config: TcupConfig): TcupDifficultyConfig | null {
  const area = entry.recordData.row * entry.recordData.column
  const { mine } = entry.recordData
  for (const diff of config.difficulties) {
    if (diff.area === area && diff.mine === mine) {
      return diff
    }
  }
  return null
}

// ─── 辅助: 时间毫秒 → 秒 ───

function msToSec(ms: number): number {
  return round3(ms / 1000)
}

// ─── Step 1: 计算每个玩家在每个难度的最佳值 ───

export function computePlayerBests(
  entries: CompetitionEntry[],
  config: TcupConfig,
): PlayerAggregate[] {
  // uid → PlayerAggregate
  const playerMap = new Map<string, PlayerAggregate>()

  function getOrCreate(uid: string, nickName: string, avatar: string): PlayerAggregate {
    let p = playerMap.get(uid)
    if (!p) {
      const difficultyBests: Record<string, DifficultyPlayerBest> = {}
      for (const diff of config.difficulties) {
        difficultyBests[diff.key] = { bestTime: null, bestBvs: null, minBv: null, maxBv: null }
      }
      p = {
        uid,
        nickName,
        avatar,
        difficultyBests,
        totalTime: Infinity,
        totalBvs: -Infinity,
        totalPoints: 0,
        categoryPoints: {},
      }
      playerMap.set(uid, p)
    }
    return p
  }

  // 比较时间: 越低越好
  function isBetterTime(newMs: number, current: MetricBest | null): boolean {
    if (!current)
      return true
    return newMs < current.entry.recordData.time
  }

  // 比较 3BV/s: 越高越好, 同分取时间短者
  function isBetterBvs(newBvs: number, newTimeMs: number, current: MetricBest | null): boolean {
    if (!current)
      return true
    const curBvs = current.entry.recordData.bvs
    if (newBvs !== curBvs)
      return newBvs > curBvs
    return newTimeMs < current.entry.recordData.time
  }

  // 比较 3BV: 越低越好 (minBv) / 越高越好 (maxBv), 同分取时间短者
  function isBetterMinBv(newBv: number, newTimeMs: number, current: MetricBest | null): boolean {
    if (!current)
      return true
    const curBv = current.entry.recordData.bv
    if (newBv !== curBv)
      return newBv < curBv
    return newTimeMs < current.entry.recordData.time
  }

  function isBetterMaxBv(newBv: number, newTimeMs: number, current: MetricBest | null): boolean {
    if (!current)
      return true
    const curBv = current.entry.recordData.bv
    if (newBv !== curBv)
      return newBv > curBv
    return newTimeMs < current.entry.recordData.time
  }

  for (const entry of entries) {
    const diff = matchDifficulty(entry, config)
    if (!diff)
      continue // 不属于任何难度

    const player = getOrCreate(entry.uid, entry.nickName, entry.avatar)
    const bests = player.difficultyBests[diff.key]!

    const timeMs = entry.recordData.time
    const bvs = entry.recordData.bvs
    const bv = entry.recordData.bv

    // bestTime
    if (isBetterTime(timeMs, bests.bestTime)) {
      bests.bestTime = { entry, value: msToSec(timeMs) }
    }
    // bestBvs
    if (isBetterBvs(bvs, timeMs, bests.bestBvs)) {
      bests.bestBvs = { entry, value: bvs }
    }
    // minBv
    if (isBetterMinBv(bv, timeMs, bests.minBv)) {
      bests.minBv = { entry, value: bv }
    }
    // maxBv
    if (isBetterMaxBv(bv, timeMs, bests.maxBv)) {
      bests.maxBv = { entry, value: bv }
    }
  }

  // 更新 nickName/avatar (取最新遇到的)
  for (const entry of entries) {
    const player = playerMap.get(entry.uid)
    if (player) {
      if (entry.nickName)
        player.nickName = entry.nickName
      if (entry.avatar)
        player.avatar = entry.avatar
    }
  }

  // 计算 totalTime 和 totalBvs（有任意难度即可，不要求全部完成）
  for (const player of playerMap.values()) {
    let totalTime = 0
    let totalBvs = 0
    let hasAny = false
    for (const diff of config.difficulties) {
      const bests = player.difficultyBests[diff.key]!
      if (bests.bestTime) {
        totalTime += bests.bestTime.value
        hasAny = true
      }
      if (bests.bestBvs) {
        totalBvs += bests.bestBvs.value
        hasAny = true
      }
    }
    player.totalTime = hasAny ? round3(totalTime) : Infinity
    player.totalBvs = hasAny ? round3(totalBvs) : -Infinity
  }

  return Array.from(playerMap.values())
}

// ─── Step 2: 排名 ───

interface RankEntry {
  uid: string
  value: number
  rank: number
}

/**
 * 对一组玩家按某指标排名
 * @param sortAscending true=越小越好(time/minBv), false=越大越好(bvs/maxBv/points)
 */
export function rankCategory(
  players: PlayerAggregate[],
  extractValue: (p: PlayerAggregate) => number | null,
  sortAscending: boolean,
): RankEntry[] {
  const withValues = players
    .map(p => ({ uid: p.uid, value: extractValue(p) }))
    .filter((e): e is { uid: string, value: number } => e.value !== null && Number.isFinite(e.value))

  withValues.sort((a, b) => sortAscending ? a.value - b.value : b.value - a.value)

  const result: RankEntry[] = []
  let rank = 1
  for (let i = 0; i < withValues.length; i++) {
    if (i > 0 && withValues[i]!.value !== withValues[i - 1]!.value) {
      rank = i + 1 // 跳过并列
    }
    result.push({ uid: withValues[i]!.uid, value: withValues[i]!.value, rank })
  }
  return result
}

// ─── Step 3: 积分分配 ───

/**
 * 按排名分配积分: 第1名 = maxPoints, 每降1名减1分, 到0为止
 * 返回 uid → points 映射
 */
export function awardPoints(rankings: RankEntry[], maxPoints: number): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rankings) {
    const points = Math.max(0, maxPoints - (r.rank - 1))
    map.set(r.uid, points)
  }
  return map
}

// ─── Step 4: 构建所有排行榜 ───

function metricToEntry(
  rank: number,
  metric: MetricBest,
  player: PlayerAggregate,
  points: number,
): TcupLeaderboardEntry {
  const e = metric.entry
  return {
    rank,
    uid: player.uid,
    nickName: player.nickName,
    avatar: player.avatar,
    value: metric.value,
    points,
    recordId: e.recordId,
    time: msToSec(e.recordData.time),
    bv: e.recordData.bv,
    bvs: e.recordData.bvs,
    tap: e.recordData.tap,
    commentId: e.commentId,
    commentText: e.commentText,
    upload: e.isFinal,
  }
}

/**
 * 构建所有 14 个排行榜，同时计算并填入各玩家的总积分
 */
export function buildLeaderboards(
  players: PlayerAggregate[],
  config: TcupConfig,
): TcupLeaderboard[] {
  const leaderboards: TcupLeaderboard[] = []

  // 重置积分
  for (const p of players) {
    p.totalPoints = 0
    p.categoryPoints = {}
  }

  // ── 12 个难度分类排行榜 ──
  for (const diff of config.difficulties) {
    // 时间榜 (升序: 越低越好)
    const timeRankings = rankCategory(
      players,
      p => p.difficultyBests[diff.key]?.bestTime?.value ?? null,
      true,
    )
    const timePoints = awardPoints(timeRankings, diff.timeMaxPoints)
    leaderboards.push({
      id: `${diff.key}-time`,
      title: `${diff.name} · 时间成绩`,
      entries: timeRankings.map((r) => {
        const p = players.find(pp => pp.uid === r.uid)!
        const pts = timePoints.get(r.uid) || 0
        p.totalPoints += pts
        p.categoryPoints[`${diff.key}-time`] = pts
        return metricToEntry(r.rank, p.difficultyBests[diff.key]!.bestTime!, p, pts)
      }),
    })

    // 3BV/s 榜 (降序: 越高越好)
    const bvsRankings = rankCategory(
      players,
      p => p.difficultyBests[diff.key]?.bestBvs?.value ?? null,
      false,
    )
    const bvsPoints = awardPoints(bvsRankings, diff.bvsMaxPoints)
    leaderboards.push({
      id: `${diff.key}-bvs`,
      title: `${diff.name} · 3BV/s 成绩`,
      entries: bvsRankings.map((r) => {
        const p = players.find(pp => pp.uid === r.uid)!
        const pts = bvsPoints.get(r.uid) || 0
        p.totalPoints += pts
        p.categoryPoints[`${diff.key}-bvs`] = pts
        return metricToEntry(r.rank, p.difficultyBests[diff.key]!.bestBvs!, p, pts)
      }),
    })

    // 最小3BV 榜 (升序: 越低越好)
    const minBvRankings = rankCategory(
      players,
      p => p.difficultyBests[diff.key]?.minBv?.value ?? null,
      true,
    )
    const minBvPoints = awardPoints(minBvRankings, diff.minBvMaxPoints)
    leaderboards.push({
      id: `${diff.key}-minBv`,
      title: `${diff.name} · 最小3BV`,
      entries: minBvRankings.map((r) => {
        const p = players.find(pp => pp.uid === r.uid)!
        const pts = minBvPoints.get(r.uid) || 0
        p.totalPoints += pts
        p.categoryPoints[`${diff.key}-minBv`] = pts
        return metricToEntry(r.rank, p.difficultyBests[diff.key]!.minBv!, p, pts)
      }),
    })

    // 最大3BV 榜 (降序: 越高越好)
    const maxBvRankings = rankCategory(
      players,
      p => p.difficultyBests[diff.key]?.maxBv?.value ?? null,
      false,
    )
    const maxBvPoints = awardPoints(maxBvRankings, diff.maxBvMaxPoints)
    leaderboards.push({
      id: `${diff.key}-maxBv`,
      title: `${diff.name} · 最大3BV`,
      entries: maxBvRankings.map((r) => {
        const p = players.find(pp => pp.uid === r.uid)!
        const pts = maxBvPoints.get(r.uid) || 0
        p.totalPoints += pts
        p.categoryPoints[`${diff.key}-maxBv`] = pts
        return metricToEntry(r.rank, p.difficultyBests[diff.key]!.maxBv!, p, pts)
      }),
    })
  }

  // ── 辅助: 构建总榜明细文本 ──
  function buildTotalDetail(p: PlayerAggregate, unit: 's' | ''): string {
    return config.difficulties
      .map(d => `${d.name}:${p.difficultyBests[d.key]?.bestTime?.value.toFixed(1) ?? '-'}${unit}`)
      .join(' / ')
  }
  function buildTotalBvsDetail(p: PlayerAggregate): string {
    return config.difficulties
      .map(d => `${d.name}:${p.difficultyBests[d.key]?.bestBvs?.value.toFixed(3) ?? '-'}`)
      .join(' / ')
  }

  // ── 总时间榜 ──
  const totalTimeRankings = rankCategory(
    players,
    p => p.totalTime !== Infinity ? p.totalTime : null,
    true,
  )
  const totalTimePoints = awardPoints(totalTimeRankings, config.totalTimeMaxPoints)
  leaderboards.push({
    id: 'totalTime',
    title: '总时间成绩',
    entries: totalTimeRankings.map((r) => {
      const p = players.find(pp => pp.uid === r.uid)!
      const pts = totalTimePoints.get(r.uid) || 0
      p.totalPoints += pts
      p.categoryPoints.totalTime = pts
      return {
        rank: r.rank,
        uid: p.uid,
        nickName: p.nickName,
        avatar: p.avatar,
        value: r.value,
        points: pts,
        detail: buildTotalDetail(p, 's'),
        recordId: null,
        time: null,
        bv: null,
        bvs: null,
        tap: null,
        commentId: null,
        commentText: null,
        upload: null,
      }
    }),
  })

  // ── 总3BV/s 榜 ──
  const totalBvsRankings = rankCategory(
    players,
    p => p.totalBvs !== -Infinity ? p.totalBvs : null,
    false,
  )
  const totalBvsPoints = awardPoints(totalBvsRankings, config.totalBvsMaxPoints)
  leaderboards.push({
    id: 'totalBvs',
    title: '总3BV/s 成绩',
    entries: totalBvsRankings.map((r) => {
      const p = players.find(pp => pp.uid === r.uid)!
      const pts = totalBvsPoints.get(r.uid) || 0
      p.totalPoints += pts
      p.categoryPoints.totalBvs = pts
      return {
        rank: r.rank,
        uid: p.uid,
        nickName: p.nickName,
        avatar: p.avatar,
        value: r.value,
        points: pts,
        detail: buildTotalBvsDetail(p),
        recordId: null,
        time: null,
        bv: null,
        bvs: null,
        tap: null,
        commentId: null,
        commentText: null,
        upload: null,
      }
    }),
  })

  // ── 总积分榜 (排在第一位) ──
  const totalPointsEntries: TcupLeaderboardEntry[] = players
    .filter(p => p.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((p, i) => ({
      rank: i + 1,
      uid: p.uid,
      nickName: p.nickName,
      avatar: p.avatar,
      value: p.totalPoints,
      points: 0, // 总积分榜本身无额外积分
      recordId: null,
      time: null,
      bv: null,
      bvs: null,
      tap: null,
      commentId: null,
      commentText: null,
      upload: null,
    }))

  // 处理总积分并列
  let rank = 1
  for (let i = 0; i < totalPointsEntries.length; i++) {
    if (i > 0 && totalPointsEntries[i]!.value !== totalPointsEntries[i - 1]!.value) {
      rank = i + 1
    }
    totalPointsEntries[i]!.rank = rank
  }

  leaderboards.unshift({
    id: 'totalPoints',
    title: '总积分',
    entries: totalPointsEntries,
  })

  return leaderboards
}
