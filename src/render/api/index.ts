import type { FetchFn } from '@tapsss/shared/api'
import { createForumApi } from '@tapsss/shared/api'

const fetchFn: FetchFn = async <T>(path: string, params: Record<string, any>) => {
  const res = await window.electronAPI.apiRequest(`/Minesweeper${path}`, 'POST', params)
  if (!res.success)
    throw new Error(res.msg || 'API request failed')
  return res as unknown as T
}

export const forumApi = createForumApi(fetchFn)
