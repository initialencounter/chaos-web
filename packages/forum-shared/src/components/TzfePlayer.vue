<script setup lang="ts">
import type { TzfeActionRecord, TzfeRecordGetResponse } from '@tapsss/shared'
import {
  applyMoves,
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
const api = useForumApi()

type TzfeData = TzfeRecordGetResponse['data']
type Grid = number[][]

interface PlayData extends TzfeData {
  parsedActions: TzfeActionRecord[]
  boardSnapshots: Grid[]
  isReplaying: boolean
}

const loading = ref(true)
const errorMsg = ref('')
const replayData = shallowRef<PlayData | null>(null)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = shallowRef<CanvasRenderingContext2D | null>(null)

// Playback state
const isPlaying = ref(false)
const currentTime = ref(0)
const playbackSpeed = ref(1.0)
const totalTime = ref(0)

const cellSize = ref(100)
const BOARD_GAP = 8

// Speed control
const SPEED_OPTIONS = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0]

// Web Audio API
let audioCtx: AudioContext | null = null
let openBuffer: AudioBuffer | null = null

let mixedAudioBuffer: AudioBuffer | null = null
let audioSourceNode: AudioBufferSourceNode | null = null
let audioNodeStartedAt = 0
let audioNodeOffset = 0

let rafId: number | null = null
let lastRenderedFrameIndex = -1

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
  // At time 0 or below, always show beginMap (first action may have time=0)
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

function cloneGrid(grid: Grid): Grid {
  return grid.map(row => [...row])
}

// ========== Game simulation ==========

/**
 * 模拟完整的 TZFE 游戏过程，生成每步的棋盘快照。
 *
 * 与 Java 端完全对齐：
 * - beginMap 中的格值是指数表示（0=空, 1=2, 2=4, ...），与 Java TZFECell.g() 一致
 * - API 回放记录总是从新游戏开始，因此 seedCount=0（无需 skip 初始 RNG 调用）
 * - 初始棋盘由 Java 端 TZFEUtil.a() 使用无种子 Random 生成，
 *   因此 beginMap 中已包含初始局面，直接作为 initialGrid 传入
 */
