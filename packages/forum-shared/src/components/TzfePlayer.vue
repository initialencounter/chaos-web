<script setup lang="ts">
import type { TzfeActionRecord, TzfeRecordGetResponse } from '@tapsss/shared'
import {
  applyMove,
  cacheRecord,
  createState,
  exponentGridToValues,
  getCachedRecord,
  parseTzfeReplayHandle,
} from '@tapsss/shared/utils'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useForumApi } from '../inject'
import UserAvatar from './UserAvatar.vue'

defineOptions({ name: 'TzfePlayer' })

const props = defineProps<{
  recordId: string
}>()
const isDev = import.meta.env.DEV
const api = useForumApi()

type TzfeData = TzfeRecordGetResponse['data']
type Grid = number[][]

interface TileData {
  key: string
  row: number
  col: number
  value: number
  anim: 'idle' | 'new' | 'merged'
}

interface PlayData extends TzfeData {
  parsedActions: TzfeActionRecord[]
  boardSnapshots: Grid[]
  tileFrames: TileData[][]
  isReplaying: boolean
}

const loading = ref(true)
const errorMsg = ref('')
const replayData = shallowRef<PlayData | null>(null)

// Canvas
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = shallowRef<CanvasRenderingContext2D | null>(null)
const cellSize = ref(100)
const BOARD_GAP = 8

// Playback state
const isPlaying = ref(false)
const currentTime = ref(0)
const playbackSpeed = ref(1.0)
const totalTime = ref(0)

// Speed control
const SPEED_OPTIONS = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0]

// Web Audio API
let audioCtx: AudioContext | null = null
let openBuffer: AudioBuffer | null = null
let mixedAudioBuffer: AudioBuffer | null = null
let audioSourceNode: AudioBufferSourceNode | null = null

let rafId: number | null = null
let tickStartTime = 0
let tickStartOffset = 0
const audioReady = ref(false)

// Animation state
let animStartTime = 0
let animRaf: number | null = null
const ANIM_DURATION = 150 // ms

// ========== Tile color scheme (2048verse-inspired) ==========
const TILE_BG_COLORS: Record<number, string> = {
  0: '#cdc1b4',
  1: '#eee4da',
  2: '#ede0c8',
  3: '#f2b179',
  4: '#f59563',
  5: '#f67c5f',
  6: '#f65e3b',
  7: '#edcf72',
  8: '#edcc61',
  9: '#edc850',
  10: '#edc53f',
  11: '#edc22e',
  12: '#3c3a32',
  13: '#3c3a32',
}

function getTileColor(exp: number): { bg: string, fg: string } {
  return {
    bg: TILE_BG_COLORS[exp] ?? '#3c3a32',
    fg: exp >= 3 ? '#f9f6f2' : '#776e65',
  }
}

// ========== Current frame index (binary search) ==========
const currentFrameIndex = computed(() => {
  if (!replayData.value)
    return 0
  const actions = replayData.value.parsedActions
  if (!replayData.value.isReplaying)
    return 0
  if (currentTime.value <= 0)
    return 0
  let lo = 0
  let hi = actions.length - 1
  let result = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (actions[mid]!.time <= currentTime.value) {
      result = mid + 1
      lo = mid + 1
    }
    else {
      hi = mid - 1
    }
  }
  return result
})

// ========== Parsed stage times ==========
const parsedStageTimes = computed(() => {
  const data = replayData.value
  if (!data?.stageTimes)
    return []
  return data.stageTimes.split('|').map(t => Number.parseInt(t, 10)).filter(t => t > 0)
})

// ========== Map parsing ==========
function parseMapToGrid(mapStr: string): Grid {
  return mapStr.split('-').map(row =>
    row.split(':').map(v => Number.parseInt(v, 10)),
  )
}

function gridsEqual(a: Grid, b: Grid): boolean {
  if (a.length !== b.length)
    return false
  for (let r = 0; r < a.length; r++) {
    if (a[r]!.length !== b[r]!.length)
      return false
    for (let c = 0; c < a[r]!.length; c++) {
      if (a[r]![c] !== b[r]![c])
        return false
    }
  }
  return true
}

// ========== Game simulation with tile identity tracking ==========

interface ExpTile {
  exp: number
  row: number
  col: number
  key: string
  consumed?: boolean
}

/**
 * Process a single row/column line to detect moves and merges.
 */
