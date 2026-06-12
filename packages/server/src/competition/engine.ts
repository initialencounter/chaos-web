import type { CommentDatum, CompetitionLeaderboardEntry, PostCommentListResponse, PostListReplyResponse, RecordGetResponse, ReplyListDatum } from '@tapsss/shared'
import type { CompetitionConfig, CompetitionEngine, CompetitionEntry, CompetitionState, EngineDeps } from './types'
import fs from 'node:fs'
import path from 'node:path'

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function buildKey(uid: string, recordId: number): string {
  return `${uid}-${recordId}`
}

/**
 * 从文本中提取指定前缀的录像 ID
 * 匹配格式: $ms123456 (前缀为 config.replayPrefix)
 */
function extractReplayIds(text: string, prefix: string): number[] {
  const regex = new RegExp(`\\$${prefix}(\\d+)`, 'g')
  const ids: number[] = []
  let match = regex.exec(text)
  while (match !== null) {
    ids.push(Number(match[1]!))
    match = regex.exec(text)
  }
  return ids
}

/**
 * 分页获取帖子全部评论
 */
async function fetchAllComments(
  config: CompetitionConfig,
  executeRequest: EngineDeps['executeRequest'],
  logger: EngineDeps['logger'],
): Promise<CommentDatum[]> {
  const allComments: CommentDatum[] = []
  let page = 0
  while (true) {
    const res: PostCommentListResponse = await executeRequest(
      '/Minesweeper/post/comment/list',
      'POST',
      { postId: config.postId, sort: 0, page, count: config.commentsPerPage },
    )
    if (!res || res.code !== 200 || !Array.isArray(res.data)) {
      logger.warn(`[Competition] 获取评论列表失败 page=${page}:`, res)
      break
    }
    if (res.data.length === 0)
      break
    allComments.push(...res.data)
    if (res.data.length < config.commentsPerPage)
      break
    page++
  }
  logger.log(`[Competition] 共获取 ${allComments.length} 条评论`)
  return allComments
}

/**
 * 分页获取某条评论的全部回复
 */
async function fetchAllReplies(
  commentId: number,
  config: CompetitionConfig,
  executeRequest: EngineDeps['executeRequest'],
  logger: EngineDeps['logger'],
): Promise<ReplyListDatum[]> {
  const allReplies: ReplyListDatum[] = []
  let page = 0
  while (true) {
    const res: PostListReplyResponse = await executeRequest(
      '/Minesweeper/post/comment/list/reply',
      'POST',
      { commentId, page, count: config.repliesPerPage },
    )
    if (!res || res.code !== 200 || !Array.isArray(res.data)) {
      logger.warn(`[Competition] 获取回复列表失败 commentId=${commentId} page=${page}:`, res)
      break
    }
    if (res.data.length === 0)
      break
    allReplies.push(...res.data)
    if (res.data.length < config.repliesPerPage)
      break
    page++
  }
  return allReplies
}

/**
 * 验证并获取一条录像记录
 * 如果验证失败返回 null
 * recordCache: 录像数据内存缓存，key=recordId，避免重复请求上游 API
 */
