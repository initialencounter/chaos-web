import type { InjectionKey } from 'vue'

export interface ForumApi {
  fetchPostList: (...args: any[]) => Promise<any>
  postGet: (...args: any[]) => Promise<any>
  commentList: (...args: any[]) => Promise<any>
  commentReplyList: (...args: any[]) => Promise<any>
  postListSearch: (...args: any[]) => Promise<any>
  postListGoodUser: (...args: any[]) => Promise<any>
  postListUser: (...args: any[]) => Promise<any>
  postGood: (...args: any[]) => Promise<any>
  commentGood: (...args: any[]) => Promise<any>
  commentAdd: (...args: any[]) => Promise<any>
  commentDelete: (...args: any[]) => Promise<any>
  userHome: (...args: any[]) => Promise<any>
  userSearch: (...args: any[]) => Promise<any>
  userConfigGet: (...args: any[]) => Promise<any>
  relationSet: (...args: any[]) => Promise<any>
  minesweeperRecordGet: (...args: any[]) => Promise<any>
  puzzleRecordGetResponse: (...args: any[]) => Promise<any>
  schulteRecordGet: (...args: any[]) => Promise<any>
  minesweeperRecordList: (...args: any[]) => Promise<any>
  schulteRecordListFilter: (...args: any[]) => Promise<any>
  puzzleRecordListFilter: (...args: any[]) => Promise<any>
  tzfeRecordListFilter: (...args: any[]) => Promise<any>
  nonoRecordListFilter: (...args: any[]) => Promise<any>
  minesweeperCareer: (...args: any[]) => Promise<any>
  sudokuCareer: (...args: any[]) => Promise<any>
  puzzleCareer: (...args: any[]) => Promise<any>
  nonoCareer: (...args: any[]) => Promise<any>
  tzfeCareer: (...args: any[]) => Promise<any>
  schulteCareer: (...args: any[]) => Promise<any>
  [key: string]: any
}

export const forumApiKey: InjectionKey<ForumApi> = Symbol('forumApi')

// Module-level singleton for ForumApi
let _api: ForumApi | null = null

export function setForumApi(api: ForumApi) {
  _api = api
}

export function useForumApi(): ForumApi {
  if (!_api)
    throw new Error('ForumApi not initialized. Call setForumApi() before use.')
  return _api
}

/**
 * 解析资源 URL。
 * - Electron 环境（window.electronAPI.cacheImage 存在）：通过 IPC 缓存远程图片
 * - Web 环境：通过服务端代理转发远程图片
 * - 非远程 URL 直接返回
 */
export async function resolveAsset(url?: string | null): Promise<string> {
  if (!url)
    return './Z7.png'
  if (!url.startsWith('http://') && !url.startsWith('https://'))
    return url
  if (typeof window !== 'undefined' && (window as any).electronAPI?.cacheImage)
    return (window as any).electronAPI.cacheImage(url)
  const proxyBase = (import.meta as any).env?.DEV ? '/api/image-proxy' : '/image-proxy'
  return `${proxyBase}?url=${encodeURIComponent(url)}`
}
