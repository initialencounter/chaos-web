/**
 * 纯工具函数 — 无副作用，不依赖任何外部状态
 */

/** 根据 uid 生成稳定的 HSL 颜色 */
export function uidToColor(uid: string): string {
  let h = 0
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) - h + uid.charCodeAt(i)) | 0
  }
  const hue = Math.abs(h) % 360
  const sat = 55 + (Math.abs(h >> 8) % 21)
  const lit = 45 + (Math.abs(h >> 16) % 16)
  return `hsl(${hue}, ${sat}%, ${lit}%)`
}

/** 缓入缓出二次曲线 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 格式化秒数为字符串 */
export function fmtTime(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

/** 格式化日期字符串 "YYYY-MM-DD" → "YYYY年MM月DD日" */
export function fmtDate(dateStr: string): string {
  if (!dateStr)
    return '--'
  const parts = dateStr.split('-')
  return `${parts[0]}年${parts[1]}月${parts[2]}日`
}

/** 在 Canvas 2D 上绘制圆角矩形路径 */
export function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.closePath()
}
