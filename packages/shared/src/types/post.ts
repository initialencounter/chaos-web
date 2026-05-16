import type { ApiResponse, BaseUser, FullUser } from './common'

// ========== 帖子里嵌入的记录类型 ==========
export interface PostMinesweeperRecord {
  bvs: number
  column: number
  createTime: number
  finished: boolean
  id: number
  mine: number
  row: number
  time: number
}

export interface PostPuzzleRecord {
  blind: boolean
  column: number
  id: number
  row: number
  step: number
  time: number
}

export interface PostSchulteRecord {
  actions: unknown
  blind: boolean
  column: number
  createTime: unknown
  id: number
  map: unknown
  maps: unknown
  playCount: number
  postId: number
  reactionTime: number
  row: number
  tap: number
  tapCorrect: number
  time: number
  type: number
  uid: unknown
}

export interface PostNonoRecord {
  column: number
  createTime: number
  finishMode: number
  handle: unknown
  id: number
  map: unknown
  mine: number
  mode: number
  playCount: number
  postId: number
  row: number
  themeId: number
  time: number
  type: number
  uid: unknown
  upload: boolean
}

export interface PostTzfeRecord {
  actions: unknown
  beginMap: unknown
  column: number
  createTime: unknown
  id: number
  map: unknown
  maxValue: number
  playCount: number
  postId: number
  row: number
  score: number
  seed: number
  stageTimes: unknown
  time: number
  uid: unknown
}

// ========== 帖子列表 ==========
export interface LastCommentUser extends BaseUser {
  background: string
  country: null | string
}

export interface LastComment {
  comment: string
  createTime: number
  device: null | string
  goodCount: number
  hasGood: boolean
  id: number
  parentId: number
  picture: string
  postId: number
  replyCount: number
  replyList: null | unknown
  stick: boolean
  uid: string
  user: LastCommentUser
}

export interface PostListUser extends BaseUser {}

export interface PostListDatum {
  collect: boolean
  commentCount: number
  commentTime: number
  createTime: number
  device: null | string
  essence: boolean
  forum: null | string
  goodCount: number
  goodTime: null | number
  goodUser: null | BaseUser
  hasGood: boolean
  id: number
  lastComment: LastComment
  minesweeperThemeId: number
  minesweeperThemeScore: number
  nonoRecord: null | PostNonoRecord
  nonoThemeId: number
  nonoThemeScore: number
  puzzleRecord: null | PostPuzzleRecord
  record: PostMinesweeperRecord
  recordId: number
  recordType: number
  schulteRecord: null | PostSchulteRecord
  sourceUid: unknown
  status: number
  stick: number
  text: null | string
  title: null | string
  tzfeRecord: PostTzfeRecord
  uid: string
  user: PostListUser
  userStick: boolean
  viewCount: number
}

export type PostList = ApiResponse<PostListDatum[]>

// ========== 帖子详情 ==========
export type PostGetResponse = ApiResponse<{
  collect: boolean
  commentCount: number
  commentTime: number
  createTime: number
  device: string
  essence: boolean
  forum: string
  goodCount: number
  goodTime: number
  goodUser: null
  hasGood: boolean
  id: number
  lastComment: null
  minesweeperThemeId: number
  minesweeperThemeScore: number
  nonoRecord: null | PostNonoRecord
  nonoThemeId: number
  nonoThemeScore: number
  puzzleRecord: null | PostPuzzleRecord
  record: PostMinesweeperRecord
  recordId: number
  recordType: number
  schulteRecord: null
  sourceUid: null
  status: number
  stick: number
  text: string
  title: string
  tzfeRecord: null
  uid: string
  user: FullUser
  userStick: boolean
  viewCount: number
}>

// ========== 置顶评论 ==========
export type PostGetTopResponse = ApiResponse<{
  comment: string
  createTime: number
  device: string
  goodCount: number
  hasGood: boolean
  id: number
  parentId: number
  picture: string
  postId: number
  replyCount: number
  replyList: null
  stick: boolean
  uid: string
  user: FullUser
}>

// ========== 评论列表 ==========
export interface CommentReplyListUser extends FullUser {}

export interface CommentReplyList {
  comment: string
  createTime: number
  device: null | string
  goodCount: number
  hasGood: boolean
  id: number
  parentId: number
  picture: string
  postId: number
  replyCount: number
  replyList: null
  stick: boolean
  uid: string
  user: CommentReplyListUser
}

export interface CommentDatumUser extends BaseUser {
  background: null | string
}

export interface CommentDatum {
  comment: string
  createTime: number
  device: string
  goodCount: number
  hasGood: boolean
  id: number
  parentId: number
  picture: string
  postId: number
  replyCount: number
  replyList: CommentReplyList[]
  stick: boolean
  uid: string
  user: CommentDatumUser
}

export type PostCommentListResponse = ApiResponse<CommentDatum[]>

// ========== 点赞用户 ==========
export type PostListGoodUserResponse = ApiResponse<BaseUser[]>

// ========== 回复列表 ==========
export interface ReplyListDatum {
  comment?: string
  createTime?: number
  device?: string
  goodCount?: number
  hasGood?: boolean
  id?: number
  parentId?: number
  picture?: string
  postId?: number
  replyCount?: number
  replyList?: null
  stick?: boolean
  uid?: string
  user?: FullUser
}

export type PostListReplyResponse = ApiResponse<ReplyListDatum[]>

// ========== 通用操作响应 ==========
export type PostResponse = ApiResponse<boolean>

// ========== 每日之星 ==========
export type DailyStarResponse = ApiResponse<{
  bv: number
  bvs: number
  collect: boolean
  column: number
  createTime: number
  effectiveTap: number
  estimatedTime: number
  finished: boolean
  handle: string
  id: number
  map: string
  mapStatus: null
  mine: number
  mode: number
  playCount: number
  postId: number
  rank: number
  rankPercent: number
  row: number
  solvedBv: number
  tap: number
  themeId: number
  time: number
  type: number
  uid: string
  upload: boolean
  user: FullUser
}>
