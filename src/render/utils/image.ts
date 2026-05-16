const OSS_BASE = 'https://minesweeper.oss-cn-hongkong.aliyuncs.com'

/**
 * 同步解析图片 URL —— 用于 Electron renderer。
 * 远程 URL 直接使用（主进程已注入认证头），本地资源用相对路径。
 */
export function proxyImageUrl(url: string | undefined | null): string {
  if (!url)
    return './assets/Z7.png'
  if (url.startsWith('http://') || url.startsWith('https://'))
    return url
  if (url.startsWith('@/assets/'))
    return url.replace('@/assets/', './assets/')
  if (url.startsWith('/'))
    return url
  // Relative OSS path
  if (url.startsWith(OSS_BASE))
    return url
  return `${OSS_BASE}/${url}`
}

/**
 * 同步解析图片 URL。
 * 外部 URL（非 OSS）直接返回原始 URL，调用方应改用 resolveAndCache() 获取缓存路径。
 */
export function resolveImageUrl(url: string | undefined | null): string {
  if (!url)
    return './assets/Z7.png'
  if (url.startsWith('@/assets/')) {
    return url.replace('@/assets/', './assets/')
  }
  // 已经是完整外部 URL（OSS 或其他），直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('/')) {
    return OSS_BASE + url
  }
  return `${OSS_BASE}/${url}`
}

/**
 * 异步解析图片 URL 为 data: 缓存路径。
 * 本地资源直接返回，OSS/外部 URL 通过 IPC 下载到本地缓存并以 data: URL 返回，
 * 绕过 CSP img-src 限制。
 */
export async function resolveAndCache(url: string | undefined | null): Promise<string> {
  if (!url)
    return './assets/Z7.png'
  if (url.startsWith('@/assets/')) {
    return url.replace('@/assets/', './assets/')
  }

  let fullUrl: string
  if (url.startsWith('http://') || url.startsWith('https://')) {
    fullUrl = url
  }
  else if (url.startsWith('/')) {
    fullUrl = OSS_BASE + url
  }
  else {
    fullUrl = `${OSS_BASE}/${url}`
  }
  return window.electronAPI.cacheImage(fullUrl)
}
