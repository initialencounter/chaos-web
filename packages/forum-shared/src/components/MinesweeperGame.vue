<script setup lang="ts">
import type { ActionRecord, TimingSuccessData } from '@tapsss/shared'
import { encodeReplayHandle } from '@tapsss/shared/utils'
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

// ==================== 类型定义 ====================
interface Cell {
  row: number
  col: number
  isMine: boolean
  isOpen: boolean
  isFlagged: boolean
  adjacentMines: number // 0-8
}

// ==================== 难度配置 ====================
interface DifficultyConfig {
  label: string
  rows: number
  cols: number
  mines: number
  level: number // 对应 recordbody 中的 level
  op: number // 对应 record 的 op 字段
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  beginner: { label: '初级', rows: 8, cols: 8, mines: 10, level: 1, op: 3 },
  intermediate: { label: '中级', rows: 16, cols: 16, mines: 40, level: 2, op: 6 },
  expert: { label: '高级', rows: 16, cols: 30, mines: 99, level: 3, op: 11 },
}

const currentDifficulty = ref<keyof typeof DIFFICULTIES>('beginner')
const config = computed(() => DIFFICULTIES[currentDifficulty.value])

// ==================== 游戏状态 ====================
type GameStatus = 'idle' | 'playing' | 'won' | 'lost'
const gameStatus = ref<GameStatus>('idle')

const cells = shallowRef<Cell[][]>([])
const actions = ref<ActionRecord[]>([]) // 操作录像
const startTime = ref(0)
const elapsedTime = ref(0)
const flagCount = ref(0)
const openedCount = ref(0)
const totalNonMineCells = computed(() => config.value.rows * config.value.cols - config.value.mines)

let timerHandle: ReturnType<typeof setInterval> | null = null

// 成绩
const resultBv = ref(0)
const resultBvs = ref(0)
const resultTap = ref(0)
const resultEffectiveTap = ref(0)
const resultTime = ref(0)

// 提交状态
const submitting = ref(false)
const submitResult = ref<{ code: number, msg: string, data?: TimingSuccessData } | null>(null)

const api = useForumApi()

// ==================== 音频 ====================
let audioCtx: AudioContext | null = null
let openBuffer: AudioBuffer | null = null
let flagBuffer: AudioBuffer | null = null

async function initAudio() {
  try {
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
  catch {
    // 音频加载失败不影响游戏
    audioCtx = null
  }
}

function playSound(buffer: AudioBuffer | null) {
  if (!audioCtx || !buffer)
    return
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  const gain = audioCtx.createGain()
  gain.gain.value = 0.5
  source.connect(gain)
  gain.connect(audioCtx.destination)
  source.start(0)
}

// ==================== Canvas 渲染 ====================
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = shallowRef<CanvasRenderingContext2D | null>(null)
const baseCellSize = 20
const zoom = ref(1.0)
const cellSize = computed(() => Math.max(8, Math.round(baseCellSize * zoom.value)))
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3.0
const ZOOM_STEP = 0.25

function zoomIn() {
  zoom.value = Math.min(ZOOM_MAX, zoom.value + ZOOM_STEP)
}

function zoomOut() {
  zoom.value = Math.max(ZOOM_MIN, zoom.value - ZOOM_STEP)
}

function resetZoom() {
  zoom.value = 1.0
}

function onCanvasWheel(e: WheelEvent) {
  if (!e.ctrlKey)
    return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom.value + delta))
}

// 缩放变化时重建画布
watch(zoom, () => {
  nextTick(() => {
    initCanvas()
    render()
  })
})

// 皮肤图片（复用与 MinesweeperPlayer 相同的资源路径）
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
]
const loadedImages: Record<number, HTMLImageElement> = {}

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
      img.onerror = () => resolve()
    })
  })
  await Promise.all(promises)
}

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  ctx.value = canvas.getContext('2d')!
  ctx.value.imageSmoothingEnabled = false
  canvas.width = config.value.cols * cellSize.value
  canvas.height = config.value.rows * cellSize.value
}