async function validateRecord(
  recordId: number,
  expectedUid: string,
  config: CompetitionConfig,
  executeRequest: EngineDeps['executeRequest'],
  logger: EngineDeps['logger'],
  recordCacheDir: string,
): Promise<{ recordData: CompetitionEntry['recordData'] } | null> {
  try {
    let record: RecordGetResponse['data'] | undefined

    // 检查 proxy-server 的录像磁盘缓存
    const diskCacheFile = path.join(recordCacheDir, `minesweeper-${recordId}.json`)
    if (fs.existsSync(diskCacheFile)) {
      try {
        const cached: RecordGetResponse = JSON.parse(fs.readFileSync(diskCacheFile, 'utf-8'))
        if (cached.code === 200 && cached.data) {
          record = cached.data
        }
      }
      catch {
        logger.warn(`[Competition] 磁盘缓存解析失败 recordId=${recordId}`)
      }
    }

    // 未命中则请求上游 API
    if (!record) {
      const res: RecordGetResponse = await executeRequest(
        '/Minesweeper/minesweeper/record/get',
        'POST',
        { recordId },
      )
      if (!res || res.code !== 200 || !res.data) {
        logger.warn(`[Competition] 获取录像失败 recordId=${recordId}:`, res)
        return null
      }
      record = res.data
      // 回写到 proxy-server 磁盘缓存
      try {
        fs.writeFileSync(diskCacheFile, JSON.stringify(res))
        logger.log(`[Competition] 写入磁盘缓存 recordId=${recordId}`)
      }
      catch {
        // 写入失败不影响主流程
      }
    }

    // 1. 录像所有者必须匹配评论者
    if (String(record.uid) !== String(expectedUid)) {
      logger.warn(`[Competition] 录像所有者不匹配 recordId=${recordId} record.uid=${record.uid} comment.uid=${expectedUid}`)
      return null
    }

    // 2. 录像创建时间必须在比赛窗口内
    if (record.createTime < config.startTime || record.createTime > config.endTime) {
      logger.warn(`[Competition] 录像时间不在比赛窗口内 recordId=${recordId} createTime=${record.createTime}`)
      return null
    }

    // 3. 检查棋盘规格: 用面积+雷数判定，兼容横屏(30×16)和竖屏(16×30)
    if (config.requiredArea !== -1 && record.row * record.column !== config.requiredArea) {
      logger.warn(`[Competition] 棋盘面积不匹配 recordId=${recordId} area=${record.row * record.column} required=${config.requiredArea}`)
      return null
    }
    if (config.requiredMine !== -1 && record.mine !== config.requiredMine) {
      logger.warn(`[Competition] 雷数不匹配 recordId=${recordId} mine=${record.mine} required=${config.requiredMine}`)
      return null
    }

    // 4. 必须是经典模式
    if (config.requiredType !== -1 && record.type !== config.requiredType) {
      logger.warn(`[Competition] 游戏类型不匹配 recordId=${recordId} type=${record.type} required=${config.requiredType}`)
      return null
    }

    // 5. 必须是已完成的录像
    if (!record.finished) {
      logger.warn(`[Competition] 录像未完成 recordId=${recordId}`)
      return null
    }

    // 提取需要缓存的字段（只保留必要数据，避免存储过大）
    const recordData: CompetitionEntry['recordData'] = {
      id: record.id,
      uid: record.uid,
      time: record.time,
      bv: record.bv,
      bvs: record.bvs,
      tap: record.tap,
      effectiveTap: record.effectiveTap,
      row: record.row,
      column: record.column,
      mine: record.mine,
      type: record.type,
      mode: record.mode,
      finished: record.finished,
      upload: record.upload,
      createTime: record.createTime,
    }

    return { recordData }
  }
  catch (err) {
    logger.error(`[Competition] 验证录像异常 recordId=${recordId}:`, err)
    return null
  }
}

/**
 * 计算得分
 * 公式: IOE = bv / tap, score = IOE - time_s * timePenaltyCoefficient
 * 注意: recordData.time 单位是 ms，需转换为秒
 */
function computeScore(recordData: CompetitionEntry['recordData'], config: CompetitionConfig): { ioe: number, score: number, isFinal: boolean } {
  const ioe = recordData.tap > 0
    ? round3(recordData.bv / recordData.tap)
    : 0
  const timeInSeconds = recordData.time / 1000
  const score = round3(ioe - timeInSeconds * config.timePenaltyCoefficient)
  const isFinal = recordData.upload === true
  return { ioe, score, isFinal }
}

/**
 * 创建比赛引擎
 */
