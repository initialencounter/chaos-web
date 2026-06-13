import type { TcupLeaderboard } from '@tapsss/shared'
import type { DifficultyRequirement } from '../shared'
import type { CompetitionEntry, EngineDeps } from '../types'
import type { TcupConfig, TcupState, TranscendenceCupEngine } from './types'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildKey,

  extractReplayIds,
  fetchAllComments,
  fetchAllReplies,
  round3,
  validateRecord,
} from '../shared'
import { buildLeaderboards, computePlayerBests } from './scoring'

/**
 * 创建超越杯比赛引擎
 */
export function createTranscendenceCupEngine(
  config: TcupConfig,
  deps: EngineDeps,
): TranscendenceCupEngine {
  const { executeRequest, cacheDir, recordCacheDir, logger } = deps
  const stateFilePath = path.join(cacheDir, 'tcup-state.json')

  let state: TcupState = {
    config,
    entries: {},
    lastPollTime: null,
    statistics: { totalSubmissions: 0, totalValid: 0, totalFinal: 0 },
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function recalcStatistics(): void {
    const entries = Object.values(state.entries)
    state.statistics.totalValid = entries.length
    state.statistics.totalFinal = entries.filter(e => e.isFinal).length
  }

  function saveToDisk(): void {
    try {
      fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2))
      logger.log('[TranscendenceCup] 状态已保存到磁盘')
    }
    catch (err) {
      logger.error('[TranscendenceCup] 保存状态失败:', err)
    }
  }

  function loadFromDisk(): void {
    try {
      if (fs.existsSync(stateFilePath)) {
        const raw = fs.readFileSync(stateFilePath, 'utf-8')
        const loaded = JSON.parse(raw) as TcupState
        state = { ...loaded, config }
        // 恢复时补充缺失的 difficulty 字段
        for (const entry of Object.values(state.entries)) {
          if (!entry.difficulty) {
            const area = entry.recordData.row * entry.recordData.column
            const { mine } = entry.recordData
            for (const diff of config.difficulties) {
              if (diff.area === area && diff.mine === mine) {
                entry.difficulty = diff.key
                break
              }
            }
          }
        }
        recalcStatistics()
        logger.log(`[TranscendenceCup] 从磁盘加载了 ${Object.keys(state.entries).length} 条记录`)
      }
    }
    catch (err) {
      logger.error('[TranscendenceCup] 加载磁盘状态失败:', err)
    }
  }

  async function poll(): Promise<void> {
    const now = Date.now()
    logger.log(`[TranscendenceCup] ===== 开始轮询 ${new Date(now).toISOString()} =====`)

    try {
      // 1. 获取全部评论
      const comments = await fetchAllComments(config, executeRequest, logger)

      // 2. 收集所有候选录像
      interface Candidate {
        uid: string
        nickName: string
        avatar: string
        commentId: number
        isReply: boolean
        parentCommentId: number | null
        recordId: number
        commentText: string
      }
      const candidates: Candidate[] = []

      for (const comment of comments) {
        const mainIds = extractReplayIds(comment.comment, config.replayPrefix)
        for (const recordId of mainIds) {
          candidates.push({
            uid: comment.uid,
            nickName: comment.user?.nickName || '',
            avatar: comment.user?.avatar || '',
            commentId: comment.id,
            isReply: false,
            parentCommentId: null,
            recordId,
            commentText: comment.comment,
          })
        }

        // 3. 获取回复
        if (comment.replyCount > 0) {
          const replies = await fetchAllReplies(comment.id, config, executeRequest, logger)
          for (const reply of replies) {
            if (!reply.comment)
              continue
            const replyIds = extractReplayIds(reply.comment, config.replayPrefix)
            for (const recordId of replyIds) {
              candidates.push({
                uid: reply.uid || '',
                nickName: reply.user?.nickName || '',
                avatar: reply.user?.avatar || '',
                commentId: reply.id || 0,
                isReply: true,
                parentCommentId: reply.parentId || comment.id,
                recordId,
                commentText: reply.comment,
              })
            }
          }
        }
      }

      logger.log(`[TranscendenceCup] 共发现 ${candidates.length} 个录像候选`)

      // 4. 构建难度需求 → 验证每条候选记录
      const requirements: DifficultyRequirement[] = config.difficulties.map(d => ({
        key: d.key,
        area: d.area,
        mine: d.mine,
      }))

      const newEntries: Record<string, CompetitionEntry> = {}
      const totalSubmissions = candidates.length

      for (const candidate of candidates) {
        if (config.blacklist.includes(candidate.uid))
          continue
        const key = buildKey(candidate.uid, candidate.recordId)
        const validated = await validateRecord(
          candidate.recordId,
          candidate.uid,
          { start: config.startTime, end: config.endTime },
          config.requiredType,
          requirements,
          executeRequest,
          logger,
          recordCacheDir,
        )
        if (!validated)
          continue

        // 计算 IOE (仅用于展示)
        const ioe = validated.recordData.tap > 0
          ? round3(validated.recordData.bv / validated.recordData.tap)
          : 0

        const existing = state.entries[key]
        const firstSeen = existing ? existing.firstSeen : now
        const lastSeen = now

        newEntries[key] = {
          recordId: candidate.recordId,
          uid: candidate.uid,
          commentId: candidate.commentId,
          isReply: candidate.isReply,
          parentCommentId: candidate.parentCommentId,
          recordData: validated.recordData,
          nickName: candidate.nickName,
          avatar: candidate.avatar,
          ioe,
          score: 0, // 超越杯不用单一分数，保留为 0
          isFinal: validated.recordData.upload === true,
          difficulty: validated.matchedRequirement || undefined,
          commentText: candidate.commentText,
          firstSeen,
          lastSeen,
        }
      }

      // 5. 检测变化
      const oldKeys = Object.keys(state.entries)
      const newKeys = Object.keys(newEntries)
      const removedKeys = oldKeys.filter(k => !newKeys.includes(k))

      for (const key of removedKeys) {
        const entry = state.entries[key]!
        logger.log(`[TranscendenceCup] 移除: uid=${entry.uid} recordId=${entry.recordId} nickName=${entry.nickName} (评论已不存在)`)
      }

      const addedKeys = newKeys.filter(k => !oldKeys.includes(k))
      for (const key of addedKeys) {
        const entry = newEntries[key]!
        logger.log(`[TranscendenceCup] 新增: uid=${entry.uid} recordId=${entry.recordId} nickName=${entry.nickName} difficulty=${entry.difficulty}`)
      }

      // 6. 更新状态
      state.entries = newEntries
      state.lastPollTime = now
      state.statistics.totalSubmissions = totalSubmissions
      recalcStatistics()

      logger.log(`[TranscendenceCup] 轮询完成: 总候选=${totalSubmissions} 有效=${state.statistics.totalValid} 最终成绩=${state.statistics.totalFinal} 新增=${addedKeys.length} 移除=${removedKeys.length}`)

      // 7. 持久化
      saveToDisk()
    }
    catch (err) {
      logger.error('[TranscendenceCup] 轮询异常:', err)
    }
  }

  function getLeaderboards(): { leaderboards: TcupLeaderboard[], competitionTitle: string, competitionTimeWindow: string, totalSubmissions: number, totalValidEntries: number, totalFinalEntries: number } {
    const entries = Object.values(state.entries)
    const players = computePlayerBests(entries, state.config)
    const leaderboards = buildLeaderboards(players, state.config)

    // 格式化时间窗口用于展示
    const fmtTime = (ts: number): string => {
      const d = new Date(ts)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    return {
      leaderboards,
      competitionTitle: config.name,
      competitionTimeWindow: `${fmtTime(config.startTime)} ~ ${fmtTime(config.endTime)}`,
      totalSubmissions: state.statistics.totalSubmissions,
      totalValidEntries: state.statistics.totalValid,
      totalFinalEntries: state.statistics.totalFinal,
    }
  }

  function getLastPollTime(): number | null {
    return state.lastPollTime
  }

  function getStatistics(): TcupState['statistics'] {
    return { ...state.statistics }
  }

  function startAutoPoll(): void {
    if (pollTimer)
      return
    pollTimer = setInterval(() => {
      poll().catch(err => logger.error('[TranscendenceCup] 定时轮询出错:', err))
    }, config.pollIntervalMs)
    logger.log(`[TranscendenceCup] 自动轮询已启动，间隔 ${config.pollIntervalMs / 1000}s`)
  }

  function stopAutoPoll(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
      logger.log('[TranscendenceCup] 自动轮询已停止')
    }
  }

  return {
    poll,
    getLeaderboards,
    getLastPollTime,
    getStatistics,
    loadFromDisk,
    saveToDisk,
    startAutoPoll,
    stopAutoPoll,
  }
}