function computeBoardSnapshots(
  seed: number,
  size: number,
  beginMapStr: string | null,
  actions: TzfeActionRecord[],
  finalMapStr: string,
): { snapshots: Grid[], initialCount: number } | null {
  const finalExpGrid = parseMapToGrid(finalMapStr)
  const finalGrid = exponentGridToValues(finalExpGrid)

  let beginExpGrid: Grid
  if (beginMapStr) {
    beginExpGrid = parseMapToGrid(beginMapStr)
  }
  else {
    beginExpGrid = Array.from({ length: size }, () =>
      Array.from<number>({ length: size }).fill(0)) as Grid
  }

  // API 回放记录总是从新游戏开始，seedCount=0
  const initialCount = 0

  try {
    // 将指数格值的 beginMap 直接作为 initialGrid 传入
    // （初始方块由 Java 端无种子 RNG 生成，不消耗游戏 RNG）
    let state = createState(BigInt(seed), [], size, initialCount, beginExpGrid)
    const snapshots: Grid[] = [exponentGridToValues(cloneGrid(state.grid))]

    for (const act of actions) {
      state = applyMoves(state, [act.action])
      snapshots.push(exponentGridToValues(cloneGrid(state.grid)))
    }

    const lastSnapshot = snapshots[snapshots.length - 1]!
    if (!gridsEqual(lastSnapshot, finalGrid)) {
      errorMsg.value = '录像数据异常：模拟结果与记录的最终局面不符'
      console.warn('[TzfePlayer] Simulation final board does not match recorded final board')
      return null
    }
    return { snapshots, initialCount }
  }
  catch {
    // fall through to failure
  }

  console.warn('[TzfePlayer] Simulation failed')
  return null
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
  audioNodeStartedAt = audioCtx.currentTime
  audioNodeOffset = offset
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

function drawFrame() {
  if (!ctx.value)
    return
  const data = replayData.value
  if (!data)
    return

  const fi = currentFrameIndex.value
  if (fi === lastRenderedFrameIndex)
    return
  lastRenderedFrameIndex = fi

  const g = ctx.value
  const rows = data.row
  const cols = data.column
  const cs = cellSize.value
  const gap = BOARD_GAP

  // Clear with board background
  g.fillStyle = '#bbada0'
  g.fillRect(0, 0, g.canvas.width, g.canvas.height)

  // Get current board snapshot
  const board = data.boardSnapshots[fi]!
  const borderRadius = Math.max(2, Math.floor(cs * 0.06))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = board[r]![c]!
      const exp = value === 0 ? 0 : Math.log2(value)
      const x = gap + c * (cs + gap)
      const y = gap + r * (cs + gap)
      const { bg, fg } = getTileColor(exp)

      g.fillStyle = bg
      drawRoundRect(g, x, y, cs, cs, borderRadius)
      g.fill()

      if (value > 0) {
        g.fillStyle = fg
        let fontSize: number
        if (value < 100) {
          fontSize = cs * 0.45
        }
        else if (value < 1000) {
          fontSize = cs * 0.35
        }
        else if (value < 10000) {
          fontSize = cs * 0.28
        }
        else {
          fontSize = cs * 0.22
        }
        g.font = `bold ${fontSize}px Arial, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(String(value), x + cs / 2, y + cs / 2)
      }
    }
  }
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

  drawFrame()
}

// ========== Playback controls ==========
function tick() {
  if (!isPlaying.value || !audioCtx)
    return

  const audioElapsed = audioCtx.currentTime - audioNodeStartedAt
  currentTime.value = audioNodeOffset + audioElapsed * playbackSpeed.value

  if (currentTime.value >= totalTime.value) {
    currentTime.value = totalTime.value
    isPlaying.value = false
    stopTicker()
  }
  drawFrame()
}

function startTicker() {
  stopTicker()
  startAudioPlayback(currentTime.value, playbackSpeed.value)
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
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume()
  }
  if (currentTime.value >= totalTime.value) {
    currentTime.value = 0
    lastRenderedFrameIndex = -1
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
  lastRenderedFrameIndex = -1
  if (isPlaying.value) {
    startAudioPlayback(currentTime.value, playbackSpeed.value)
  }
  else {
    drawFrame()
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
    // Edge case: action at time=0 would be treated as "before first action"
    // by currentFrameIndex's <=0 guard; bump to a tiny positive value
    if (currentTime.value === 0) {
      currentTime.value = Number.EPSILON
    }
  }

  isPlaying.value = false
  stopTicker()
  lastRenderedFrameIndex = -1
  drawFrame()
}

function jumpToAction(idx: number) {
  const data = replayData.value
  if (!data)
    return
  currentTime.value = data.parsedActions[idx]?.time ?? 0
  // Edge case: action at time=0 would be treated as "before first action"
  // by currentFrameIndex's <=0 guard; bump to a tiny positive value
  if (currentTime.value === 0) {
    currentTime.value = Number.EPSILON
  }
  isPlaying.value = false
  stopTicker()
  lastRenderedFrameIndex = -1
  drawFrame()
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

    const cached = await getCachedRecord<TzfeRecordGetResponse>('tzfe', recordIdNum)
    const res: TzfeRecordGetResponse = cached ?? await api.tzfeRecordGet(recordIdNum)
    if (!cached && res.code === 200) {
      cacheRecord('tzfe', recordIdNum, res)
    }

    if (res.code === 200 && res.data) {
      const data = res.data
      let isReplaying = data.actions != null && data.actions !== ''
      let parsedActions: TzfeActionRecord[] = []
      let boardSnapshots: Grid[] = []

      if (isReplaying) {
        console.warn('[TzfePlayer] Loaded replay data:', data)
        parsedActions = parseTzfeReplayHandle(data.actions!)
        console.warn('[TzfePlayer] Parsed actions:', parsedActions)
        console.warn('[TzfePlayer] parsedActions count:', parsedActions.length)

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
          console.warn('[TzfePlayer] Simulation OK — initialCount:', result.initialCount, 'snapshots:', result.snapshots.length)
        }
        else {
          // Fallback: show beginMap and final map without simulation
          console.warn('[TzfePlayer] Simulation failed — falling back to static display')
          const beginExpGrid = data.beginMap ? parseMapToGrid(data.beginMap) : undefined
          const finalExpGrid = parseMapToGrid(data.map)
          boardSnapshots = beginExpGrid
            ? [exponentGridToValues(beginExpGrid), exponentGridToValues(finalExpGrid)]
            : [exponentGridToValues(finalExpGrid)]
          parsedActions = []
          isReplaying = false
        }
      }
      else {
        // Static replay
        boardSnapshots = [exponentGridToValues(parseMapToGrid(data.map))]
      }

      replayData.value = {
        ...data,
        parsedActions,
        boardSnapshots,
        isReplaying,
      }

      totalTime.value = data.time / 1000
      cellSize.value = Math.min(
        120,
        Math.floor(500 / Math.max(data.row, data.column)),
      )

      loading.value = false
      await initAudio()
      if (isReplaying) {
        await renderAudioTrack()
      }
      await nextTick()
      initCanvas()
    }
    else {
      errorMsg.value = res.msg || '无法获取录像数据'
    }
  }
  catch (error: any) {
    console.error(error)
    errorMsg.value = error.message || '加载失败'
  }
  finally {
    loading.value = false
  }
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
  loadReplay().then(() => {
    drawFrame()
  })
})

onUnmounted(() => {
  stopTicker()
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
          <span class="stat-label">尺寸:</span> {{ replayData.row }}x{{ replayData.column }}
        </div>
        <div class="stat-item">
          <span class="stat-label">分数:</span> {{ replayData.score }}
        </div>
        <div class="stat-item">
          <span class="stat-label">最大值:</span> {{ Math.pow(2, replayData.maxValue) }}
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
          <span class="stat-label">游玩次数:</span> {{ replayData.playCount }}
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
            <span class="stage-milestone">{{ Math.pow(2, idx + 2) }}</span>
            <span class="stage-time">{{ (time / 1000).toFixed(1) }}s</span>
          </div>
        </div>
      </div>

      <!-- Canvas -->
      <div class="canvas-wrapper">
        <canvas ref="canvasRef" />
      </div>

      <!-- Controls -->
      <div class="controls">
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
      <div class="current-action">
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
