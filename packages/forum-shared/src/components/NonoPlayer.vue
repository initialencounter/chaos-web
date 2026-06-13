<script setup lang="ts">
import type { ActionRecord, ApiResponse, NonoRecordGetData } from '@tapsss/shared'
import { cacheRecord, getCachedRecord, parseNonoReplayHandle } from '@tapsss/shared/utils'
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

const props = defineProps<{
  recordId: string
}>()
const api = useForumApi()

// State encoding: 0=closed+unmarked, 1=marked, 2=opened, 3=slide-highlight
const STATE_CLOSED = 0
const STATE_MARKED = 1
const STATE_OPENED = 2
const STATE_SLIDING = 3

interface PlayData extends NonoRecordGetData {
  actions: ActionRecord[]
}

type NonoRecordGetResponse = ApiResponse<NonoRecordGetData>

const replayData = shallowRef<PlayData | null>(null)
const totalTime = ref(0)
let actionEffective: boolean[] = []

// Web Audio API
let audioCtx: AudioContext | null = null
let openBuffer: AudioBuffer | null = null
let flagBuffer: AudioBuffer | null = null

// Pre-mixed audio track
let mixedAudioBuffer: AudioBuffer | null = null
let audioSourceNode: AudioBufferSourceNode | null = null
let audioNodeStartedAt = 0
let audioNodeOffset = 0

// Row/column hints
let rowHints: number[][] = []
let colHints: number[][] = []
let maxRowHintCount = 0
let maxColHintCount = 0

async function initAudio() {
  audioCtx = new AudioContext()
  const [openResp, flagResp] = await Promise.all([
    fetch('./audio/open.mp3'),
    fetch('./audio/flag.mp3'),
  ])
  const [openData, flagData] = await Promise.all([
    openResp.arrayBuffer(),
    flagResp.arrayBuffer(),
  ])
  ;[openBuffer, flagBuffer] = await Promise.all([
    audioCtx.decodeAudioData(openData),
    audioCtx.decodeAudioData(flagData),
  ])
}

async function renderAudioTrack() {
  if (!audioCtx || !openBuffer || !flagBuffer)
    return
  const data = replayData.value
  if (!data)
    return
  const actions = data.actions
  const sr = audioCtx.sampleRate
  const pad = Math.max(openBuffer.duration, flagBuffer.duration) + 0.1
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil((totalTime.value + pad) * sr),
    sr,
  )
  for (let i = 0; i < actions.length; i++) {
    if (!actionEffective[i])
      continue
    const act = actions[i]!
    // Slide: only first action (4) plays sound; mid (5) and end (6,7) silent
    if (act.action === 5 || act.action === 6 || act.action === 7)
      continue
    const buf = act.action === 4 ? flagBuffer : (act.action === 0 ? openBuffer : flagBuffer)
    const source = offlineCtx.createBufferSource()
    source.buffer = buf
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
    catch {}
    audioSourceNode.disconnect()
    audioSourceNode = null
  }
}

const loading = ref(true)
const errorMsg = ref('')

const canvasRef = ref<HTMLCanvasElement | null>(null)
const listScrollRef = ref<HTMLDivElement | null>(null)
const ctx = shallowRef<CanvasRenderingContext2D | null>(null)

const isPlaying = ref(false)
const currentTime = ref(0)
const playbackSpeed = ref(1.0)

const cellSize = 24
let hintMarginLeft = 0
let hintMarginTop = 0

let rafId: number | null = null

// Pre-computed frame states
let frameStates: Uint8Array[] = []
// Pre-rendered offscreen canvases
let preRenderedFrames: HTMLCanvasElement[] = []
// Map string (dash-removed) for lookup during pre-render
let mapStr: string = ''