function render() {
  const canvas = canvasRef.value
  const g = ctx.value
  if (!canvas || !g)
    return

  const board = cells.value
  if (!board.length)
    return

  const cw = canvas.width
  const ch = canvas.height
  g.clearRect(0, 0, cw, ch)

  const cs = cellSize.value
  const rows = config.value.rows
  const cols = config.value.cols

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r]![c]!
      let imgIndex: number
      if (cell.isOpen) {
        if (cell.isMine) {
          imgIndex = 9 // mine
        }
        else {
          imgIndex = cell.adjacentMines // 0-8
        }
      }
      else if (cell.isFlagged) {
        imgIndex = 11 // flag
      }
      else {
        imgIndex = 10 // closed
      }

      const img = loadedImages[imgIndex]
      if (img) {
        g.drawImage(img, c * cs, r * cs, cs, cs)
      }
      else {
        // Fallback colors
        g.fillStyle
          = imgIndex === 10
            ? '#cccccc'
            : imgIndex === 11
              ? '#4488ff'
              : imgIndex === 9
                ? '#ff0000'
                : '#888888'
        g.fillRect(c * cs, r * cs, cs, cs)
        g.strokeStyle = '#999'
        g.strokeRect(c * cs, r * cs, cs, cs)
      }
    }
  }
}

// ==================== 地图生成 ====================
function generateMap(safeRow: number, safeCol: number) {
  const { rows, cols, mines } = config.value
  const total = rows * cols

  // 初始化所有格子
  const board: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    board.push([])
    for (let c = 0; c < cols; c++) {
      board[r]!.push({
        row: r,
        col: c,
        isMine: false,
        isOpen: false,
        isFlagged: false,
        adjacentMines: 0,
      })
    }
  }

  // 安全区域（首次点击位置及其周围 3×3）
  const safeSet = new Set<number>()
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeRow + dr
      const nc = safeCol + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeSet.add(nr * cols + nc)
      }
    }
  }

  // 随机布雷（排除安全区域）
  const minePositions = new Set<number>()
  const candidates: number[] = []
  for (let i = 0; i < total; i++) {
    if (!safeSet.has(i)) {
      candidates.push(i)
    }
  }

  // Fisher-Yates 部分洗牌
  for (let i = 0; i < mines && i < candidates.length; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i))
    const tmp = candidates[i]!
    candidates[i] = candidates[j]!
    candidates[j] = tmp
    minePositions.add(candidates[i]!)
  }

  // 设置地雷
  for (const pos of minePositions) {
    const r = Math.floor(pos / cols)
    const c = pos % cols
    board[r]![c]!.isMine = true
  }

  // 计算相邻地雷数
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r]![c]!.isMine)
        continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0)
            continue
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr]![nc]!.isMine) {
            count++
          }
        }
      }
      board[r]![c]!.adjacentMines = count
    }
  }

  cells.value = board
}

// ==================== 迭代翻开（栈实现，避免递归开销） ====================
function revealCell(r: number, c: number): number {
  const board = cells.value
  const { rows, cols } = config.value

  const firstCell = board[r]![c]!
  if (firstCell.isOpen || firstCell.isFlagged)
    return 0
  if (firstCell.isMine) {
    firstCell.isOpen = true
    return 1
  }

  // 迭代 DFS：用栈代替递归，一次性处理所有连通翻开
  const stack: [number, number][] = [[r, c]]
  let opened = 0

  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!
    const cell = board[cr]![cc]!
    if (cell.isOpen || cell.isFlagged)
      continue

    cell.isOpen = true
    opened++

    // 空格：将周围未翻开格子入栈
    if (cell.adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        const nr = cr + dr
        if (nr < 0 || nr >= rows)
          continue
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0)
            continue
          const nc = cc + dc
          if (nc < 0 || nc >= cols)
            continue
          const neighbor = board[nr]![nc]!
          if (!neighbor.isOpen && !neighbor.isFlagged) {
            stack.push([nr, nc])
          }
        }
      }
    }
  }

  return opened
}

// ==================== 记录操作 ====================
function recordAction(action: number, row: number, col: number) {
  actions.value.push({
    action,
    row: row + 1, // 存储为 1-indexed
    column: col + 1, // 存储为 1-indexed
    time: (Date.now() - startTime.value) / 1000, // 秒
  })
}

