<script setup lang="ts">
import type {
  ActionRecord,
  RecordGetResponse,
  ReplyData,
} from '@tapsss/shared'
import { cacheRecord, getCachedRecord, parseReplayHandle } from '@tapsss/shared/utils'
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

interface Cell {
  id: number
  isFlagged: boolean
  isMine: boolean
  isOpen: boolean
  mines: number // 0-8 for number of adjacent mines, 9 for mine
}

interface Minefeild {
  width: number
  height: number
  cells: number
  mines: number
  cell: Cell[]
}

const replayData = shallowRef<ReplyData | null>(null)
const totalTime = ref(0)
let actionEffective: boolean[] = []

// Web Audio API: pre-decode + OfflineAudioContext bake complete audio track
let audioCtx: AudioContext | null = null
let openBuffer: AudioBuffer | null = null
let flagBuffer: AudioBuffer | null = null

// Pre-mixed full audio track + playback control
let mixedAudioBuffer: AudioBuffer | null = null
let audioSourceNode: AudioBufferSourceNode | null = null
let audioNodeStartedAt = 0
let audioNodeOffset = 0

async function initAudio() {
  audioCtx = new AudioContext()
  const [openResp, flagResp] = await Promise.all([
    fetch('./audio/open.mp3'),
    fetch('./audio/flag.mp3'),
  ])
  const [openData, flagData] = await Promise.all([
    openResp.arrayBuffer(),
    flagResp.arrayBuffer(),
  ]);
  [openBuffer, flagBuffer] = await Promise.all([
    audioCtx.decodeAudioData(openData),
    audioCtx.decodeAudioData(flagData),
  ])
}

// Offline render: bake all action sounds into one complete track
async function renderAudioTrack() {
  if (!audioCtx || !openBuffer || !flagBuffer)
    return
  const data = replayData.value
  if (!data)
    return
  const actions = data.actions as ActionRecord[]
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
    const buf = act.action === 0 ? openBuffer : flagBuffer
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
const ctx = shallowRef<CanvasRenderingContext2D | null>(null)

// Playback state
const isPlaying = ref(false)
const currentTime = ref(0)
const playbackSpeed = ref(1.0)

const cellSize = 20

let rafId: number | null = null

// Image resources
const skinUrls = [
  './themes/wom/type0.png',
  './themes/wom/type1.png',
  './themes/wom/type2.png',
  './themes/wom/type3.png',
  './themes/wom/type4.png',
  './themes/wom/type5.png',
  './themes/wom/type6.png',
  './themes/wom/type7.png',
  './themes/wom/type8.png',
  './themes/wom/type9.png',
  './themes/wom/closed.png', // 10
  './themes/wom/flag.png', // 11
  './themes/wom/cursor-arrow.png', // 12
]
const loadedImages: Record<number, HTMLImageElement> = {}

// Pre-computed frame states: frameStates[0] = initial (all closed), frameStates[i] = after i-th action
let frameStates: Uint8Array[] = []

// Pre-rendered frames stored in off-screen canvases (space for time)
let preRenderedFrames: HTMLCanvasElement[] = []

const currentFrameIndex = computed(() => {
  if (!replayData.value)
    return 0
  const actions = replayData.value.actions as ActionRecord[]
  // Binary search: find last action with time <= currentTime
  let lo = 0
  let hi = actions.length - 1
  let result = 0 // 0 = initial state (no actions)
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (actions[mid]!.time <= currentTime.value) {
      result = mid + 1 // frameStates[mid+1] is after action[mid]
      lo = mid + 1
    }
    else {
      hi = mid - 1
    }
  }
  return result
})