function processLine(
  prevLine: ExpTile[],
  beforeLineVals: number[],
  lineIdx: number,
  isRow: boolean,
  reverse: boolean,
  stepIndex: number,
): { matched: ExpTile[], merged: ExpTile[] } {
  const size = beforeLineVals.length
  const matched: ExpTile[] = []
  const merged: ExpTile[] = []

  const sortedPrev = [...prevLine].sort((a, b) => {
    const posA = isRow ? a.col : a.row
    const posB = isRow ? b.col : b.row
    return reverse ? posB - posA : posA - posB
  })
  const available = sortedPrev.filter(t => !t.consumed)

  let srcIdx = 0
  let col = 0
  while (col < size) {
    const val = beforeLineVals[col]
    if (val === 0) {
      col++
      continue
    }

    const cellIdx = reverse ? size - 1 - col : col

    if (srcIdx < available.length) {
      const src = available[srcIdx]!
      if (
        srcIdx + 1 < available.length
        && available[srcIdx + 1]!.exp === src.exp
        && val === src.exp + 1
      ) {
        const src2 = available[srcIdx + 1]!
        src.consumed = true
        src2.consumed = true
        const r = isRow ? lineIdx : cellIdx
        const c = isRow ? cellIdx : lineIdx
        merged.push({ exp: val, row: r, col: c, key: `merge-${stepIndex}-${r}-${c}` })
        srcIdx += 2
        col++
        continue
      }

      if (src.exp === val) {
        src.consumed = true
        const r = isRow ? lineIdx : cellIdx
        const c = isRow ? cellIdx : lineIdx
        matched.push({ exp: val, row: r, col: c, key: src.key })
        srcIdx++
        col++
        continue
      }
    }

    const r = isRow ? lineIdx : cellIdx
    const c = isRow ? cellIdx : lineIdx
    matched.push({ exp: val, row: r, col: c, key: `move-${stepIndex}-${r}-${c}` })
    col++
  }

  return { matched, merged }
}

/**
 * Build tile frames during game simulation.
 */
function computeTileFrames(
  seed: number,
  size: number,
  beginMapStr: string | null,
  actions: TzfeActionRecord[],
): { tileFrames: TileData[][], valueSnapshots: Grid[], initialCount: number } | null {
  let beginExpGrid: Grid
  if (beginMapStr) {
    beginExpGrid = parseMapToGrid(beginMapStr)
  }
  else {
    beginExpGrid = Array.from({ length: size }, () =>
      Array.from<number>({ length: size }).fill(0)) as Grid
  }

  const initialCount = 0

  try {
    let state = createState(BigInt(seed), [], size, initialCount, beginExpGrid)
    const valueSnapshots: Grid[] = [exponentGridToValues(state.grid)]
    const tileFrames: TileData[][] = []

    // Build initial tile frame
    let prevExpTiles: ExpTile[] = []
    {
      const initTiles: TileData[] = []
      let keyId = 0
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const exp = state.grid[r]![c]!
          if (exp > 0) {
            const key = `init-${keyId++}`
            initTiles.push({ key, row: r, col: c, value: 2 ** exp, anim: 'idle' })
            prevExpTiles.push({ exp, row: r, col: c, key, consumed: false })
          }
        }
      }
      tileFrames.push(initTiles)
    }

    // Process each action
    for (let i = 0; i < actions.length; i++) {
      const act = actions[i]!
      const result = applyMove(state, act.action)
      const { gridBeforeSpawn, state: nextState } = result

      // Last action: only merge, no random spawn (game ends at target tile)
      const isLastAction = i === actions.length - 1
      const finalGrid = isLastAction ? gridBeforeSpawn : nextState.grid

      // Detect new tiles (skip for last action)
      const newTilePositions: Set<string> = new Set()
      if (!isLastAction) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (nextState.grid[r]![c]! > 0 && gridBeforeSpawn[r]![c] === 0) {
              newTilePositions.add(`${r},${c}`)
            }
          }
        }
      }

      // Reset consumed flags
      for (const t of prevExpTiles)
        t.consumed = false

      const allResultTiles: ExpTile[] = []
      const animFlags: Map<string, 'new' | 'merged'> = new Map()

      if (act.action === 0 || act.action === 2) {
        const reverse = act.action === 2
        for (let r = 0; r < size; r++) {
          const prevLine = prevExpTiles.filter(t => t.row === r && !t.consumed)
          const beforeLine = gridBeforeSpawn[r]!
          const workBeforeLine = reverse ? [...beforeLine].reverse() : [...beforeLine]
          const { matched, merged } = processLine(prevLine, workBeforeLine, r, true, reverse, i)

          for (const t of matched)
            allResultTiles.push(t)
          for (const t of merged) {
            allResultTiles.push(t)
            animFlags.set(`${t.row},${t.col}`, 'merged')
          }
        }
      }
      else {
        const reverse = act.action === 3
        for (let c = 0; c < size; c++) {
          const prevLine = prevExpTiles.filter(t => t.col === c && !t.consumed)
          const beforeLine = gridBeforeSpawn.map(row => row[c]!)
          const workBeforeLine = reverse ? [...beforeLine].reverse() : [...beforeLine]
          const { matched, merged } = processLine(prevLine, workBeforeLine, c, false, reverse, i)

          for (const t of matched)
            allResultTiles.push(t)
          for (const t of merged) {
            allResultTiles.push(t)
            animFlags.set(`${t.row},${t.col}`, 'merged')
          }
        }
      }

      // Add new spawned tiles (skip for last action)
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (newTilePositions.has(`${r},${c}`)) {
            const exp = nextState.grid[r]![c]!
            allResultTiles.push({ exp, row: r, col: c, key: `spawn-${i}-${r}-${c}` })
            animFlags.set(`${r},${c}`, 'new')
          }
        }
      }

      // Build TileData array
      const tileData: TileData[] = []
      for (const t of allResultTiles) {
        tileData.push({
          key: t.key,
          row: t.row,
          col: t.col,
          value: 2 ** t.exp,
          anim: animFlags.get(`${t.row},${t.col}`) ?? 'idle',
        })
      }
      tileFrames.push(tileData)

      valueSnapshots.push(exponentGridToValues(finalGrid))
      prevExpTiles = allResultTiles.map(t => ({ ...t, consumed: false }))
      state = nextState
    }

    return { tileFrames, valueSnapshots, initialCount }
  }
  catch (err) {
    console.error('[TzfePlayer] Tile frame computation failed:', err)
    return null
  }
}