/** 计算有效操作数：真正改变了棋盘状态的操作 */
function computeEffectiveTap(): number {
  const board = cells.value
  const { rows, cols } = config.value

  // 读取初始 map 以重建棋盘
  // 重建一个模拟棋盘来重放操作，统计有效的
  const simulatedMap = new Uint8Array(rows * cols)
  simulatedMap.fill(10) // 10 = closed

  let effective = 0
  for (const act of actions.value) {
    const r = act.row - 1
    const c = act.column - 1
    const idx = r * cols + c

    if (act.action === 1) {
      // 标记操作总是有效（改变旗帜状态）
      simulatedMap[idx] = simulatedMap[idx] === 11 ? 10 : 11
      effective++
    }
    else {
      // 翻开操作
      const cell = board[r]![c]!
      if (cell.isMine) {
        // 踩雷也是一种状态变化
        if (simulatedMap[idx] !== 9) {
          simulatedMap[idx] = 9
          effective++
        }
      }
      else if (cell.adjacentMines > 0) {
        // 数字格翻开
        if (simulatedMap[idx] !== cell.adjacentMines) {
          simulatedMap[idx] = cell.adjacentMines
          effective++
        }
      }
      else {
        // 空格：递归翻开
        const prevCount = simulatedMap.reduce((s, v) => s + (v < 10 ? 1 : 0), 0)
        revealSimulated(simulatedMap, r, c, rows, cols, board)
        if (simulatedMap.reduce((s, v) => s + (v < 10 ? 1 : 0), 0) > prevCount) {
          effective++
        }
      }
    }
  }
  return effective
}

function revealSimulated(
  state: Uint8Array,
  r: number,
  c: number,
  rows: number,
  cols: number,
  board: Cell[][],
) {
  if (r < 0 || r >= rows || c < 0 || c >= cols)
    return
  const idx = r * cols + c
  if (state[idx]! < 10)
    return // already opened
  const cell = board[r]![c]!
  if (cell.isMine)
    return
  state[idx] = cell.adjacentMines
  if (cell.adjacentMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0)
          continue
        revealSimulated(state, r + dr, c + dc, rows, cols, board)
      }
    }
  }
}

// ==================== 检查胜利 ====================
function checkWin() {
  if (openedCount.value === totalNonMineCells.value) {
    gameStatus.value = 'won'
    stopTimer()
    computeResults()
  }
}

// ==================== 玩家操作 ====================
function handleCellClick(row: number, col: number) {
  if (gameStatus.value === 'won' || gameStatus.value === 'lost')
    return

  const cell = cells.value[row]![col]!

  // 首次点击：生成地图并开始计时
  if (gameStatus.value === 'idle') {
    generateMap(row, col)
    gameStatus.value = 'playing'
    startTime.value = Date.now()
    startTimer()
  }

  if (gameStatus.value !== 'playing')
    return

  // 点击已翻开的数字格 → Chord 操作
  if (cell.isOpen) {
    tryChord(row, col)
    return
  }

  // 已标记的不能翻开
  if (cell.isFlagged)
    return

  // 打开格子
  recordAction(0, row, col)
  const opened = revealCell(row, col)
  openedCount.value += opened

  if (cell.isMine) {
    // 踩雷，游戏结束
    gameStatus.value = 'lost'
    stopTimer()
    revealAllMines()
    playSound(openBuffer)
    render()
    return
  }

  playSound(openBuffer)
  render()
  checkWin()
}

function handleCellRightClick(row: number, col: number) {
  if (gameStatus.value !== 'playing')
    return

  const cell = cells.value[row]![col]!
  // 右键点击已翻开的数字格 → Chord 操作
  if (cell.isOpen) {
    tryChord(row, col)
    return
  }

  recordAction(1, row, col)

  cell.isFlagged = !cell.isFlagged
  flagCount.value += cell.isFlagged ? 1 : -1

  playSound(flagBuffer)
  render()
}

// Chord 操作：数字格周围旗帜数等于数字时，自动翻开周围非旗帜格
function tryChord(row: number, col: number): boolean {
  const cell = cells.value[row]![col]!
  // 必须是已翻开的数字格（非雷、非0格）
  if (!cell.isOpen || cell.isMine || cell.adjacentMines === 0)
    return false

  // 计算周围旗帜数
  let flagsAround = 0
  const toReveal: [number, number][] = []
  const { rows, cols } = config.value
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0)
        continue
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
        continue
      const neighbor = cells.value[nr]![nc]!
      if (neighbor.isFlagged) {
        flagsAround++
      }
      else if (!neighbor.isOpen) {
        toReveal.push([nr, nc])
      }
    }
  }

  if (flagsAround !== cell.adjacentMines)
    return false

  // 记录 chord 操作
  recordAction(0, row, col)

  // 翻开周围格子
  let hitMine = false
  let opened = 0
  for (const [nr, nc] of toReveal) {
    const neighbor = cells.value[nr]![nc]!
    if (neighbor.isFlagged)
      continue
    if (neighbor.isMine) {
      neighbor.isOpen = true
      opened++
      hitMine = true
    }
    else {
      opened += revealCell(nr, nc)
    }
  }
  openedCount.value += opened

  if (hitMine) {
    gameStatus.value = 'lost'
    stopTimer()
    revealAllMines()
  }

  playSound(openBuffer)
  render()
  if (!hitMine)
    checkWin()
  return true
}