const currentFrameIndex = computed(() => {
  if (!replayData.value)
    return 0
  const actions = replayData.value.actions
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

function computeHints(map: string, rows: number, cols: number) {
  const cleanMap = map.replace(/-/g, '')
  mapStr = cleanMap

  // Row hints: for each row, count consecutive mines (9)
  rowHints = []
  maxRowHintCount = 0
  for (let r = 0; r < rows; r++) {
    const hints: number[] = []
    let count = 0
    for (let c = 0; c < cols; c++) {
      if (cleanMap[r * cols + c] === '9') {
        count++
      }
      else if (count > 0) {
        hints.push(count)
        count = 0
      }
    }
    if (count > 0)
      hints.push(count)
    rowHints.push(hints)
    if (hints.length > maxRowHintCount)
      maxRowHintCount = hints.length
  }

  // Column hints: for each column, count consecutive mines (9)
  colHints = []
  maxColHintCount = 0
  for (let c = 0; c < cols; c++) {
    const hints: number[] = []
    let count = 0
    for (let r = 0; r < rows; r++) {
      if (cleanMap[r * cols + c] === '9') {
        count++
      }
      else if (count > 0) {
        hints.push(count)
        count = 0
      }
    }
    if (count > 0)
      hints.push(count)
    colHints.push(hints)
    if (hints.length > maxColHintCount)
      maxColHintCount = hints.length
  }

  hintMarginLeft = maxRowHintCount * cellSize
  hintMarginTop = maxColHintCount * cellSize
}

async function loadReplay() {
  try {
    loading.value = true
    errorMsg.value = ''
    const recordIdNum = Number(props.recordId)
    const cached = await getCachedRecord<NonoRecordGetResponse>('nonosweeper', recordIdNum)
    const res: NonoRecordGetResponse = cached ?? await api.nonoRecordGet(recordIdNum)
    if (!cached && res.code === 200) {
      cacheRecord('nonosweeper', recordIdNum, res)
    }

    if (res.code === 200 && res.data) {
      if (res.data.handle) {
        const parsedActions = parseNonoReplayHandle(res.data.handle)
        const replayDataValue = res.data as PlayData
        replayDataValue.actions = parsedActions
        replayData.value = replayDataValue

        totalTime.value = res.data.time / 1000
        loading.value = false
        computeHints(res.data.map, res.data.row, res.data.column)
        precomputeStates()
        await initAudio()
        await renderAudioTrack()
        await nextTick()
        preRenderFramesToCache()
        initCanvas()
      }
      else {
        errorMsg.value = '录像内容为空'
      }
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

function precomputeStates() {
  const data = replayData.value
  if (!data)
    return

  const rows = data.row
  const cols = data.column
  const actions = data.actions

  // Initial state: all closed
  const initial = new Uint8Array(rows * cols)
  initial.fill(STATE_CLOSED)
  frameStates = [initial]
  actionEffective = []

  for (let i = 0; i < actions.length; i++) {
    const prev = frameStates[i]!
    const state = new Uint8Array(prev)
    const act = actions[i]!
    // parseNonoReplayHandle returns 0-based row/col
    const r = act.row
    const c = act.column

    if (act.action === 0) {
      // Single open
      const idx = r * cols + c
      if (idx >= 0 && idx < rows * cols)
        state[idx] = STATE_OPENED
    }
    else if (act.action === 1) {
      // Single toggle mark
      const idx = r * cols + c
      if (idx >= 0 && idx < rows * cols)
        state[idx] = state[idx] === STATE_MARKED ? STATE_CLOSED : STATE_MARKED
    }
    else if (act.action === 4) {
      // Slide start: highlight cell (resolved at slide end)
      const idx = r * cols + c
      if (idx >= 0 && idx < rows * cols)
        state[idx] = STATE_SLIDING
    }
    else if (act.action === 5) {
      // Slide middle: highlight cell (resolved at slide end)
      const idx = r * cols + c
      if (idx >= 0 && idx < rows * cols)
        state[idx] = STATE_SLIDING
    }
    else if (act.action === 6 || act.action === 7) {
      // Slide end: resolve the slide
      // Walk backward to find matching action=4
      let slideStart = i
      while (slideStart >= 0 && actions[slideStart]!.action !== 4) {
        slideStart--
      }
      if (slideStart >= 0) {
        // Collect all cells from slide start through current action
        const slideCells: Array<{ r: number, c: number }> = []
        for (let k = slideStart; k <= i; k++) {
          const a = actions[k]!
          slideCells.push({ r: a.row, c: a.column })
        }

        if (act.action === 6) {
          // Slide-open: set all to opened
          for (const cell of slideCells) {
            const idx = cell.r * cols + cell.c
            if (idx >= 0 && idx < rows * cols)
              state[idx] = STATE_OPENED
          }
        }
        else {
          // act.action === 7: Slide-mark/unmark
          // Use pre-slide state (prev frame) to decide: if first cell was
          // unmarked → mark all; if marked → unmark all
          const firstCell = slideCells[0]!
          const firstIdx = firstCell.r * cols + firstCell.c
          const targetState = prev[firstIdx] === STATE_MARKED ? STATE_CLOSED : STATE_MARKED
          for (const cell of slideCells) {
            const idx = cell.r * cols + cell.c
            if (idx >= 0 && idx < rows * cols)
              state[idx] = targetState
          }
        }
      }
    }

    frameStates.push(state)

    // Check if action was effective
    let effective = false
    for (let j = 0; j < state.length; j++) {
      if (state[j] !== prev[j]) {
        effective = true
        break
      }
    }
    actionEffective.push(effective)
  }
}

function initCanvas() {
  const canvas = canvasRef.value
  const data = replayData.value
  if (!canvas || !data)
    return

  ctx.value = canvas.getContext('2d')

  canvas.width = hintMarginLeft + data.column * cellSize
  canvas.height = hintMarginTop + data.row * cellSize

  drawFrame()
}

// Colors
const COLOR_CLOSED = '#FFF9C4' // light yellow
const COLOR_MARKED = '#FFD600' // yellow
const COLOR_OPENED_EMPTY = '#E0E0E0' // light gray
const COLOR_OPENED_MINE = '#FF1744' // red
const COLOR_SLIDING = '#9E9E9E' // gray — slide highlight
const COLOR_GRID_LINE = '#BDBDBD'
const COLOR_HINT_TEXT = '#333333'
const COLOR_BG = '#F5F5F5'

function preRenderFramesToCache() {
  const data = replayData.value
  if (!data)
    return

  const rows = data.row
  const cols = data.column
  const fullW = hintMarginLeft + cols * cellSize
  const fullH = hintMarginTop + rows * cellSize

  preRenderedFrames = frameStates.map((state) => {
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = fullW
    frameCanvas.height = fullH
    const fCtx = frameCanvas.getContext('2d')!

    // Draw background
    fCtx.fillStyle = COLOR_BG
    fCtx.fillRect(0, 0, fullW, fullH)

    // Draw row hints
    fCtx.fillStyle = COLOR_HINT_TEXT
    fCtx.font = `bold ${Math.round(cellSize * 0.65)}px monospace`
    fCtx.textAlign = 'right'
    fCtx.textBaseline = 'middle'
    for (let r = 0; r < rows; r++) {
      const hints = rowHints[r]!
      for (let hi = 0; hi < hints.length; hi++) {
        const x = Math.round(hintMarginLeft - (hints.length - hi) * cellSize + cellSize / 2)
        const y = Math.round(hintMarginTop + r * cellSize + cellSize / 2)
        fCtx.fillText(String(hints[hi]), x, y)
      }
    }

    // Draw column hints
    fCtx.textAlign = 'center'
    fCtx.textBaseline = 'bottom'
    for (let c = 0; c < cols; c++) {
      const hints = colHints[c]!
      for (let hi = 0; hi < hints.length; hi++) {
        const x = Math.round(hintMarginLeft + c * cellSize + cellSize / 2)
        const y = Math.round(hintMarginTop - (hints.length - hi) * cellSize + cellSize / 2)
        fCtx.fillText(String(hints[hi]), x, y)
      }
    }

    // Draw cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const cellState = state[idx]!
        const x = hintMarginLeft + c * cellSize
        const y = hintMarginTop + r * cellSize

        let fillColor: string
        if (cellState === STATE_CLOSED) {
          fillColor = COLOR_CLOSED
        }
        else if (cellState === STATE_MARKED) {
          fillColor = COLOR_MARKED
        }
        else if (cellState === STATE_SLIDING) {
          fillColor = COLOR_SLIDING
        }
        else {
          // STATE_OPENED
          fillColor = mapStr[idx] === '9' ? COLOR_OPENED_MINE : COLOR_OPENED_EMPTY
        }

        fCtx.fillStyle = fillColor
        fCtx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2)

        // Grid line
        fCtx.strokeStyle = COLOR_GRID_LINE
        fCtx.lineWidth = 0.5
        fCtx.strokeRect(x, y, cellSize, cellSize)
      }
    }

    return frameCanvas
  })
}

function drawFrame() {
  if (!ctx.value || preRenderedFrames.length === 0)
    return
  if (!replayData.value)
    return

  const fi = currentFrameIndex.value
  const g = ctx.value

  g.drawImage(preRenderedFrames[fi]!, 0, 0)
}

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
  if (isPlaying.value) {
    startAudioPlayback(currentTime.value, playbackSpeed.value)
  }
  else {
    drawFrame()
  }
}

function jumpToAction(idx: number) {
  const data = replayData.value
  if (!data)
    return
  currentTime.value = data.actions[idx]?.time ?? 0
  isPlaying.value = false
  stopTicker()
  drawFrame()
}

function stepFrame(direction: number) {
  const data = replayData.value
  if (!data)
    return

  let targetIndex = currentFrameIndex.value + direction
  if (targetIndex < 0)
    targetIndex = 0
  if (targetIndex > data.actions.length)
    targetIndex = data.actions.length

  if (targetIndex === 0) {
    currentTime.value = 0
  }
  else {
    currentTime.value = data.actions[targetIndex - 1]?.time ?? 0
  }

  isPlaying.value = false
  stopTicker()
  drawFrame()
}

watch(playbackSpeed, () => {
  if (isPlaying.value) {
    startAudioPlayback(currentTime.value, playbackSpeed.value)
  }
})

// Auto-scroll action list to keep current frame visible (only inside the list, not the page)
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
  // Scroll only the list container itself, never the outer window
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

onMounted(() => {
  loadReplay().then(() => {
    drawFrame()
  })
})

onUnmounted(() => {
  stopTicker()
})

function getActionName(action: number): string {
  switch (action) {
    case 0: return '打开'
    case 1: return '标记/取消'
    case 4: return '滑动起点'
    case 5: return '滑动中'
    case 6: return '滑动打开'
    case 7: return '滑动标记'
    default: return `操作${action}`
  }
}

function getFinishModeText(mode: number): string {
  switch (mode) {
    case 0: return '完成'
    case 1: return '失败'
    default: return String(mode)
  }
}

const currentFrameActionInfo = computed(() => {
  if (!replayData.value)
    return ''
  const fi = currentFrameIndex.value
  if (fi === 0)
    return '无操作'
  const act = replayData.value.actions[fi - 1]
  if (!act)
    return ''
  const actionName = getActionName(act.action)
  return `帧: ${fi}/${frameStates.length - 1} | 时间: ${act.time.toFixed(3)}s | 坐标: (${act.column}, ${act.row}) | ${actionName}`
})

defineExpose({ replayData })
</script>

<template>
  <div class="nono-player">
    <div v-if="loading" class="loading">
      加载录像中...
    </div>
    <div v-else-if="errorMsg" class="error">
      {{ errorMsg }}
    </div>
    <div v-else-if="replayData" class="player-container">
      <!-- Player info -->
      <div v-if="replayData.user" class="player-info">
        <UserAvatar :user="replayData.user" :size="48" class="avatar" />
        <span class="nickname">{{ replayData.user.nickName }}</span>
      </div>

      <!-- Stats panel -->
      <div class="info-panel">
        <div class="stat-item">
          <span>难度: </span>{{ replayData.row }} x {{ replayData.column }} ({{
            replayData.mine
          }}雷)
        </div>
        <div class="stat-item">
          <span>时长: </span>{{ (replayData.time / 1000).toFixed(3) }}s
        </div>
        <div class="stat-item">
          <span>完成: </span>{{ getFinishModeText(replayData.finishMode) }}
        </div>
        <div class="stat-item">
          <span>游玩次数: </span>{{ replayData.playCount }}
        </div>
        <div class="stat-item">
          <span>创建时间: </span>{{ new Date(replayData.createTime).toISOString() }}
        </div>
      </div>

      <!-- Canvas render -->
      <div class="canvas-wrapper">
        <canvas ref="canvasRef" />
      </div>

      <!-- Controls -->
      <div class="controls">
        <button class="play-btn" @click="togglePlay">
          {{ isPlaying ? "暂停" : currentTime >= totalTime ? "重播" : "播放" }}
        </button>
        <button class="step-btn" title="上一帧" @click="stepFrame(-1)">
          ◀
        </button>
        <button class="step-btn" title="下一帧" @click="stepFrame(1)">
          ▶
        </button>

        <div class="progress-bar">
          <span>{{ currentTime.toFixed(3) }}</span>
          <input
            type="range"
            min="0"
            :max="totalTime"
            step="0.001"
            :value="currentTime"
            @input="seek"
          >
          <span>{{ totalTime.toFixed(3) }}</span>
        </div>

        <select v-model="playbackSpeed" class="speed-select">
          <option :value="0.5">
            0.5x
          </option>
          <option :value="1.0">
            1.0x
          </option>
          <option :value="2.0">
            2.0x
          </option>
          <option :value="5.0">
            5.0x
          </option>
        </select>
      </div>

      <!-- Current action highlight -->
      <div class="current-action">
        <strong>当前动作: </strong> {{ currentFrameActionInfo }}
      </div>

      <!-- Actions list -->
      <div class="actions-list">
        <h3>操作记录 ({{ replayData.actions.length }}，已执行操作高亮)</h3>
        <div ref="listScrollRef" class="list-scroll">
          <div
            v-for="(act, idx) in replayData.actions"
            :key="idx"
            class="action-row"
            :class="[
              { active: Number(idx) < currentFrameIndex },
              { current: Number(idx) === currentFrameIndex - 1 },
            ]"
            @click="jumpToAction(Number(idx))"
          >
            {{ Number(idx) + 1 }}. [{{ act.time.toFixed(3) }}s] 坐标: ({{
              act.column
            }}, {{ act.row }})
            {{ getActionName(act.action) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nono-player {
  background: #1b1b1b;
  border-radius: 12px;
  padding: 20px;
  color: #fff;
  max-width: 900px;
  margin: 0 auto;
}

.loading,
.error {
  text-align: center;
  padding: 40px;
  font-size: 1.2rem;
}

.error {
  color: #ff4d4d;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 15px;
  background: #2a2a2a;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ffc107;
}

.nickname {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffc107;
}

.info-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
  background: #2a2a2a;
  padding: 15px;
  border-radius: 8px;
}

.stat-item {
  font-size: 0.95rem;
}

.stat-item span {
  color: #999;
}

.canvas-wrapper {
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  justify-content: center;
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

canvas {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  image-rendering: pixelated;
}

.controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.play-btn {
  background: #ffc107;
  border: none;
  color: #1b1b1b;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
}
.play-btn:hover {
  background: #ffb300;
}

.step-btn {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.step-btn:hover {
  background: #444;
}

.progress-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar input {
  flex: 1;
  cursor: pointer;
}

.speed-select {
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
  padding: 5px 10px;
  border-radius: 5px;
}

.current-action {
  font-size: 1.1rem;
  margin-bottom: 15px;
  padding: 10px;
  background: #2a2a2a;
  border-radius: 5px;
}
.current-action strong {
  color: #ffc107;
}

.actions-list {
  background: #2a2a2a;
  padding: 15px;
  border-radius: 8px;
}
.actions-list h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1rem;
  color: #ccc;
}
.list-scroll {
  max-height: 200px;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-family: monospace;
  font-size: 0.9rem;
}
.action-row {
  padding: 5px;
  border-bottom: 1px solid #333;
  cursor: pointer;
}
.action-row:hover {
  background: rgba(255, 255, 255, 0.1);
}
.action-row.active {
  color: #aaa;
}
.action-row.current {
  background: rgba(255, 193, 7, 0.4);
  color: #fff;
  font-weight: bold;
}
</style>
