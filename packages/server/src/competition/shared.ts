import type { CommentDatum, PostCommentListResponse, PostListReplyResponse, RecordGetResponse, ReplyListDatum } from '@tapsss/shared'
import type { CompetitionEntry } from './types'
import fs from 'node:fs'
import path from 'node:path'

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function buildKey(uid: string, recordId: number): string {
  return `${uid}-${recordId}`
}

/**
 * 从文本中提取指定前缀的录像 ID
 * 匹配格式: $ms123456 (前缀为 config.replayPrefix)
 */
export function extractReplayIds(text: string, prefix: string): number[] {
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
export async function fetchAllComments(
  config: { postId: number, commentsPerPage: number },
  executeRequest: <T>(path: string, method: string, params: Record<string, any>) => Promise<T>,
  logger: Pick<Console, 'log' | 'warn' | 'error'>,
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
export async function fetchAllReplies(
  commentId: number,
  config: { repliesPerPage: number },
  executeRequest: <T>(path: string, method: string, params: Record<string, any>) => Promise<T>,
  logger: Pick<Console, 'log' | 'warn' | 'error'>,
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
 * 难度规格 —— 用于多难度比赛验证
 */
export interface DifficultyRequirement {
  /** 匹配后返回的标识 */
  key: string
  /** 要求棋盘面积 (row * column)，-1 不检查 */
  area: number
  /** 要求雷数，-1 不检查 */
  mine: number
}

/**
 * 时间窗口参数
 */
export interface TimeWindow {
  start: number
  end: number
}

/**
 * 通用录像验证函数
 * 支持多难度规格 —— 找到第一个匹配的 DifficultyRequirement 即返回其 key
 */
export async function validateRecord(
  recordId: number,
  expectedUid: string,
  timeWindow: TimeWindow,
  requiredType: number,
  requirements: DifficultyRequirement[],
  executeRequest: <T>(path: string, method: string, params: Record<string, any>) => Promise<T>,
  logger: Pick<Console, 'log' | 'warn' | 'error'>,
  recordCacheDir: string,
): Promise<{ recordData: CompetitionEntry['recordData'], matchedRequirement: string | null } | null> {
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
    if (record.createTime < timeWindow.start || record.createTime > timeWindow.end) {
      logger.warn(`[Competition] 录像时间不在比赛窗口内 recordId=${recordId} createTime=${record.createTime}`)
      return null
    }

    // 3. 匹配难度规格 (找到第一个匹配的)
    let matchedRequirement: string | null = null
    if (requirements.length > 0) {
      const actualArea = record.row * record.column
      for (const req of requirements) {
        const areaMatch = req.area === -1 || actualArea === req.area
        const mineMatch = req.mine === -1 || record.mine === req.mine
        if (areaMatch && mineMatch) {
          matchedRequirement = req.key
          break
        }
      }
      if (matchedRequirement === null) {
        logger.warn(`[Competition] 棋盘规格不匹配 recordId=${recordId} area=${actualArea} mine=${record.mine} requirements=${JSON.stringify(requirements.map(r => `${r.key}(area=${r.area},mine=${r.mine})`))}`)
        return null
      }
    }

    // 4. 检查游戏类型
    if (requiredType !== -1 && record.type !== requiredType) {
      logger.warn(`[Competition] 游戏类型不匹配 recordId=${recordId} type=${record.type} required=${requiredType}`)
      return null
    }

    // 5. 必须是已完成的录像
    if (!record.finished) {
      logger.warn(`[Competition] 录像未完成 recordId=${recordId}`)
      return null
    }

    // 提取需要缓存的字段
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

    return { recordData, matchedRequirement }
  }
  catch (err) {
    logger.error(`[Competition] 验证录像异常 recordId=${recordId}:`, err)
    return null
  }
}