function revealAllMines() {
  for (const row of cells.value) {
    for (const cell of row) {
      if (cell.isMine) {
        cell.isOpen = true
      }
    }
  }
}

// ==================== 计时器 ====================
function startTimer() {
  stopTimer()
  timerHandle = setInterval(() => {
    if (startTime.value > 0) {
      elapsedTime.value = Date.now() - startTime.value
    }
  }, 50)
}

function stopTimer() {
  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }
  if (startTime.value > 0) {
    elapsedTime.value = Date.now() - startTime.value
  }
}

// ==================== 计算成绩 ====================
function computeResults() {
  const board = cells.value
  const { rows, cols } = config.value
  resultTime.value = elapsedTime.value
  resultTap.value = actions.value.length
  resultBv.value = calculate3BV(board, rows, cols)
  resultBvs.value = resultTime.value > 0
    ? Number.parseFloat((resultBv.value / (resultTime.value / 1000)).toFixed(3))
    : 0
  resultEffectiveTap.value = computeEffectiveTap()
}

/**
 * 计算 3BV (Bechtel's Board Benchmark Value)
 * 3BV = 所有零格连通区域数 + 不与任何零格相邻的数字格数
 */
function calculate3BV(board: Cell[][], rows: number, cols: number): number {
  const visited = Array.from({ length: rows * cols }).fill(false)
  let bv = 0

  // 辅助函数：标记某个空格区域所有连通空格及其边界的数字格
  function floodZero(startR: number, startC: number) {
    const stack: [number, number][] = [[startR, startC]]
    const idx = startR * cols + startC
    visited[idx] = true

    while (stack.length > 0) {
      const [r, c] = stack.pop()!
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0)
            continue
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
            continue
          const nIdx = nr * cols + nc
          if (visited[nIdx])
            continue

          const neighbor = board[nr]![nc]!
          if (neighbor.isMine)
            continue

          visited[nIdx] = true
          if (neighbor.adjacentMines === 0) {
            stack.push([nr, nc])
          }
        }
      }
    }
  }

  // 1. 找到所有零格连通区域
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const cell = board[r]![c]!
      if (cell.isMine) {
        visited[idx] = true
        continue
      }
      if (!visited[idx] && cell.adjacentMines === 0) {
        bv++
        floodZero(r, c)
      }
    }
  }

  // 2. 计数未被零格区域覆盖的数字格（每个 = 1 BV）
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const cell = board[r]![c]!
      if (cell.isMine)
        continue
      if (!visited[idx]) {
        bv++
      }
    }
  }

  return bv
}

// ==================== 构建 map 字符串 ====================
function buildMapString(): string {
  const board = cells.value
  const { rows, cols } = config.value
  const rowStrings: string[] = []
  for (let r = 0; r < rows; r++) {
    let rowStr = ''
    for (let c = 0; c < cols; c++) {
      const cell = board[r]![c]!
      rowStr += cell.isMine ? '9' : cell.adjacentMines.toString()
    }
    rowStrings.push(rowStr)
  }
  return rowStrings.join('-')
}