export function createCompetitionEngine(
  config: CompetitionConfig,
  deps: EngineDeps,
): CompetitionEngine {
  const { executeRequest, cacheDir, recordCacheDir, logger } = deps
  const stateFilePath = path.join(cacheDir, 'competition-state.json')

  let state: CompetitionState = {
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
      logger.log('[Competition] 状态已保存到磁盘')
    }
    catch (err) {
      logger.error('[Competition] 保存状态失败:', err)
    }
  }

  function loadFromDisk(): void {
    try {
      if (fs.existsSync(stateFilePath)) {
        const raw = fs.readFileSync(stateFilePath, 'utf-8')
        const loaded = JSON.parse(raw) as CompetitionState
        // 合并 config（配置可能已更新）
        state = { ...loaded, config }
        recalcStatistics()
        logger.log(`[Competition] 从磁盘加载了 ${Object.keys(state.entries).length} 条记录`)
      }
    }
    catch (err) {
      logger.error('[Competition] 加载磁盘状态失败:', err)
    }
  }

  async function poll(): Promise<void> {
    const now = Date.now()
    logger.log(`[Competition] ===== 开始轮询 ${new Date(now).toISOString()} =====`)

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
        // 从主评论中提取录像ID
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

        // 3. 获取该评论的全部回复
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

      logger.log(`[Competition] 共发现 ${candidates.length} 个录像候选`)

      // 4. 验证每条候选记录
      const newEntries: Record<string, CompetitionEntry> = {}
      const totalSubmissions = candidates.length

      for (const candidate of candidates) {
        // 跳过黑名单
        if (config.blacklist.includes(candidate.uid))
          continue
        const key = buildKey(candidate.uid, candidate.recordId)
        const validated = await validateRecord(candidate.recordId, candidate.uid, config, executeRequest, logger, recordCacheDir)
        if (!validated)
          continue

        const { ioe, score, isFinal } = computeScore(validated.recordData, config)

        // 检查是否已存在（保留 firstSeen）
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
          score,
          isFinal,
          commentText: candidate.commentText,
          firstSeen,
          lastSeen,
        }
      }

      // 5. 检测移除的条目（评论被删除 = 退出比赛）
      const oldKeys = Object.keys(state.entries)
      const newKeys = Object.keys(newEntries)
      const removedKeys = oldKeys.filter(k => !newKeys.includes(k))

      for (const key of removedKeys) {
        const entry = state.entries[key]!
        logger.log(`[Competition] 移除: uid=${entry.uid} recordId=${entry.recordId} nickName=${entry.nickName} (评论已不存在)`)
      }

      // 6. 检测新增的条目
      const addedKeys = newKeys.filter(k => !oldKeys.includes(k))
      for (const key of addedKeys) {
        const entry = newEntries[key]!
        logger.log(`[Competition] 新增: uid=${entry.uid} recordId=${entry.recordId} nickName=${entry.nickName} score=${entry.score} isFinal=${entry.isFinal}`)
      }

      // 7. 更新状态
      state.entries = newEntries
      state.lastPollTime = now
      state.statistics.totalSubmissions = totalSubmissions
      recalcStatistics()

      logger.log(`[Competition] 轮询完成: 总候选=${totalSubmissions} 有效=${state.statistics.totalValid} 最终成绩=${state.statistics.totalFinal} 新增=${addedKeys.length} 移除=${removedKeys.length}`)

      // 8. 持久化
      saveToDisk()
    }
    catch (err) {
      logger.error('[Competition] 轮询异常:', err)
    }
  }

  function getLeaderboard(): CompetitionLeaderboardEntry[] {
    const entries = Object.values(state.entries)
    // 按 score 降序，同分按 time 升序
    entries.sort((a, b) => {
      if (b.score !== a.score)
        return b.score - a.score
      return a.recordData.time - b.recordData.time
    })

    // 过滤黑名单 + 每个玩家只保留最佳成绩
    const blacklistSet = new Set(state.config.blacklist)
    const seenUids = new Set<string>()
    const bestEntries = entries.filter((e) => {
      if (blacklistSet.has(e.uid))
        return false
      if (seenUids.has(e.uid))
        return false
      seenUids.add(e.uid)
      return true
    })

    return bestEntries.map((entry, index) => ({
      rank: index + 1,
      uid: entry.uid,
      nickName: entry.nickName,
      avatar: entry.avatar,
      recordId: entry.recordId,
      // 转换为秒，保留3位小数
      time: round3(entry.recordData.time / 1000),
      bv: entry.recordData.bv,
      bvs: entry.recordData.bvs,
      tap: entry.recordData.tap,
      effectiveTap: entry.recordData.effectiveTap,
      ioe: entry.ioe,
      score: entry.score,
      createTime: entry.recordData.createTime,
      upload: entry.isFinal,
      commentId: entry.commentId,
      commentText: entry.commentText,
      isReply: entry.isReply,
      finished: entry.recordData.finished,
    }))
  }

  function getLastPollTime(): number | null {
    return state.lastPollTime
  }

  function getStatistics(): CompetitionState['statistics'] {
    return { ...state.statistics }
  }

  function startAutoPoll(): void {
    if (pollTimer)
      return
    pollTimer = setInterval(() => {
      poll().catch(err => logger.error('[Competition] 定时轮询出错:', err))
    }, config.pollIntervalMs)
    logger.log(`[Competition] 自动轮询已启动，间隔 ${config.pollIntervalMs / 1000}s`)
  }

  function stopAutoPoll(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
      logger.log('[Competition] 自动轮询已停止')
    }
  }

  return {
    poll,
    getLeaderboard,
    getLastPollTime,
    getStatistics,
    loadFromDisk,
    saveToDisk,
    startAutoPoll,
    stopAutoPoll,
  }
}
