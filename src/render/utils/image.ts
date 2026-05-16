const OSS_BASE = 'https://minesweeper.oss-cn-hongkong.aliyuncs.com'

/**
 * 解析图片 URL：dev 模式下通过 Vite 代理转发 OSS 请求，
 * 生产模式下直接使用原始 URL。
 * 注意：OSS 图片需要通过 cacheImage IPC 做本地缓存，
 * 调用方应使用 resolveAndCache() 异步获取缓存后的 file:// 路径。
 */
export function resolveImageUrl(url: string | undefined | null): string {
  if (!url)
    return './assets/Z7.png'
  if (url.startsWith('@/assets/')) {
    return url.replace('@/assets/', './assets/')
  }
  if (url.startsWith(OSS_BASE)) {
    return url
  }
  const fullUrl = url.startsWith('/') ? OSS_BASE + url : `${OSS_BASE}/${url}`
  return fullUrl
}

/**
 * 异步解析图片 URL 为缓存后的 file:// 路径。
 * 本地资源直接返回，OSS 资源通过 IPC 下载到本地缓存。
 */
export async function resolveAndCache(url: string | undefined | null): Promise<string> {
  if (!url)
    return './assets/Z7.png'
  if (url.startsWith('@/assets/')) {
    return url.replace('@/assets/', './assets/')
  }
  const fullUrl = url.startsWith(OSS_BASE)
    ? url
    : url.startsWith('/')
      ? OSS_BASE + url
      : `${OSS_BASE}/${url}`
  return window.electronAPI.cacheImage(fullUrl)
}