// ==================== 提交录像 ====================
async function submitRecord() {
  if (submitting.value)
    return
  submitting.value = true
  submitResult.value = null

  try {
    const cfg = config.value
    const mapStr = buildMapString()
    const handle = encodeReplayHandle(actions.value)
    const timeMs = resultTime.value

    const record = {
      bv: resultBv.value,
      bvs: resultBvs.value,
      collect: false,
      column: cfg.cols,
      createTime: Date.now(),
      effectiveTap: resultEffectiveTap.value,
      estimatedTime: 0,
      finished: true,
      handle,
      id: 0,
      localId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      map: mapStr,
      mine: cfg.mines,
      mode: 1,
      op: cfg.op,
      playCount: 0,
      postId: 0,
      rank: 0,
      rankPercent: 0.0,
      row: cfg.rows,
      solvedBv: resultBv.value,
      tap: resultTap.value,
      themeId: 2411,
      time: timeMs,
      type: 2,
      uid: '',
      upload: false,
    }

    // 接口: POST /minesweeper/timing/success
    // 参数: level, record (JSON字符串), countPercent
    const res = await api.minesweeperTimingSuccess(cfg.level, JSON.stringify(record), false)
    if (res && res.code === 200 && res.data) {
      submitResult.value = { code: 200, msg: '提交成功', data: res.data }
    }
    else {
      submitResult.value = { code: res?.code ?? -1, msg: res?.msg ?? '提交失败' }
    }
  }
  catch (e: any) {
    submitResult.value = { code: -1, msg: e.message || '提交失败' }
  }
  finally {
    submitting.value = false
  }
}

/** 格式化毫秒为时间字符串 */
function formatMs(ms: number): string {
  if (!ms || ms <= 0)
    return '--'
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const remainSecs = secs % 60
  return `${mins}:${remainSecs.toString().padStart(2, '0')}.${(ms % 1000).toString().padStart(3, '0')}`
}

/** 创建初始空棋盘（全部闭合，无雷） */
function createEmptyBoard() {
  const { rows, cols } = config.value
  const empty: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    empty.push([])
    for (let c = 0; c < cols; c++) {
      empty[r]!.push({
        row: r,
        col: c,
        isMine: false,
        isOpen: false,
        isFlagged: false,
        adjacentMines: 0,
      })
    }
  }
  return empty
}

// ==================== 重置游戏 ====================
function resetGame() {
  stopTimer()
  gameStatus.value = 'idle'
  cells.value = createEmptyBoard()
  actions.value = []
  startTime.value = 0
  elapsedTime.value = 0
  flagCount.value = 0
  openedCount.value = 0
  submitResult.value = null
  nextTick(() => {
    initCanvas()
    render()
  })
}

function switchDifficulty() {
  resetGame()
}

// ==================== 鼠标事件 ====================
function onCanvasMouseDown(e: MouseEvent) {
  e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas)
    return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const col = Math.floor(x / cellSize.value)
  const row = Math.floor(y / cellSize.value)

  if (row < 0 || row >= config.value.rows || col < 0 || col >= config.value.cols)
    return

  if (e.button === 0) {
    // 左键
    handleCellClick(row, col)
  }
  else if (e.button === 2) {
    // 右键：标旗
    handleCellRightClick(row, col)
  }
}

function onCanvasDoubleClick(e: MouseEvent) {
  e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas)
    return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const col = Math.floor(x / cellSize.value)
  const row = Math.floor(y / cellSize.value)

  if (row < 0 || row >= config.value.rows || col < 0 || col >= config.value.cols)
    return

  tryChord(row, col)
}

function onCanvasContextMenu(e: MouseEvent) {
  e.preventDefault()
}

// ==================== 格式化时间 ====================
const formattedTime = computed(() => {
  const ms = elapsedTime.value
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const remainSecs = secs % 60
  return `${mins.toString().padStart(2, '0')}:${remainSecs.toString().padStart(2, '0')}.${(ms % 1000).toString().padStart(3, '0')}`
})

const remainingMines = computed(() => config.value.mines - flagCount.value)

// ==================== 表情按钮状态 ====================
const faceEmoji = computed(() => {
  if (gameStatus.value === 'won')
    return '😎'
  if (gameStatus.value === 'lost')
    return '😵'
  if (gameStatus.value === 'playing')
    return '🙂'
  return '😊'
})

