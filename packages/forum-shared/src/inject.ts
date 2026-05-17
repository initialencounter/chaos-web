import type { InjectionKey } from 'vue'

export interface ForumApi {
  fetchPostList: (...args: any[]) => Promise<any>
  postGet: (...args: any[]) => Promise<any>
  commentList: (...args: any[]) => Promise<any>
  commentReplyList: (...args: any[]) => Promise<any>
  postListSearch: (...args: any[]) => Promise<any>
  postListGoodUser: (...args: any[]) => Promise<any>
  userHome: (...args: any[]) => Promise<any>
  userSearch: (...args: any[]) => Promise<any>
  userConfigGet: (...args: any[]) => Promise<any>
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
export const resolveAssetKey: InjectionKey<(url?: string | null) => string | Promise<string>> = Symbol('resolveAsset')
export const assetBaseKey: InjectionKey<string> = Symbol('assetBase')

// Module-level singletons (for Pinia stores and non-component code)
let _api: ForumApi | null = null
let _resolveAsset: ((url?: string | null) => string | Promise<string>) | null = null
let _assetBase = ''

export function setForumApi(api: ForumApi) {
  _api = api
}

export function useForumApi(): ForumApi {
  if (!_api)
    throw new Error('ForumApi not initialized. Call setForumApi() before use.')
  return _api
}

export function setResolveAsset(fn: (url?: string | null) => string | Promise<string>) {
  _resolveAsset = fn
}

export function useResolveAsset() {
  if (!_resolveAsset)
    throw new Error('ResolveAsset not initialized. Call setResolveAsset() before use.')
  return _resolveAsset
}

export function setAssetBase(base: string) {
  _assetBase = base
}

export function useAssetBase() {
  return _assetBase
}
