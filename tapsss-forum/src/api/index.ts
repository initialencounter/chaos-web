import { createForumApi } from '@tapsss/shared'

const isDev = import.meta.env.DEV
const BASE_URL = isDev ? '/api/Minesweeper' : '/Minesweeper'

async function fetchFn<T>(path: string, params: Record<string, any>): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams(params).toString(),
  })
  if (!res.ok)
    throw new Error('API fetch failed')
  return res.json() as Promise<T>
}

const api = createForumApi(fetchFn)

export const {
  fetchPostList,
  postGet,
  commentList,
  commentReplyList,
  postListSearch,
  postListGoodUser,
  postListUser,
  postGood,
  commentGood,
  commentAdd,
  commentDelete,
  userHome,
  userSearch,
  userConfigGet,
  relationSet,
  minesweeperRecordGet,
  puzzleRecordGetResponse,
  schulteRecordGet,
  nonoRecordGet,
  minesweeperRecordList,
  schulteRecordListFilter,
  puzzleRecordListFilter,
  tzfeRecordListFilter,
  nonoRecordListFilter,
  minesweeperCareer,
  sudokuCareer,
  puzzleCareer,
  nonoCareer,
  tzfeCareer,
  schulteCareer,
  gameNewsUser,
} = api