function computeBoardSnapshots(
  seed: number,
  size: number,
  beginMapStr: string | null,
  actions: TzfeActionRecord[],
  finalMapStr: string,
): { snapshots: Grid[], tileFrames: TileData[][], initialCount: number } | null {
  const result = computeTileFrames(seed, size, beginMapStr, actions)
  if (!result)
    return null

  const { valueSnapshots } = result
  const finalExpGrid = parseMapToGrid(finalMapStr)
  const finalGrid = exponentGridToValues(finalExpGrid)
  const lastSnapshot = valueSnapshots[valueSnapshots.length - 1]!

  if (!gridsEqual(lastSnapshot, finalGrid)) {
    console.warn('[TzfePlayer] Expected final grid:', finalGrid, 'but got:', lastSnapshot)
    errorMsg.value = '录像数据异常：模拟结果与记录的最终局面不符'
    return null
  }

  return { snapshots: valueSnapshots, tileFrames: result.tileFrames, initialCount: result.initialCount }
}

// ========== Canvas rendering ==========

function drawRoundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.arcTo(x + w, y, x + w, y + r, r)
  g.lineTo(x + w, y + h - r)
  g.arcTo(x + w, y + h, x + w - r, y + h, r)
  g.lineTo(x + r, y + h)
  g.arcTo(x, y + h, x, y + h - r, r)
  g.lineTo(x, y + r)
  g.arcTo(x, y, x + r, y, r)
  g.closePath()
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeBackOut(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

/**
 * Draw the board with animation interpolation between two tile frames.
 * @param progress 0..1 animation progress (1 = final state)
 * @param fromTiles previous frame tiles
 * @param toTiles current frame tiles
 */
function drawBoard(progress: number, fromTiles: TileData[], toTiles: TileData[]) {
  const g = ctx.value
  const data = replayData.value
  if (!g || !data)
    return

  const rows = data.row
  const cols = data.column
  const cs = cellSize.value
  const gap = BOARD_GAP
  const borderRadius = Math.max(2, Math.floor(cs * 0.06))

  // Clear background
  g.fillStyle = '#bbada0'
  g.fillRect(0, 0, g.canvas.width, g.canvas.height)

  // Draw grid cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gap + c * (cs + gap)
      const y = gap + r * (cs + gap)
      g.fillStyle = '#cdc1b4'
      drawRoundRect(g, x, y, cs, cs, borderRadius)
      g.fill()
    }
  }

  // Build from-tile lookup by key
  const fromByKey = new Map<string, TileData>()
  for (const t of fromTiles)
    fromByKey.set(t.key, t)

  // Eased progress for movement
  const moveProgress = easeOut(progress)

  // Draw tiles
  for (const tile of toTiles) {
    const from = fromByKey.get(tile.key)
    // If tile existed in previous frame, interpolate position; otherwise start from target
    const fromRow = from ? from.row : tile.row
    const fromCol = from ? from.col : tile.col

    const fromX = gap + fromCol * (cs + gap)
    const fromY = gap + fromRow * (cs + gap)
    const toX = gap + tile.col * (cs + gap)
    const toY = gap + tile.row * (cs + gap)

    const x = fromX + (toX - fromX) * moveProgress
    const y = fromY + (toY - fromY) * moveProgress

    // Scale animation for new / merged tiles
    let scale = 1.0
    if (tile.anim === 'new') {
      scale = Math.min(progress * 1.3, easeBackOut(progress))
      scale = Math.max(0, Math.min(scale, 1.0))
    }
    else if (tile.anim === 'merged') {
      // Pop: quickly scale up to ~1.15 then settle to 1.0
      if (progress < 0.4) {
        scale = progress / 0.4 * 1.15
      }
      else {
        scale = 1.15 - (progress - 0.4) / 0.6 * 0.15
      }
      scale = Math.max(0, Math.min(scale, 1.15))
    }

    const exp = tile.value === 0 ? 0 : Math.log2(tile.value)
    const { bg, fg } = getTileColor(exp)

    g.save()
    // Translate to center, apply scale around center
    const cx = x + cs / 2
    const cy = y + cs / 2
    g.translate(cx, cy)
    if (scale !== 1.0)
      g.scale(scale, scale)

    // Draw tile background
    g.fillStyle = bg
    drawRoundRect(g, -cs / 2, -cs / 2, cs, cs, borderRadius)
    g.fill()

    // Draw tile number
    if (tile.value > 0) {
      g.fillStyle = fg
      let fontSize: number
      if (tile.value < 100) {
        fontSize = cs * 0.45
      }
      else if (tile.value < 1000) {
        fontSize = cs * 0.35
      }
      else if (tile.value < 10000) {
        fontSize = cs * 0.28
      }
      else {
        fontSize = cs * 0.22
      }
      g.font = `bold ${fontSize}px Arial, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(tile.value), 0, 0)
    }

    g.restore()
  }
}

function cancelAnimLoop() {
  if (animRaf !== null) {
    cancelAnimationFrame(animRaf)
    animRaf = null
  }
}

/** Render the board at a specific frame index without animation. */
function renderStatic(fi: number) {
  const data = replayData.value
  if (!data)
    return
  const tiles = data.tileFrames[fi] ?? []
  drawBoard(1.0, tiles, tiles)
}

/** Start an animated transition between two frame indices. */
function animateTransition(fromFi: number, toFi: number) {
  const data = replayData.value
  if (!data)
    return

  cancelAnimLoop()

  const fromTiles = data.tileFrames[fromFi] ?? []
  const toTiles = data.tileFrames[toFi] ?? []

  animStartTime = performance.now()

  const loop = () => {
    const elapsed = performance.now() - animStartTime
    const progress = Math.min(elapsed / ANIM_DURATION, 1.0)
    drawBoard(progress, fromTiles, toTiles)
    if (progress < 1.0) {
      animRaf = requestAnimationFrame(loop)
    }
    else {
      animRaf = null
    }
  }
  animRaf = requestAnimationFrame(loop)
}

function initCanvas() {
  const canvas = canvasRef.value
  const data = replayData.value
  if (!canvas || !data)
    return

  ctx.value = canvas.getContext('2d')
  const cs = cellSize.value
  const gap = BOARD_GAP
  canvas.width = data.column * cs + (data.column - 1) * gap + gap * 2
  canvas.height = data.row * cs + (data.row - 1) * gap + gap * 2

  renderStatic(currentFrameIndex.value)
}

// ========== Audio ==========
async function initAudio() {
  audioCtx = new AudioContext()
  const openResp = await fetch('./audio/open.mp3')
  const openData = await openResp.arrayBuffer()
  openBuffer = await audioCtx.decodeAudioData(openData)
}

async function renderAudioTrack() {
  if (!audioCtx || !openBuffer)
    return
  const data = replayData.value
  if (!data?.isReplaying)
    return
  const actions = data.parsedActions
  const sr = audioCtx.sampleRate
  const pad = openBuffer.duration + 0.1
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil((totalTime.value + pad) * sr),
    sr,
  )
  for (const act of actions) {
    const source = offlineCtx.createBufferSource()
    source.buffer = openBuffer
    const gain = offlineCtx.createGain()
    gain.gain.value = 0.5
    source.connect(gain)
    gain.connect(offlineCtx.destination)
    source.start(act.time)
  }
  mixedAudioBuffer = await offlineCtx.startRendering()
}

function startAudioPlayback(offset: number, speed: number) {
  stopAudioPlayback()
  if (!audioCtx || !mixedAudioBuffer)
    return
  audioSourceNode = audioCtx.createBufferSource()
  audioSourceNode.buffer = mixedAudioBuffer
  audioSourceNode.playbackRate.value = speed
  audioSourceNode.connect(audioCtx.destination)
  audioSourceNode.start(0, offset)
}

function stopAudioPlayback() {
  if (audioSourceNode) {
    try {
      audioSourceNode.stop()
    }
    catch {
      /* already stopped */
    }
    audioSourceNode.disconnect()
    audioSourceNode = null
  }
}

// ========== Frame transition trigger ==========
watch(currentFrameIndex, (newFi, oldFi) => {
  if (oldFi === undefined || oldFi === newFi)
    return

  // Instant render for: large jumps or fast playback
  const instant = Math.abs(newFi - oldFi) > 1 || playbackSpeed.value >= 4

  if (instant) {
    cancelAnimLoop()
    renderStatic(newFi)
  }
  else {
    animateTransition(oldFi, newFi)
  }
})

// ========== Playback controls ==========
function tick() {
  if (!isPlaying.value)
    return

  const elapsed = (performance.now() - tickStartTime) / 1000
  currentTime.value = tickStartOffset + elapsed * playbackSpeed.value

  if (currentTime.value >= totalTime.value) {
    currentTime.value = totalTime.value
    isPlaying.value = false
    stopTicker()
  }
}

function startTicker() {
  stopTicker()
  tickStartTime = performance.now()
  tickStartOffset = currentTime.value
  if (audioReady.value) {
    startAudioPlayback(currentTime.value, playbackSpeed.value)
  }
  const loop = () => {
    tick()
    if (isPlaying.value)
      rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

function stopTicker() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  stopAudioPlayback()
}

function togglePlay() {
  if (audioReady.value && audioCtx?.state === 'suspended') {
    audioCtx.resume()
  }
  if (currentTime.value >= totalTime.value) {
    currentTime.value = 0
  }
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    startTicker()
  }
  else {
    stopTicker()
  }
}

function seek(e: Event) {
  const target = e.target as HTMLInputElement
  currentTime.value = Number.parseFloat(target.value)
  cancelAnimLoop()
  if (isPlaying.value) {
    tickStartTime = performance.now()
    tickStartOffset = currentTime.value
    if (audioReady.value) {
      startAudioPlayback(currentTime.value, playbackSpeed.value)
    }
  }
}

function stepFrame(direction: number) {
  const data = replayData.value
  if (!data)
    return

  let targetIndex = currentFrameIndex.value + direction
  if (targetIndex < 0)
    targetIndex = 0
  const maxIndex = data.isReplaying ? data.parsedActions.length : 0
  if (targetIndex > maxIndex)
    targetIndex = maxIndex

  if (targetIndex === 0) {
    currentTime.value = 0
  }
  else {
    currentTime.value = data.parsedActions[targetIndex - 1]?.time ?? 0
    if (currentTime.value === 0) {
      currentTime.value = Number.EPSILON
    }
  }

  isPlaying.value = false
  stopTicker()
}

function jumpToAction(idx: number) {
  const data = replayData.value
  if (!data)
    return
  currentTime.value = data.parsedActions[idx]?.time ?? 0
  if (currentTime.value === 0) {
    currentTime.value = Number.EPSILON
  }
  isPlaying.value = false
  stopTicker()
}

function changeSpeed(delta: number) {
  const speeds = SPEED_OPTIONS
  const currentIdx = speeds.indexOf(playbackSpeed.value)
  let newIdx = currentIdx + delta
  if (newIdx < 0)
    newIdx = 0
  if (newIdx >= speeds.length)
    newIdx = speeds.length - 1
  playbackSpeed.value = speeds[newIdx]!
}

watch(playbackSpeed, () => {
  if (isPlaying.value) {
    tickStartTime = performance.now()
    tickStartOffset = currentTime.value
    if (audioReady.value) {
      startAudioPlayback(currentTime.value, playbackSpeed.value)
    }
  }
})

watch(audioReady, (ready) => {
  if (ready && isPlaying.value && mixedAudioBuffer) {
    startAudioPlayback(currentTime.value, playbackSpeed.value)
  }
})

// ========== Action list scroll ==========
const listScrollRef = ref<HTMLDivElement | null>(null)

watch(currentFrameIndex, async (fi) => {
  await nextTick()
  const container = listScrollRef.value
  if (!container)
    return
  const rows = container.querySelectorAll('.action-row')
  const targetIdx = fi === 0 ? 0 : fi - 1
  const row = rows[targetIdx] as HTMLElement | undefined
  if (!row)
    return
  const rowTop = row.offsetTop
  const rowH = row.offsetHeight
  const cTop = container.scrollTop
  const cH = container.clientHeight
  if (rowTop < cTop) {
    container.scrollTop = rowTop
  }
  else if (rowTop + rowH > cTop + cH) {
    container.scrollTop = rowTop + rowH - cH
  }
})

// ========== Data loading ==========
async function loadReplay() {
  try {
    loading.value = true
    errorMsg.value = ''
    const recordIdNum = Number(props.recordId)

    let cached
    if (isDev) {
      cached = {
        url: null,
        code: 200,
        msg: null,
        data: {
          id: 209464,
          uid: '65617',
          postId: 975729,
          row: 4,
          column: 4,
          time: 55696,
          score: 20204,
          maxValue: 11,
          map: '0:0:0:2-0:0:2:3-1:3:4:2-0:0:2:11',
          beginMap: '0:0:0:0-0:0:0:0-1:0:0:0-0:0:0:1',
          seed: 1667011994673,
          actions: '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\n',
          stageTimes: '648|2284|2990|8136|14263|26984|55695',
          playCount: 223,
          createTime: 1667012050000,
          user: {
            id: 65617,
            uid: '65617',
            avatar: 'https://minesweeper.oss-cn-hongkong.aliyuncs.com/1686290721141.jpeg',
            background: 'https://minesweeper.oss-cn-hongkong.aliyuncs.com/1707647520897.png',
            nickName: 'mochuannnn',
            sex: 1,
            sign: '退坑了',
            vip: false,
            mark: 'golden',
            timingLevel: 9,
            timingRank: 10,
            puzzleRank: 48,
            relation: 0,
            country: 'CN',
            chaosInGame: false,
            chaosInView: false,
            pvpInGame: false,
            pvpInWait: false,
            online: false,
          },
          collect: false,
          scoreRank: 36375,
          timeTank: 219,
          scoreRankPercent: 0.8005,
          timeRankPercent: 0.9989,
        },
      }
    }
    else {
      cached = await getCachedRecord<TzfeRecordGetResponse>('tzfe', recordIdNum)
    }

    const res: TzfeRecordGetResponse = cached ?? await api.tzfeRecordGet(recordIdNum)
    if (!cached && res.code === 200) {
      cacheRecord('tzfe', recordIdNum, res)
    }

    if (res.code === 200 && res.data) {
      const data = res.data
      let isReplaying = data.actions != null && data.actions !== ''
      let parsedActions: TzfeActionRecord[] = []
      let boardSnapshots: Grid[] = []
      let tileFrames: TileData[][] = []

      if (isReplaying) {
        parsedActions = parseTzfeReplayHandle(data.actions!)
        const seed = data.seed ?? 0
        const result = computeBoardSnapshots(
          seed,
          data.row,
          data.beginMap,
          parsedActions,
          data.map,
        )

        if (result) {
          boardSnapshots = result.snapshots
          tileFrames = result.tileFrames
        }
        else {
          // Fallback: show static board
          const finalExpGrid = parseMapToGrid(data.map)
          boardSnapshots = [exponentGridToValues(finalExpGrid)]
          tileFrames = [buildStaticTileFrame(boardSnapshots[0]!)]
          parsedActions = []
          isReplaying = false
        }
      }
      else {
        boardSnapshots = [exponentGridToValues(parseMapToGrid(data.map))]
        tileFrames = [buildStaticTileFrame(boardSnapshots[0]!)]
      }

      replayData.value = {
        ...data,
        parsedActions,
        boardSnapshots,
        tileFrames,
        isReplaying,
      }

      totalTime.value = data.time / 1000
      cellSize.value = Math.min(
        120,
        Math.floor(500 / Math.max(data.row, data.column)),
      )

      loading.value = false
      await nextTick()
      initCanvas()

      if (isReplaying) {
        initAudio()
          .then(() => {
            audioReady.value = true
            return renderAudioTrack()
          })
          .catch((err) => {
            console.warn('[TzfePlayer] Audio init failed:', err)
          })
      }
      else {
        audioReady.value = true
      }
    }
    else {
      errorMsg.value = res.msg || '无法获取录像数据'
      loading.value = false
    }
  }
  catch (error: any) {
    console.error(error)
    errorMsg.value = error.message || '加载失败'
    loading.value = false
  }
}

/** Build a static tile frame from a value grid (for non-replaying displays). */
function buildStaticTileFrame(valueGrid: Grid): TileData[] {
  const tiles: TileData[] = []
  let keyId = 0
  for (let r = 0; r < valueGrid.length; r++) {
    const row = valueGrid[r]!
    for (let c = 0; c < row.length; c++) {
      const val = row[c]!
      if (val > 0) {
        tiles.push({ key: `static-${keyId++}`, row: r, col: c, value: val, anim: 'idle' })
      }
    }
  }
  return tiles
}

// ========== Computed display info ==========
const currentFrameActionInfo = computed(() => {
  if (!replayData.value)
    return ''
  const data = replayData.value
  if (!data.isReplaying)
    return '静态录像 (无操作记录)'
  const fi = currentFrameIndex.value
  if (fi === 0)
    return '初始局面'
  const act = data.parsedActions[fi - 1]
  if (!act)
    return ''
  const dirNames = ['左', '上', '右', '下']
  const dir = dirNames[act.action] ?? `未知(${act.action})`
  return `操作: ${fi}/${data.parsedActions.length} | 时间: ${act.time.toFixed(3)}s | 方向: ${dir}`
})

function getActionName(action: number): string {
  const names = ['左移', '上移', '右移', '下移']
  return names[action] ?? `操作${action}`
}

// ========== Lifecycle ==========
onMounted(() => {
  loadReplay()
})

onUnmounted(() => {
  stopTicker()
  cancelAnimLoop()
})

defineExpose({ replayData })
</script>

<template>
  <div class="tzfe-player">
    <div v-if="loading" class="loading">
      加载录像中...
    </div>
    <div v-else-if="errorMsg" class="error">
      {{ errorMsg }}
    </div>

    <div v-else-if="replayData" class="player-container">
      <!-- User info -->
      <div v-if="replayData.user" class="player-info">
        <UserAvatar :user="replayData.user" :size="48" class="avatar" />
        <span class="nickname">{{ replayData.user.nickName }}</span>
      </div>

      <!-- Stats panel -->
      <div class="info-panel">
        <div class="stat-item">
          <span class="stat-label">模式</span> {{ replayData.row }}x{{ replayData.column }}
        </div>
        <div class="stat-item">
          <span class="stat-label">分数:</span> {{ replayData.score }}
        </div>
        <div class="stat-item">
          <span class="stat-label">最大数:</span> {{ Math.pow(2, replayData.maxValue) }}
        </div>
        <div class="stat-item">
          <span class="stat-label">时长:</span> {{ (replayData.time / 1000).toFixed(3) }}s
        </div>
        <div class="stat-item">
          <span class="stat-label">类型:</span>
          <span :class="{ 'replay-type-dynamic': replayData.isReplaying }">
            {{ replayData.isReplaying ? '动态回放' : '静态局面' }}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">操作数:</span> {{ replayData.parsedActions.length }}
        </div>
        <div class="stat-item">
          <span class="stat-label">▷</span> {{ replayData.playCount }}
        </div>
        <div class="stat-item">
          <span class="stat-label">创建时间:</span> {{ new Date(replayData.createTime).toISOString() }}
        </div>
      </div>

      <!-- Stage times -->
      <div v-if="parsedStageTimes.length > 0" class="stage-times-panel">
        <div class="stage-label">
          阶段时间:
        </div>
        <div class="stage-list">
          <div
            v-for="(time, idx) in parsedStageTimes"
            :key="idx"
            class="stage-item"
          >
            <span class="stage-milestone">{{ Math.pow(2, idx + 5) }}</span>
            <span class="stage-time">{{ (time / 1000).toFixed(1) }}s</span>
          </div>
        </div>
      </div>

      <!-- Canvas board -->
      <div class="canvas-wrapper">
        <canvas ref="canvasRef" />
      </div>

      <!-- Controls -->
      <div v-if="replayData.isReplaying" class="controls">
        <button class="play-btn" @click="togglePlay">
          {{ isPlaying ? '⏸ 暂停' : currentTime >= totalTime ? '↺ 重播' : '▶ 播放' }}
        </button>

        <button
          class="step-btn"
          title="上一步"
          :disabled="!replayData.isReplaying"
          @click="stepFrame(-1)"
        >
          ◀
        </button>
        <button
          class="step-btn"
          title="下一步"
          :disabled="!replayData.isReplaying"
          @click="stepFrame(1)"
        >
          ▶
        </button>

        <div class="progress-bar">
          <span class="time-label">{{ currentTime.toFixed(3) }}</span>
          <input
            type="range"
            min="0"
            :max="totalTime"
            step="0.001"
            :value="currentTime"
            class="time-slider"
            @input="seek"
          >
          <span class="time-label">{{ totalTime.toFixed(3) }}</span>
        </div>

        <div class="speed-controls">
          <button
            class="speed-btn"
            title="减速"
            :disabled="playbackSpeed <= SPEED_OPTIONS[0]"
            @click="changeSpeed(-1)"
          >
            −
          </button>
          <span class="speed-label">{{ playbackSpeed }}x</span>
          <button
            class="speed-btn"
            title="加速"
            :disabled="playbackSpeed >= SPEED_OPTIONS[SPEED_OPTIONS.length - 1]"
            @click="changeSpeed(1)"
          >
            +
          </button>
        </div>
      </div>

      <!-- Current action info -->
      <div v-if="replayData.isReplaying" class="current-action">
        <strong>当前操作:</strong> {{ currentFrameActionInfo }}
      </div>

      <!-- Actions list -->
      <div
        v-if="replayData.isReplaying && replayData.parsedActions.length > 0"
        class="actions-list"
      >
        <h4>操作记录 ({{ replayData.parsedActions.length }})</h4>
        <div ref="listScrollRef" class="list-scroll">
          <div
            v-for="(act, idx) in replayData.parsedActions"
            :key="idx"
            class="action-row"
            :class="{
              active: Number(idx) < currentFrameIndex,
              current: Number(idx) === currentFrameIndex - 1,
            }"
            @click="jumpToAction(Number(idx))"
          >
            <span class="action-index">{{ Number(idx) + 1 }}.</span>
            <span class="action-time">[{{ act.time.toFixed(3) }}s]</span>
            <span class="action-dir">{{ getActionName(act.action) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tzfe-player {
  color: #ccc;
}

.loading,
.error {
  text-align: center;
  padding: 40px;
  color: #888;
}

.error {
  color: #e74c3c;
}

.player-container {
  background: #1b1b1b;
  border-radius: 12px;
  padding: 24px;
}

/* --- User info --- */
.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.nickname {
  font-size: 1.2rem;
  font-weight: 600;
  color: #f15021;
}

/* --- Info panel --- */
.info-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #252525;
  border-radius: 8px;
  font-size: 0.9rem;
}

.stat-item {
  display: flex;
  gap: 4px;
}

.stat-label {
  color: #888;
}

.replay-type-dynamic {
  color: #5d9cec;
}

/* --- Stage times --- */
.stage-times-panel {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;
  padding: 10px 16px;
  background: #252525;
  border-radius: 8px;
  font-size: 0.85rem;
}

.stage-label {
  color: #888;
  white-space: nowrap;
  line-height: 1.8;
}

.stage-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.stage-item {
  display: flex;
  gap: 4px;
}

.stage-milestone {
  color: #edc22e;
  font-weight: 600;
  min-width: 2.5em;
  text-align: right;
}

.stage-time {
  color: #aaa;
}

/* --- Canvas --- */
.canvas-wrapper {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.canvas-wrapper canvas {
  border-radius: 6px;
}

/* --- Controls --- */
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
  padding: 12px 16px;
  background: #252525;
  border-radius: 8px;
}

.play-btn {
  padding: 6px 16px;
  background: #f15021;
  color: #fff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: background 0.2s;
}

.play-btn:hover {
  background: #d9441a;
}

.step-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-btn:hover:not(:disabled) {
  background: #444;
  border-color: #f15021;
  color: #f15021;
}

.step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 150px;
}

.time-label {
  font-size: 0.8rem;
  color: #888;
  font-variant-numeric: tabular-nums;
  min-width: 5em;
}

.time-slider {
  flex: 1;
  height: 4px;
  appearance: none;
  background: #444;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.time-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f15021;
  cursor: pointer;
}

.speed-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.speed-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 700;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.speed-btn:hover:not(:disabled) {
  background: #444;
  border-color: #f15021;
  color: #f15021;
}

.speed-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.speed-label {
  font-size: 0.9rem;
  color: #f15021;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 3em;
  text-align: center;
}

/* --- Current action --- */
.current-action {
  padding: 8px 16px;
  background: #252525;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #aaa;
}

.current-action strong {
  color: #f15021;
}

/* --- Actions list --- */
.actions-list {
  margin-top: 16px;
}

.actions-list h4 {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: #aaa;
}

.list-scroll {
  max-height: 200px;
  overflow-y: auto;
  background: #1a1a1a;
  border-radius: 8px;
  padding: 4px 0;
}

.list-scroll::-webkit-scrollbar {
  width: 6px;
}

.list-scroll::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.action-row {
  display: flex;
  gap: 8px;
  padding: 4px 16px;
  font-size: 0.83rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: background 0.15s;
}

.action-row:hover {
  background: #2a2a2a;
}

.action-row.active {
  color: #888;
}

.action-row.current {
  color: #f15021;
  background: rgba(241, 80, 33, 0.12);
  font-weight: 600;
}

.action-index {
  min-width: 3em;
  text-align: right;
  color: #666;
}

.action-time {
  color: #888;
}

.action-dir {
  color: #ccc;
}

.action-row.current .action-index,
.action-row.current .action-time,
.action-row.current .action-dir {
  color: inherit;
}

@media (max-width: 768px) {
  .player-container {
    padding: 12px;
  }

  .controls {
    gap: 8px;
    padding: 10px 12px;
  }

  .info-panel {
    font-size: 0.8rem;
  }

  canvas {
    max-width: 100%;
    height: auto;
  }
}
</style>
