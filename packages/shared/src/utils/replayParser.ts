import type { ActionRecord, PuzzleActionRecord, SchulteActionRecord, TzfeActionRecord } from '../types/record'
import pako from 'pako'

export function parseReplayHandle(base64Str: string): ActionRecord[] {
  const decompressed = decompressBase64(base64Str)
  const segments = decompressed.split('-')
  const actions: ActionRecord[] = []

  for (const seg of segments) {
    if (!seg)
      continue
    const parts = seg.split(':')
    if (parts.length === 4) {
      actions.push({
        action: Number.parseInt(parts[0]!, 10),
        row: Number.parseInt(parts[1]!, 10) + 1,
        column: Number.parseInt(parts[2]!, 10) + 1,
        time: Number.parseInt(parts[3]!, 10) / 1000,
      })
    }
  }

  return actions
}

export function parseSchulteReplayHandle(base64Str: string): SchulteActionRecord[] {
  const decompressed = decompressBase64(base64Str)
  const segments = decompressed.split('-')
  const actions: SchulteActionRecord[] = []
  for (const seg of segments) {
    if (!seg)
      continue
    const parts = seg.split(':')
    if (parts.length >= 3) {
      actions.push({
        idx: Number.parseInt(parts[0]!) - 1,
        right: Number.parseInt(parts[1]!) as 0 | 1,
        time: Number.parseInt(parts[2]!),
      })
    }
  }
  return actions
}

export function parsePuzzleReplayHandle(base64Str: string): PuzzleActionRecord[] {
  const decompressed = decompressBase64(base64Str)
  const segments = decompressed.split('-')
  const actions: PuzzleActionRecord[] = []
  for (const seg of segments) {
    if (!seg)
      continue
    const parts = seg.split(':')
    if (parts.length >= 3) {
      actions.push({
        row: Number.parseInt(parts[0]!),
        column: Number.parseInt(parts[1]!),
        time: Number.parseInt(parts[2]!),
      })
    }
  }
  return actions
}

export function parseNonoReplayHandle(base64Str: string): ActionRecord[] {
  const decompressed = decompressBase64(base64Str)
  const segments = decompressed.split('|')
  const actions: ActionRecord[] = []

  for (const seg of segments) {
    if (!seg)
      continue
    const parts = seg.split(':')
    if (parts.length === 4) {
      actions.push({
        action: Number.parseInt(parts[0]!, 10),
        row: Number.parseInt(parts[1]!, 10),
        column: Number.parseInt(parts[2]!, 10),
        time: Number.parseInt(parts[3]!, 10) / 1000,
      })
    }
  }

  return actions
}

export function parseTzfeReplayHandle(base64Str: string): TzfeActionRecord[] {
  const decompressed = decompressBase64(base64Str)
  const segments = decompressed.split('-')
  const actions: TzfeActionRecord[] = []

  for (const seg of segments) {
    if (!seg)
      continue
    const parts = seg.split(':')
    if (parts.length >= 2) {
      const action = Number.parseInt(parts[0]!, 10)
      const time = Number.parseInt(parts[1]!, 10)
      if (!Number.isNaN(action) && !Number.isNaN(time)) {
        actions.push({
          action, // 0左, 1上, 2右, 3下
          time: time / 1000,
        })
      }
    }
  }

  return actions
}

/**
 * Encode action records into a base64-encoded, gzip-compressed handle string.
 * Reverse of parseReplayHandle.
 * Format: "action:row:column:time-action:row:column:time-..."
 * row/col are 0-indexed internally; time is in milliseconds.
 */
export function encodeReplayHandle(actions: ActionRecord[]): string {
  const parts = actions.map((a) => {
    const row = a.row - 1 // convert back to 0-indexed
    const col = a.column - 1 // convert back to 0-indexed
    const time = Math.round(a.time * 1000) // convert to ms
    return `${a.action}:${row}:${col}:${time}`
  })
  const raw = parts.join('-') + (parts.length > 0 ? '-' : '')
  return compressBase64(raw)
}

function compressBase64(raw: string): string {
  // 使用 gzip 格式（与 Android 端 GZIPOutputStream 兼容）
  const compressed = pako.gzip(raw)
  let binary = ''
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]!)
  }
  return window.btoa(binary)
}

function decompressBase64(base64Str: string): string {
  const binaryString = window.atob(base64Str)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return pako.inflate(bytes, { to: 'string' }) as string
}
