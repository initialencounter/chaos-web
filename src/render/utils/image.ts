const OSS_HOST = 'minesweeper.oss-cn-hongkong.aliyuncs.com'
const OSS_BASE = `https://${OSS_HOST}`

/**
 * 解析图片 URL：dev 模式下通过 Vite 代理转发 OSS 请求，
 * 生产模式下直接使用原始 URL。
 */
export function resolveImageUrl(url: string | undefined | null): string {
  if (!url)
    return './assets/Z7.png' // 默认头像
  if (url.startsWith(OSS_BASE)) {
    // @ts-expect-error Vite env types
    if (import.meta.env.DEV) {
      return url.replace(OSS_BASE, '/oss')
    }
    return url
  }
  // 相对路径，补全 OSS 基础 URL
  if (url.startsWith('/'))
    return OSS_BASE + url
  return `${OSS_BASE}/${url}`
}