// Fetch data
async function loadReplay() {
  try {
    loading.value = true
    errorMsg.value = ''
    const recordIdNum = Number(props.recordId)
    const cached = await getCachedRecord<RecordGetResponse>('minesweeper', recordIdNum)
    const res: RecordGetResponse = cached ?? await api.minesweeperRecordGet(recordIdNum)
    if (!cached && res.code === 200) {
      cacheRecord('minesweeper', recordIdNum, res)
    }

    if (res.code === 200 && res.data) {
      if (res.data.handle) {
        // The endpoint returns JSON containing map, row, column, etc.
        const parsedActions = parseReplayHandle(res.data.handle)
        // Inject actions back into data object
        const replayDataValue = res.data;
        (replayDataValue as any).actions = parsedActions
        replayData.value = replayDataValue as ReplyData

        totalTime.value = res.data.time / 1000
        loading.value = false // close loading first, let canvas enter DOM
        precomputeStates()
        await initAudio()
        await renderAudioTrack()
        await nextTick() // ensure Vue finished DOM rendering, canvas element mounted
        await preloadImages()
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

  const mapStr = data.map.replace(/-/g, '')
  const rows = data.row
  const cols = data.column
  const actions = data.actions as ActionRecord[]

  const minefeild: Minefeild = {
    width: cols,
    height: rows,
    cells: rows * cols,
    mines: data.mine,
    cell: [],
  }

  for (let i = 0; i < rows * cols; i++) {
    minefeild.cell.push({
      id: i,
      isFlagged: false,
      isMine: mapStr[i] === '9',
      isOpen: false,
      mines: Number.parseInt(mapStr[i] ?? '0'),
    })
  }

  const reveal = (state: Uint8Array, r: number, c: number) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols)
      return
    const idx = r * cols + c
    if (state[idx] !== 10)
      return // only reveal unflagged closed cells
    const cellValue = Number.parseInt(mapStr[idx] ?? '0')
    state[idx] = cellValue
    minefeild.cell[idx]!.isOpen = true
    if (cellValue === 0) {
      minefeild.cell[idx]!.isOpen = true
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0)
            continue
          if (r + dr < 0 || r + dr >= rows || c + dc < 0 || c + dc >= cols)
            continue
          reveal(state, r + dr, c + dc)
        }
      }
    }
  }

  // Initial state: all closed
  const initial = new Uint8Array(rows * cols)
  initial.fill(10)
  frameStates = [initial]
  actionEffective = []

  for (let i = 0; i < actions.length; i++) {
    const prev = frameStates[i]!
    const state = new Uint8Array(prev) // copy previous frame
    const act = actions[i]!
    const c = act.column - 1
    const r = act.row - 1

    const idx = r * cols + c
    const cell = minefeild.cell[idx]!

    if (cell.isOpen) {
      // Already opened number cell: if all mines flagged around, chord-open surroundings
      const minesAround = cell.mines
      let flaggedAround = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0)
            continue
          const nr = r + dr
          const nc = c + dc
          const nidx = nr * cols + nc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
            continue
          if (minefeild.cell[nidx]?.isFlagged)
            flaggedAround++
        }
      }
      if (flaggedAround === minesAround) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0)
              continue
            const nr = r + dr
            const nc = c + dc
            reveal(state, nr, nc)
          }
        }
      }
    }
    else {
      if (act.action === 0) {
        // Left click: reveal cell
        reveal(state, r, c)
      }
      else {
        // Right click: toggle flag
        minefeild.cell[idx]!.isFlagged = !minefeild.cell[idx]!.isFlagged
        state[idx] = minefeild.cell[idx]!.isFlagged ? 11 : 10
      }
    }
    frameStates.push(state)

    // Compare before/after state to mark action effectiveness
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

async function preloadImages() {
  const promises = skinUrls.map((url, i) => {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      img.onload = () => {
        loadedImages[i] = img
        resolve()
      }
      img.onerror = () => {
        resolve() // ignore failures
      }
    })
  })
  await Promise.all(promises)
}

function initCanvas() {
  const canvas = canvasRef.value
  const data = replayData.value
  if (!canvas || !data)
    return

  ctx.value = canvas.getContext('2d')

  canvas.width = data.column * cellSize
  canvas.height = data.row * cellSize

  // Convert pre-computed frameStates to preRenderedFrames
  preRenderFramesToCache()

  drawFrame()
}

function preRenderFramesToCache() {
  const data = replayData.value
  if (!data)
    return

  const rows = data.row
  const cols = data.column

  preRenderedFrames = frameStates.map((state) => {
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = cols * cellSize
    frameCanvas.height = rows * cellSize
    const fCtx = frameCanvas.getContext('2d')!

    let index = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellValue = state[index]!
        const cellImg = loadedImages[cellValue]
        if (cellImg) {
          fCtx.drawImage(
            cellImg,
            c * cellSize,
            r * cellSize,
            cellSize,
            cellSize,
          )
        }
        else {
          fCtx.fillStyle
            = cellValue === 10
              ? '#cccccc'
              : cellValue === 11
                ? 'blue'
                : cellValue === 9
                  ? '#ff0000'
                  : '#888888'
          fCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
          fCtx.strokeStyle = '#999'
          fCtx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize)
        }
        index++
      }
    }
    return frameCanvas
  })
}

