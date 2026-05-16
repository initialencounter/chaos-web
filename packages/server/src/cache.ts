import type { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ========== 图片缓存 ==========

export function getImgCacheDir(baseDir: string): string {
  const dir = join(baseDir, 'image-cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getImgCacheHash(url: string): string {
  return createHash('md5').update(url).digest('hex')
}

export function findCachedImage(cacheDir: string, url: string): string | null {
  const hash = getImgCacheHash(url)
  if (!existsSync(cacheDir))
    return null
  const files = readdirSync(cacheDir).filter(f => f.startsWith(hash))
  if (files.length > 0)
    return join(cacheDir, files[0]!)
  return null
}

export function detectMimeTypeFromBuffer(buf: Buffer): string {
  if (buf.length < 4)
    return 'application/octet-stream'
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF)
    return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47)
    return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
    return 'image/gif'
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)
    return 'image/webp'
  return 'application/octet-stream'
}

export function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return map[mime] || 'bin'
}

export function saveImageToCache(cacheDir: string, url: string, buffer: Buffer): string {
  const hash = getImgCacheHash(url)
  const ext = getExtFromMime(detectMimeTypeFromBuffer(buffer))
  const filePath = join(cacheDir, `${hash}.${ext}`)
  writeFileSync(filePath, buffer)
  return filePath
}

// ========== 记录缓存 ==========

export function getRecordCacheDir(baseDir: string): string {
  const dir = join(baseDir, 'record-cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getCachedRecordPath(cacheDir: string, recordType: string, recordId: number): string | null {
  const cacheFile = join(cacheDir, `${recordType}-${recordId}.json`)
  return existsSync(cacheFile) ? cacheFile : null
}

export function saveRecordToCache(cacheDir: string, recordType: string, recordId: number, data: unknown): void {
  const cacheFile = join(cacheDir, `${recordType}-${recordId}.json`)
  writeFileSync(cacheFile, JSON.stringify(data))
}

export function readRecordFromCache(cacheDir: string, recordType: string, recordId: number): unknown | null {
  const cacheFile = join(cacheDir, `${recordType}-${recordId}.json`)
  if (!existsSync(cacheFile))
    return null
  return JSON.parse(readFileSync(cacheFile, 'utf-8'))
}
