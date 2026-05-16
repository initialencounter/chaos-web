import type { ActionRecord, PuzzleActionRecord, SchulteActionRecord } from '../types/record'
import pako from 'pako'

export function parseReplayHandle(base64Str: string): ActionRecord[] {
  const binaryString = window.atob(base64Str)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const decompressed = pako.inflate(bytes, { to: 'string' }) as string
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
  const binaryString = window.atob(base64Str)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const decompressed = pako.inflate(bytes, { to: 'string' }) as string
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
  const binaryString = window.atob(base64Str)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const decompressed = pako.inflate(bytes, { to: 'string' }) as string
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