function drawFrame() {
  if (!ctx.value || preRenderedFrames.length === 0)
    return
  const data = replayData.value
  if (!data)
    return

  const fi = currentFrameIndex.value
  const g = ctx.value

  // Draw pre-rendered grid frame directly to main canvas
  g.drawImage(preRenderedFrames[fi]!, 0, 0)

  // Draw cursor overlay
  drawMotions()
}

function drawMotions() {
  const data = replayData.value
  if (!ctx.value || !data)
    return

  const fi = currentFrameIndex.value
  if (fi === 0)
    return

  const currentAction = data.actions[fi - 1]
  if (!currentAction)
    return
  let x = (currentAction.column - 1) * cellSize
  let y = (currentAction.row - 1) * cellSize

  // Linear interpolation for smooth mouse movement
  if (fi < data.actions.length) {
    const nextAction = data.actions[fi]
    if (!nextAction)
      return
    const timeDiff = nextAction.time - currentAction.time
    if (timeDiff > 0) {
      let progress = (currentTime.value - currentAction.time) / timeDiff
      progress = Math.max(0, Math.min(1, progress))

      const nextX = (nextAction.column - 1) * cellSize
      const nextY = (nextAction.row - 1) * cellSize

      x = x + (nextX - x) * progress
      y = y + (nextY - y) * progress
    }
  }

  ctx.value!.drawImage(loadedImages[12]!, x, y, 14, 20)
}

function tick() {
  if (!isPlaying.value || !audioCtx)
    return

  // Derive game time from audio clock — audio/video from same source, zero latency
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

onMounted(() => {
  loadReplay().then(() => {
    drawFrame()
  })
})

onUnmounted(() => {
  stopTicker()
})

const currentFrameActionInfo = computed(() => {
  if (!replayData.value)
    return ''
  const fi = currentFrameIndex.value
  if (fi === 0)
    return '无操作'
  const act = replayData.value.actions[fi - 1]
  if (!act)
    return ''
  const actionName
    = act.action === 0 ? '左键' : act.action === 1 ? '双击' : '右键'
  return `帧: ${fi}/${frameStates.length - 1} | 时间: ${act.time.toFixed(3)}s | 坐标: (${act.column}, ${act.row}) | ${actionName}`
})

defineExpose({ replayData })
</script>

<template>
  <div class="minesweeper-player">
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
          <span>3BV: </span>{{ replayData.bv }}
        </div>
        <div class="stat-item">
          <span>3BV/s: </span>{{ replayData.bvs.toFixed(3) }}
        </div>
        <div class="stat-item">
          <span>点击数: </span>{{ replayData.effectiveTap }} /
          {{ replayData.tap }}
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
        <h3>操作记录 ({{ replayData.actions.length }}，最近操作着重高亮)</h3>
        <div class="list-scroll">
          <div
            v-for="(act, idx) in replayData.actions"
            :key="idx"
            class="action-row" :class="[
              { active: Number(idx) < currentFrameIndex },
              { current: Number(idx) === currentFrameIndex - 1 },
            ]"
            @click="jumpToAction(Number(idx))"
          >
            {{ Number(idx) + 1 }}. [{{ act.time.toFixed(3) }}s] 坐标: ({{
              act.column
            }}, {{ act.row }})
            {{ act.action === 0 ? "左键" : act.action === 1 ? "双击" : "右键" }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.minesweeper-player {
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
  border: 2px solid #b6ccd2;
}

.nickname {
  font-size: 1.2rem;
  font-weight: bold;
  color: #fa7299;
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
  display: flex;
  justify-content: center;
  background: #b6ccd2;
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
  background: #fa7299;
  border: none;
  color: #fff;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
}
.play-btn:hover {
  background: #f05a81;
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
  color: #fa7299;
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
  background: rgba(250, 114, 153, 0.4);
  color: #fff;
  font-weight: bold;
}
</style>
