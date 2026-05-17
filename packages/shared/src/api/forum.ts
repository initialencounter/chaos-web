import type {
  MinesweeperCareerResponse,
  NonoCareerResponse,
  PuzzleCareerResponse,
  SchulteCareerResponse,
  SudokuCareerResponse,
  TzfeCareerResponse,
} from '../types/career'
import type {
  PostCommentListResponse,
  PostGetResponse,
  PostList,
  PostListGoodUserResponse,
  PostListReplyResponse,
  PostResponse,
} from '../types/post'
import type {
  MinesweeperRecordListResponse,
  NonoRecordListFilterResponse,
  PuzzleRecordGetResponse,
  PuzzleRecordListFilterResponse,
  RecordGetResponse,
  SchulteRecordGetResponse,
  SchulteRecordListFilterResponse,
  TzfeRecordListFilterResponse,
} from '../types/record'
import type {
  UserConfigGetResponse,
  UserHomeResponse,
  UserSearchResponse,
} from '../types/user'
import type { FetchFn } from './types'

export function createForumApi(fetchFn: FetchFn) {
  return {
    // ========== 帖子 ==========
    fetchPostList(type = 0, page = 0, count = 20): Promise<PostList> {
      return fetchFn<PostList>('/post/list', { type, page, count })
    },

    postGet(postId: number): Promise<PostGetResponse> {
      return fetchFn<PostGetResponse>('/post/get', { postId })
    },

    commentList(postId: number, sort = 0, page = 0, count = 20): Promise<PostCommentListResponse> {
      return fetchFn<PostCommentListResponse>('/post/comment/list', { postId, sort, page, count })
    },

    commentReplyList(commentId: number, page = 0, count = 20): Promise<PostListReplyResponse> {
      return fetchFn<PostListReplyResponse>('/post/comment/list/reply', { commentId, page, count })
    },

    postListSearch(keyword: string, page = 0, count = 20): Promise<PostList> {
      return fetchFn<PostList>('/post/list/search', { keyword, page, count })
    },

    postListGoodUser(postId: number, page = 0, count = 20): Promise<PostListGoodUserResponse> {
      return fetchFn<PostListGoodUserResponse>('/post/list/good/user', { postId, page, count })
    },

    postGood(postId: number, isGood: boolean): Promise<PostResponse> {
      return fetchFn<PostResponse>('/post/good', { postId, isGood })
    },

    commentGood(commentId: number, isGood: boolean): Promise<PostResponse> {
      return fetchFn<PostResponse>('/post/comment/good', { commentId, isGood })
    },

    commentAdd(postId: number, parentId: number, replyId: number, comment: string): Promise<PostResponse> {
      return fetchFn<PostResponse>('/post/comment/add', { postId, parentId, replyId, comment })
    },

    commentDelete(commentId: number): Promise<PostResponse> {
      return fetchFn<PostResponse>('/post/comment/delete', { commentId })
    },

    // ========== 用户 ==========
    userHome(targetUid?: number, targetName?: string): Promise<UserHomeResponse> {
      return fetchFn<UserHomeResponse>('/user/home', { targetUid, targetName })
    },

    userSearch(name: string, page: number, count: number): Promise<UserSearchResponse> {
      return fetchFn<UserSearchResponse>('/user/search', { name, page, count })
    },

    userConfigGet(uid: number): Promise<UserConfigGetResponse> {
      return fetchFn<UserConfigGetResponse>('/user/config/get', { uid })
    },

    relationSet(targetUid: number, relation: number): Promise<{ code: number, msg: string }> {
      return fetchFn<{ code: number, msg: string }>('/relation/set', { targetUid, relation })
    },

    // ========== 记录详情 ==========
    minesweeperRecordGet(recordId: number): Promise<RecordGetResponse> {
      return fetchFn<RecordGetResponse>('/minesweeper/record/get', { recordId })
    },

    puzzleRecordGetResponse(recordId: number): Promise<PuzzleRecordGetResponse> {
      return fetchFn<PuzzleRecordGetResponse>('/puzzle/record/get', { recordId })
    },

    schulteRecordGet(recordId: number): Promise<SchulteRecordGetResponse> {
      return fetchFn<SchulteRecordGetResponse>('/schulte/record/get', { recordId })
    },

    // ========== 记录列表 ==========
    minesweeperRecordList(userId: string, page: number, count: number): Promise<MinesweeperRecordListResponse> {
      const filter = `{"asc":false,"column":0,"finished":-1,"level":0,"maxBv":0,"maxBvs":0.0,"maxDate":0,"maxTime":0.0,"minBv":0,"minBvs":0.0,"minDate":0,"minTime":0.0,"mine":0,"mode":-1,"row":0,"sort":0,"targetId":0,"type":0,"userId":${userId}}`
      return fetchFn<MinesweeperRecordListResponse>('/minesweeper/record/list', { filter, page, count })
    },

    schulteRecordListFilter(userId: string, page: number, count: number): Promise<SchulteRecordListFilterResponse> {
      const filter = `{"asc":false,"blind":-1,"level":0,"maxDate":0,"maxTime":0.0,"minDate":0,"minTime":0.0,"sort":0,"targetId":0,"type":-1,"userId":${userId}}`
      return fetchFn<SchulteRecordListFilterResponse>('/schulte/record/list/filter', { filter, page, count })
    },

    puzzleRecordListFilter(userId: string, page: number, count: number): Promise<PuzzleRecordListFilterResponse> {
      const filter = `{"asc":false,"blind":-1,"level":0,"maxStep":0,"maxTime":0.0,"minStep":0,"minTime":0.0,"mode":-1,"sort":0,"targetId":0,"userId":${userId}}`
      return fetchFn<PuzzleRecordListFilterResponse>('/puzzle/record/list/filter', { filter, page, count })
    },

    tzfeRecordListFilter(userId: string, page: number, count: number): Promise<TzfeRecordListFilterResponse> {
      const filter = `{"asc":false,"level":0,"maxScore":0,"maxTime":0.0,"minScore":0,"minTime":0.0,"sort":0,"targetId":0,"userId":${userId}}`
      return fetchFn<TzfeRecordListFilterResponse>('/tzfe/record/list/filter', { filter, page, count })
    },

    nonoRecordListFilter(userId: string, page: number, count: number): Promise<NonoRecordListFilterResponse> {
      const filter = `{"asc":false,"column":0,"finished":-1,"level":0,"maxDate":0,"maxTime":0.0,"minDate":0,"minTime":0.0,"mine":0,"mode":-1,"row":0,"sort":0,"targetId":0,"type":0,"userId":${userId}}`
      return fetchFn<NonoRecordListFilterResponse>('/nono/record/list/filter', { filter, page, count })
    },

    // ========== 生涯 ==========
    minesweeperCareer(uid: number): Promise<MinesweeperCareerResponse> {
      return fetchFn<MinesweeperCareerResponse>('/minesweeper/timing/career/simple', { uid })
    },

    sudokuCareer(targetUid: number): Promise<SudokuCareerResponse> {
      return fetchFn<SudokuCareerResponse>('/sudoku/career', { targetUid })
    },

    puzzleCareer(uid: number): Promise<PuzzleCareerResponse> {
      return fetchFn<PuzzleCareerResponse>('/puzzle/career/simple', { uid })
    },

    nonoCareer(uid: number): Promise<NonoCareerResponse> {
      return fetchFn<NonoCareerResponse>('/nono/career/simple', { uid })
    },

    tzfeCareer(targetUid: number): Promise<TzfeCareerResponse> {
      return fetchFn<TzfeCareerResponse>('/tzfe/career', { targetUid, row: 4, column: 4 })
    },

    schulteCareer(targetUid: number): Promise<SchulteCareerResponse> {
      return fetchFn<SchulteCareerResponse>('/schulte/career', { targetUid, level: 5, type: 0, blind: false })
    },
  }
}

export type ForumApi = ReturnType<typeof createForumApi>