// ==================== 生命周期 ====================
onMounted(async () => {
  await Promise.all([
    preloadImages(),
    initAudio(),
  ])
  cells.value = createEmptyBoard()
  initCanvas()
  render()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="minesweeper-game">
    <!-- ========== 难度选择 ========== -->
    <div class="difficulty-bar">
      <button
        v-for="(d, key) in DIFFICULTIES"
        :key="key"
        class="diff-btn" :class="[{ active: currentDifficulty === key }]"
        @click="currentDifficulty = key as keyof typeof DIFFICULTIES; switchDifficulty()"
      >
        {{ d.label }}
        <span class="diff-sub">{{ d.rows }}×{{ d.cols }} {{ d.mines }}雷</span>
      </button>
    </div>

    <!-- ========== 游戏面板 ========== -->
    <div class="game-panel">
      <!-- 状态栏 -->
      <div class="status-bar">
        <div class="mine-counter">
          雷 {{ remainingMines }}
        </div>
        <button class="face-btn" @click="resetGame">
          {{ faceEmoji }}
        </button>
        <div class="timer">
          ⏱ {{ formattedTime }}
        </div>
      </div>

      <!-- 游戏棋盘 -->
      <div class="canvas-wrapper" @wheel="onCanvasWheel">
        <canvas
          ref="canvasRef"
          @mousedown="onCanvasMouseDown"
          @dblclick="onCanvasDoubleClick"
          @contextmenu="onCanvasContextMenu"
        />
      </div>

      <!-- 缩放控件 -->
      <div class="zoom-bar">
        <button class="zoom-btn" title="缩小" @click="zoomOut">
          −
        </button>
        <button class="zoom-reset" title="重置缩放" @click="resetZoom">
          {{ Math.round(zoom * 100) }}%
        </button>
        <button class="zoom-btn" title="放大" @click="zoomIn">
          +
        </button>
      </div>
    </div>

    <!-- ========== 游戏结束：成绩显示 + 提交 ========== -->
    <div v-if="gameStatus === 'won'" class="result-panel win">
      <h3>🎉 恭喜通关！</h3>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-label">难度</span>
          <span class="stat-value">{{ config.label }} ({{ config.rows }}×{{ config.cols }})</span>
        </div>
        <div class="stat">
          <span class="stat-label">用时</span>
          <span class="stat-value">{{ (resultTime / 1000).toFixed(3) }}s</span>
        </div>
        <div class="stat">
          <span class="stat-label">3BV</span>
          <span class="stat-value">{{ resultBv }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">3BV/s</span>
          <span class="stat-value">{{ resultBvs.toFixed(3) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">点击次数</span>
          <span class="stat-value">{{ resultTap }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">有效点击</span>
          <span class="stat-value">{{ resultEffectiveTap }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">操作记录数</span>
          <span class="stat-value">{{ actions.length }}</span>
        </div>
      </div>

      <div class="submit-area">
        <button
          v-if="!submitResult || submitResult.code !== 200"
          class="submit-btn"
          :disabled="submitting"
          @click="submitRecord"
        >
          {{ submitting ? '提交中...' : '提交录像 📤' }}
        </button>
        <div v-if="submitResult" class="submit-result" :class="[submitResult.code === 200 ? 'success' : 'error']">
          {{ submitResult.msg }}
        </div>

        <!-- 排名数据 -->
        <div v-if="submitResult?.data" class="rank-panel">
          <h4>📊 服务器排名</h4>
          <div class="stats-grid">
            <div class="stat">
              <span class="stat-label">新排名</span>
              <span class="stat-value rank">#{{ submitResult.data.newRank }} <span class="rank-change">(旧: #{{ submitResult.data.oldRank }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">超越</span>
              <span class="stat-value">{{ (submitResult.data.rankPercent * 100).toFixed(1) }}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">最佳时间 (日)</span>
              <span class="stat-value">{{ formatMs(submitResult.data.timeDayNew) }} <span v-if="submitResult.data.timeDay" class="sub">(旧: {{ formatMs(submitResult.data.timeDay) }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">最佳时间 (周)</span>
              <span class="stat-value">{{ formatMs(submitResult.data.timeWeekNew) }} <span v-if="submitResult.data.timeWeek" class="sub">(旧: {{ formatMs(submitResult.data.timeWeek) }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">最佳时间 (月)</span>
              <span class="stat-value">{{ formatMs(submitResult.data.timeMonthNew) }} <span v-if="submitResult.data.timeMonth" class="sub">(旧: {{ formatMs(submitResult.data.timeMonth) }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">最佳 3BV/s (日)</span>
              <span class="stat-value">{{ submitResult.data.bvsDayNew.toFixed(3) }} <span v-if="submitResult.data.bvsDay" class="sub">(旧: {{ submitResult.data.bvsDay.toFixed(3) }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">最佳 3BV/s (周)</span>
              <span class="stat-value">{{ submitResult.data.bvsWeekNew.toFixed(3) }} <span v-if="submitResult.data.bvsWeek" class="sub">(旧: {{ submitResult.data.bvsWeek.toFixed(3) }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">最佳 3BV/s (月)</span>
              <span class="stat-value">{{ submitResult.data.bvsMonthNew.toFixed(3) }} <span v-if="submitResult.data.bvsMonth" class="sub">(旧: {{ submitResult.data.bvsMonth.toFixed(3) }})</span></span>
            </div>
            <div class="stat">
              <span class="stat-label">获得金币</span>
              <span class="stat-value coin">🪙 {{ submitResult.data.coin }}</span>
            </div>
          </div>
        </div>
      </div>

      <button class="replay-btn" @click="resetGame">
        🔄 再来一局
      </button>
    </div>

    <div v-if="gameStatus === 'lost'" class="result-panel lose">
      <h3>💥 踩雷了！</h3>
      <p>用时: {{ (elapsedTime / 1000).toFixed(3) }}s | 已翻开: {{ openedCount }} / {{ totalNonMineCells }}</p>
      <button class="replay-btn" @click="resetGame">
        🔄 再来一局
      </button>
    </div>
  </div>
</template>

<style scoped>
.minesweeper-game {
  background: #1b1b1b;
  border-radius: 12px;
  padding: 20px;
  color: #fff;
  width: 100%;
  margin: 0 auto;
  user-select: none;
}

/* ========== 难度选择 ========== */
.difficulty-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  justify-content: center;
}

.diff-btn {
  background: #2a2a2a;
  border: 2px solid #444;
  color: #ccc;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.diff-btn:hover {
  background: #3a3a3a;
  border-color: #fa7299;
}

.diff-btn.active {
  background: #fa7299;
  border-color: #fa7299;
  color: #fff;
  font-weight: bold;
}

.diff-sub {
  font-size: 0.75rem;
  opacity: 0.7;
}

/* ========== 游戏面板 ========== */
.game-panel {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

/* ========== 状态栏 ========== */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 10px;
  background: #1b1b1b;
  border-radius: 6px;
  font-family: monospace;
  font-size: 1.1rem;
}

.mine-counter,
.timer {
  min-width: 100px;
}

.mine-counter {
  text-align: left;
}

.timer {
  text-align: right;
}

.face-btn {
  background: none;
  border: 2px solid #555;
  border-radius: 50%;
  width: 42px;
  height: 42px;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.face-btn:hover {
  border-color: #fa7299;
  background: #3a3a3a;
}

/* ========== 棋盘 ========== */
.canvas-wrapper {
  overflow: auto;
  display: grid;
  background: #b6ccd2;
  padding: 15px;
  border-radius: 6px;
}

canvas {
  image-rendering: pixelated;
  cursor: pointer;
  justify-self: safe center;
}

/* ========== 缩放控件 ========== */
.zoom-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.zoom-btn,
.zoom-reset {
  background: #2a2a2a;
  border: 1px solid #555;
  color: #ccc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  font-size: 1.2rem;
  font-weight: bold;
}

.zoom-reset {
  padding: 4px 14px;
  min-width: 60px;
  font-size: 0.85rem;
}

.zoom-btn:hover,
.zoom-reset:hover {
  background: #3a3a3a;
  border-color: #fa7299;
  color: #fff;
}

/* ========== 成绩面板 ========== */
.result-panel {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.result-panel.win {
  border: 2px solid #4caf50;
}

.result-panel.lose {
  border: 2px solid #f44336;
}

.result-panel h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.win h3 {
  color: #4caf50;
}
.lose h3 {
  color: #f44336;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat {
  background: #1b1b1b;
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.8rem;
  color: #999;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fa7299;
}

/* ========== 提交按钮 ========== */
.submit-area {
  margin-bottom: 16px;
}

.submit-btn {
  background: #fa7299;
  border: none;
  color: #fff;
  padding: 10px 30px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #f05a81;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-result {
  margin-top: 10px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.submit-result.success {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.submit-result.error {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

.replay-btn {
  background: #444;
  border: none;
  color: #fff;
  padding: 10px 24px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.replay-btn:hover {
  background: #555;
}

/* ========== 排名面板 ========== */
.rank-panel {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #444;
}

.rank-panel h4 {
  margin: 0 0 12px;
  color: #fa7299;
  font-size: 1.1rem;
}

.rank-change,
.sub {
  font-size: 0.75rem;
  color: #888;
  font-weight: normal;
}

.rank {
  font-size: 1.3rem !important;
}

.coin {
  color: #ffd700 !important;
}
</style>
