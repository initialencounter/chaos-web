<script lang="ts" setup>
import type {
  ActivePropEffect,
  Cell,
  ChaosUser,
  Minefield,
  Prop,
  ScoreBoard as ScoreBoardType,
  ZoneRect,
} from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Howl } from 'howler'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { wsClient } from '@/api/websocket'
import PropBar from '@/components/PropBar.vue'
import ScoreBoard from '@/components/ScoreBoard.vue'
import ScoreTip from '@/components/ScoreTip.vue'
import { resolveImageUrl } from '@/utils/image'

// ========== 动作接口 ==========
interface Action {
  a: number // 0=打开, 1=标记
  r: number // row
  c: number // column
}

// ========== 常量 ==========
const cellSize = 24
const COOLDOWN_PER_ERROR = 0.5

// ========== 快捷键 (localStorage 持久化) ==========
const KEYBINDS_STORAGE_KEY = 'mines-keybinds'
const defaultKeybinds = { flagMode: 'F', detector: 'D', xjbd: 'X' }

function loadKeybinds() {
  try {
    const saved = localStorage.getItem(KEYBINDS_STORAGE_KEY)
    return saved
      ? { ...defaultKeybinds, ...JSON.parse(saved) }
      : { ...defaultKeybinds }
  }
  catch {
    return { ...defaultKeybinds }
  }
}
function saveKeybinds(binds: typeof defaultKeybinds) {
  localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(binds))
}
const keybinds = ref(loadKeybinds())

// ========== 主题 (localStorage 持久化) ==========
type ThemeName = 'wom' | 'chocolate'
const THEME_STORAGE_KEY = 'mines-theme'

function loadTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'chocolate' ? 'chocolate' : 'wom'
  }
  catch {
    return 'wom'
  }
}
function saveTheme(theme: ThemeName) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}
const currentTheme = ref<ThemeName>(loadTheme())

function toggleTheme() {
  currentTheme.value = currentTheme.value === 'wom' ? 'chocolate' : 'wom'
  saveTheme(currentTheme.value)
}

// ========== 玩家光标显示 (localStorage 持久化) ==========
type PlayerCursorMode = 'full' | 'avatar' | 'off'
const PLAYER_CURSOR_MODE_KEY = 'mines-player-cursor-mode'

function loadPlayerCursorMode(): PlayerCursorMode {
  try {
    const saved = localStorage.getItem(PLAYER_CURSOR_MODE_KEY)
    return saved === 'avatar' ? 'avatar' : saved === 'off' ? 'off' : 'full'
  }
  catch {
    return 'full'
  }
}
function savePlayerCursorMode(mode: PlayerCursorMode) {
  localStorage.setItem(PLAYER_CURSOR_MODE_KEY, mode)
}
const playerCursorMode = ref<PlayerCursorMode>(loadPlayerCursorMode())

function togglePlayerCursorMode() {
  const modes: PlayerCursorMode[] = ['full', 'avatar', 'off']
  const idx = modes.indexOf(playerCursorMode.value)
  playerCursorMode.value = modes[(idx + 1) % 3]
  savePlayerCursorMode(playerCursorMode.value)
}

const showPlayerCursors = computed(() => playerCursorMode.value !== 'off')
const showPlayerNames = computed(() => playerCursorMode.value === 'full')

/** 更新单个快捷键 (来自外部设置) */
function _setKeybind(action: keyof typeof defaultKeybinds, key: string) {
  const updated = { ...keybinds.value, [action]: key.toUpperCase() }
  keybinds.value = updated
  saveKeybinds(updated)
}

// ========== 音效 ==========
const openSound = new Howl({ src: ['./assets/audio/open.mp3'], volume: 0.5 })
const flagSound = new Howl({ src: ['./assets/audio/flag.mp3'], volume: 0.5 })
const boomSound = new Howl({ src: ['./assets/audio/boom.mp3'], volume: 0.2 })

// ========== 响应式状态 ==========
const minefield = ref<Minefield>({
  Width: 0,
  Height: 0,
  Cells: 0,
  Mines: 0,
  Cell: [],
  First: false,
  StartTimeStamp: 0,
  highScoreZone: null,
  noFlagZone: null,
  maxTime: 3600000,
})

const timeWatcher = ref('00:000')
const scoreBoard = ref<ScoreBoardType>({})
const flagMode = ref(false)
const spaceHeld = ref(false)
const effectiveFlagMode = computed(() => flagMode.value !== spaceHeld.value)

// CD 系统
// 提示系统
const hintCount = ref(0)
const maxHints = 5
const remainingSafeCells = computed(
  () =>
    minefield.value.Cell.filter(c => !c.IsOpen && !c.IsFlagged && !c.IsMine)
      .length,
)

// CD 系统
const cdEndTime = ref(0) // 冷却结束时间戳
const cdRemaining = ref(0) // 剩余冷却秒数
const isBlocked = computed(() => cdRemaining.value > 0)
const cdTimer = ref<number | null>(null)
const serverErrorCount = ref(0) // 服务端累计错误次数
const cdTotal = ref(0) // 本次冷却总时长 (用于进度条)
const cdPercent = computed(() =>
  cdTotal.value > 0
    ? Math.max(0, (cdRemaining.value / cdTotal.value) * 100)
    : 0,
)

const isJoined = ref(false)
const currentUid = ref<string>('')

// 道具系统
const myProps = ref<Record<number, Prop>>({}) // propId → 道具
const myPropsList = computed(() => Object.values(myProps.value)) // PropBar 用
const usingPropId = ref<number | null>(null) // 正在使用的主动道具 ID
const activeEffects = ref<Record<number, ActivePropEffect>>({}) // propId → 激活效果

// 护盾/双倍 激活标志(计算属性)
const shieldActive = computed(() => {
  const p = myProps.value[1002]
  return p ? p.num > 0 : false
})
const shieldCount = computed(() => {
  const p = myProps.value[1002]
  return p ? p.num : 0
})

const doubleScoreActive = computed(() => !!activeEffects.value[1001])
const doubleRemaining = computed(() => {
  const e = activeEffects.value[1001]
  return e ? Math.max(0, (e.startTime + e.remainingMs - Date.now()) / 1000) : 0
})

// 结算
const showResultDialog = ref(false)
const resultList = ref<any[]>([])

// 计时器
let startTimeStamp = 0
let timerRunning = false
let intervalFlag: number
let effectUpdateTimer: number | null = null

// 其他玩家光标追踪
interface PlayerCursor {
  uid: string
  name: string
  avatar: string
  cellIndex: number
}
const playerCursors = ref<Record<string, PlayerCursor>>({})

interface TrailParticle {
  id: number
  avatar: string
  fromIndex: number
  toIndex: number
}
const trails = ref<TrailParticle[]>([])
let trailIdSeq = 0

// 记录已初始化的光标 (用于跳过首次渲染的位置过渡)
const initializedCursors = ref<Set<string>>(new Set())

// ScoreTip 引用
const scoreTip = ref<InstanceType<typeof ScoreTip> | null>(null)
const _lastKnownScore = 0 // 追踪自己的分数变化

document.oncontextmenu = () => false

// ========== 快捷键处理 ==========
function onKeydown(e: KeyboardEvent) {
  // 不在输入框内响应
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
    return
  // 忽略修饰键组合 (避免劫持浏览器快捷键)
  if (e.metaKey || e.ctrlKey || e.altKey)
    return

  const key = e.key.toUpperCase()

  if (e.code === 'Space') {
    e.preventDefault()
    if (!spaceHeld.value) {
      spaceHeld.value = true
    }
    return
  }
  if (key === keybinds.value.flagMode.toUpperCase()) {
    e.preventDefault()
    flagMode.value = !flagMode.value
    return
  }
  if (key === keybinds.value.detector.toUpperCase() && hasProp(101)) {
    e.preventDefault()
    startUseProp(101)
    return
  }
  if (key === keybinds.value.xjbd.toUpperCase() && hasProp(102)) {
    e.preventDefault()
    startUseProp(102)
  }
}

function onKeyup(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceHeld.value = false
  }
}

function hasProp(propId: number): boolean {
  const p = myProps.value[propId]
  return !!(p && p.num > 0)
}

// ========== 生命周期 ==========
onMounted(async () => {
  try {
    const status = await window.electronAPI.getLoginStatus()
    if (status.loggedIn && status.uid) {
      currentUid.value = status.uid
    }
  }
  catch (e) {
    console.error('Failed to get uid', e)
  }

  initGame()
  startEffectUpdateLoop()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  cleanup()
})

function cleanup() {
  wsClient.off('chaos/enter', onEnter)
  wsClient.off('chaos/action', onAction)
  wsClient.off('chaos/refresh/users', onRefreshUsers)
  wsClient.off('chaos/finish', onFinish)
  wsClient.off('chaos/prop/gain', onPropGain)
  wsClient.off('chaos/prop/use', onPropUse)
  wsClient.off('chaos/join/event', onJoinEvent)
  wsClient.off('chaos/join', onJoin)
  wsClient.off('ready', onReady)
  wsClient.off('disconnect', onDisconnect)
  wsClient.close()
  if (timerRunning)
    clearInterval(intervalFlag)
  if (cdTimer.value)
    clearInterval(cdTimer.value)
  if (effectUpdateTimer)
    clearInterval(effectUpdateTimer)
  playerCursors.value = {}
  trails.value = []
  initializedCursors.value = new Set()
}

// ========== WebSocket 初始化 ==========
function initGame() {
  const url = `ws://localhost:8080/ws`
  wsClient.on('chaos/enter', onEnter)
  wsClient.on('chaos/action', onAction)
  wsClient.on('chaos/refresh/users', onRefreshUsers)
  wsClient.on('chaos/finish', onFinish)
  wsClient.on('chaos/prop/gain', onPropGain)
  wsClient.on('chaos/prop/use', onPropUse)
  wsClient.on('chaos/join/event', onJoinEvent)
  wsClient.on('chaos/join', onJoin)
  wsClient.on('ready', onReady)
  wsClient.on('disconnect', onDisconnect)
  wsClient.connect(url)
}

function onReady() {
  console.warn('WebSocket connected, entering room...')
  wsClient.send({ url: 'enter' })
}

function onDisconnect() {
  ElMessageBox.confirm('与服务器断开连接，是否重新入房间？', '连接断开', {
    confirmButtonText: '重连',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => reset())
    .catch(() => {})
}

// ========== chaos/enter — 进入房间 ==========
function onEnter(data: any) {
  console.warn('Entered room:', data)
  if (!data.map)
    return

  const mapData = data.map.map as string
  const mapStatus = data.map.mapStatus as string

  const rows = mapData.split('-').filter((row: string) => row.length > 0)
  const statuses = mapStatus.split('-').filter((row: string) => row.length > 0)

  minefield.value.Height = rows.length
  minefield.value.Width = rows[0]?.length || 0
  minefield.value.Mines = data.map.mine || 600
  minefield.value.maxTime = data.map.maxTime || 3600000

  // 解析特殊区域
  minefield.value.highScoreZone = parseZone(data.map, 'highScore')
  minefield.value.noFlagZone = parseZone(data.map, 'nf')

  // 解析格子
  const cells: Cell[] = []
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const val = rows[r][c]
      const status = statuses[r]?.[c] ?? '0'
      cells.push({
        Id: r * minefield.value.Width + c,
        Mines: val === '9' ? 9 : Number.parseInt(val),
        IsMine: val === '9',
        IsOpen: status === '1',
        IsFlagged: status === '8',
      })
    }
  }
  minefield.value.Cell = cells
  minefield.value.StartTimeStamp = data.map.createTime || Date.now()
  startTimeStamp = minefield.value.StartTimeStamp

  if (data.users) {
    updateScoreboard(data.users)
    checkIfJoined(data.users)
    syncMyErrorCount(data.users)
  }

  startTimer()
}

function checkIfJoined(users: ChaosUser[]) {
  if (!isJoined.value && currentUid.value) {
    const me = users.find(
      u => (u.user.uid || String(u.user.id)) === currentUid.value,
    )
    if (me) {
      handleJoin()
    }
  }
}

function handleJoin() {
  wsClient.send({ channel: 'App', version: 30610, url: 'join' })
  isJoined.value = true
}

function parseZone(mapObj: any, prefix: string): ZoneRect | null {
  const sr = mapObj[`${prefix}StartRow`]
  const sc = mapObj[`${prefix}StartColumn`]
  const er = mapObj[`${prefix}EndRow`]
  const ec = mapObj[`${prefix}EndColumn`]
  if (
    sr === undefined
    || sc === undefined
    || er === undefined
    || ec === undefined
  ) {
    return null
  }
  return { startRow: sr, startColumn: sc, endRow: er, endColumn: ec }
}

// ========== chaos/join — 加入响应, 同步道具 ==========
function onJoin(data: any) {
  console.warn('Joined game:', data)
  if (data.props) {
    for (const p of data.props) {
      addOrUpdateProp({
        id: p.id,
        name: p.name,
        icon: p.icon,
        num: p.num,
        active: p.active,
        duration: p.duration,
        type: p.type,
        consumeCount: p.consumeCount,
      })
    }
  }
  if (data.countError !== undefined) {
    serverErrorCount.value = data.countError
  }
}

// ========== chaos/join/event — 玩家加入通知 ==========
function onJoinEvent(data: any) {
  if (data.user) {
    ElMessage.info(
      `${data.user.user?.nickName || data.user.user?.uid} 加入了游戏`,
    )
    updateSinglePlayer(data.user)
  }
}

// ========== chaos/action — 玩家操作广播 ==========
function onAction(data: any) {
  if (data.actions) {
    for (const action of data.actions) {
      const idx = action.r * minefield.value.Width + action.c
      const cell = minefield.value.Cell[idx]
      if (!cell)
        continue
      if (action.a === 0) {
        cell.IsOpen = true
        cell.IsFlagged = false
        // 如果显示的是已经标记的雷（就是踩雷了），保持 IsMine=true 但标记 IsFlagged
        if (cell.IsMine) {
          cell.IsFlagged = true
        }
      }
      else if (action.a === 1) {
        cell.IsFlagged = true
      }
    }
  }
  if (data.user) {
    updateSinglePlayer(data.user)
    // 追踪其他玩家的光标位置
    trackPlayerCursor(data)
    // 同步服务端错误次数 (用于冷却计算)
    const uid = data.user.user?.uid || String(data.user.user?.id || '')
    if (uid === getMyUid()) {
      serverErrorCount.value
        = data.user.countError ?? data.user.countIncorrect ?? 0
    }
  }
}

// ========== 玩家光标追踪 ==========
function trackPlayerCursor(data: any) {
  if (!data.actions?.length)
    return
  const uid = data.user?.user?.uid || String(data.user?.user?.id || '')
  if (!uid || uid === getMyUid())
    return

  const name = data.user.user.nickName || uid
  const avatar = data.user.user.avatar || ''
  const lastAction = data.actions[data.actions.length - 1]
  const newCellIndex = lastAction.r * minefield.value.Width + lastAction.c
  const prev = playerCursors.value[uid]

  if (prev && prev.cellIndex !== newCellIndex) {
    const trail: TrailParticle = {
      id: ++trailIdSeq,
      avatar: avatar || prev.avatar,
      fromIndex: prev.cellIndex,
      toIndex: newCellIndex,
    }
    trails.value = [...trails.value, trail]
    setTimeout(() => {
      trails.value = trails.value.filter(t => t.id !== trail.id)
    }, 600)
  }

  if (!initializedCursors.value.has(uid)) {
    initializedCursors.value = new Set([...initializedCursors.value, uid])
  }

  playerCursors.value = {
    ...playerCursors.value,
    [uid]: { uid, name, avatar, cellIndex: newCellIndex },
  }
}

function cursorInitialized(uid: string): boolean {
  return initializedCursors.value.has(uid)
}

function playerCursorStyle(cursor: PlayerCursor) {
  const pos = cellIndexToPos(cursor.cellIndex)
  return {
    left: `${pos.x + cellSize / 2}px`,
    top: `${pos.y + cellSize / 2}px`,
  }
}

function cellIndexToPos(index: number) {
  const col = index % minefield.value.Width
  const row = Math.floor(index / minefield.value.Width)
  return { x: col * cellSize, y: row * cellSize }
}

function trailStyle(trail: TrailParticle) {
  const from = cellIndexToPos(trail.fromIndex)
  const to = cellIndexToPos(trail.toIndex)
  return {
    'left': `${to.x}px`,
    'top': `${to.y}px`,
    '--trail-from-x': `${from.x}px`,
    '--trail-from-y': `${from.y}px`,
    '--trail-to-x': `${to.x}px`,
    '--trail-to-y': `${to.y}px`,
  }
}

// ========== chaos/refresh/users — 刷新玩家 ==========
function onRefreshUsers(data: any) {
  if (data.users) {
    updateScoreboard(data.users)
    checkIfJoined(data.users)
    syncMyErrorCount(data.users)
  }
}

// ========== 同步服务端错误次数 ==========
function syncMyErrorCount(users: any[]) {
  if (!currentUid.value)
    return
  const me = users.find(
    (u: any) => (u.user?.uid || String(u.user?.id)) === currentUid.value,
  )
  if (me) {
    serverErrorCount.value = me.countError ?? me.countIncorrect ?? 0
  }
}

// ========== chaos/finish — 结算 ==========
function onFinish(data: any) {
  if (data?.users) {
    const sorted = [...data.users].sort((a: any, b: any) => b.score - a.score)
    resultList.value = sorted
    showResultDialog.value = true
  }
  if (timerRunning) {
    clearInterval(intervalFlag)
    timerRunning = false
  }
}

// ========== chaos/prop/gain — 获得道具 ==========
function onPropGain(data: any) {
  if (!data.prop)
    return
  const p = data.prop
  ElMessage.success(`获得道具: ${getPropDisplayName(p.name)} (+${p.num})`)

  // 自动道具 (双倍): 获得即激活效果, 不等待服务端 chaos/prop/use
  // 护盾不限时间, 不需要注册定时效果
  if (!p.active && p.id === 1001) {
    wsClient.send({
      propId: 1001,
      column: data.column,
      row: data.row,
      url: 'prop/use',
    })
    registerAutoPropEffect(p.id, p.duration, p.name, data.column, data.row)
  }

  addOrUpdateProp({
    id: p.id,
    name: p.name,
    icon: p.icon,
    num: p.num,
    active: p.active,
    duration: p.duration,
    type: p.type,
    consumeCount: p.consumeCount,
  })
}

/** 立即注册自动道具的激活效果 (双倍在获得瞬间开始计时), 已有则叠加 duration */
function registerAutoPropEffect(
  propId: number,
  duration: number,
  name: string,
  col?: number,
  row?: number,
) {
  const existing = activeEffects.value[propId]
  if (existing) {
    const elapsed = Date.now() - existing.startTime
    const remaining = Math.max(0, existing.remainingMs - elapsed)
    existing.startTime = Date.now()
    existing.remainingMs = remaining + duration
  }
  else {
    activeEffects.value[propId] = {
      propId,
      propName: name,
      remainingMs: duration,
      startTime: Date.now(),
      centerCol: col,
      centerRow: row,
    }
  }
}

// ========== chaos/prop/use — 道具使用广播 (自动道具: 护盾/双倍) ==========
function onPropUse(data: any) {
  const propId = data.propId
  if (!propId)
    return

  // 自动道具 (双倍 1001): onPropGain 已激活效果, 这里只扣减库存
  // 护盾 (1002) 不限时间, 踩雷时消耗, 此处不扣减
  // 主动道具 (101, 102): handlePropUse 已处理全部, 此处跳过
  if (propId !== 1001)
    return

  const inventoryProp = myProps.value[1001]
  if (inventoryProp) {
    inventoryProp.num -= 1
    if (inventoryProp.num <= 0) {
      delete myProps.value[1001]
    }
  }
}

// ========== prop/gain 时的本地道具更新 ==========
function addOrUpdateProp(prop: Prop) {
  const existing = myProps.value[prop.id]
  if (existing) {
    existing.num += prop.num
  }
  else {
    myProps.value[prop.id] = { ...prop }
  }
}

// ========== 道具使用流程 ==========
function startUseProp(propId: number) {
  if (isBlocked.value) {
    ElMessage.warning('冷却中，请等待')
    return
  }
  if (usingPropId.value === propId) {
    usingPropId.value = null // 取消
    return
  }
  usingPropId.value = propId
}

function _propNameById(id: number): string {
  const map: Record<number, string> = {
    101: '探测仪',
    102: '雷之奥义',
    1001: '双倍积分',
    1002: '护盾',
  }
  return map[id] || `道具#${id}`
}

function getPropDisplayName(name: string): string {
  const map: Record<string, string> = {
    chaos_detector: '探测仪',
    chaos_xjbd: '雷之奥义',
    chaos_double_score: '双倍积分',
    chaos_shield: '护盾',
  }
  return map[name] || name
}

// ========== 点击处理 ==========
function handleClick(event: MouseEvent, index: number) {
  if (!isJoined.value) {
    ElMessage.warning('观战模式中，请先加入乱斗')
    return
  }

  if (isBlocked.value) {
    ElMessage.warning(`冷却中，${cdRemaining.value.toFixed(1)}s 后恢复`)
    return
  }

  const cell = minefield.value.Cell[index]
  const r = Math.floor(index / minefield.value.Width)
  const c = index % minefield.value.Width

  // 如果在使用道具模式
  if (usingPropId.value !== null) {
    handlePropUse(usingPropId.value, r, c)
    return
  }

  flagSound.stop()
  openSound.stop()

  const isRightClick = event.button === 2
  const shouldFlag = isRightClick !== effectiveFlagMode.value

  // 红区检查 — 只能打开,不能标记
  if (shouldFlag && isInNoFlagZone(index)) {
    ElMessage.warning('该区域禁止标记，只能打开')
    return
  }

  if (shouldFlag) {
    flagSound.play()
    if (!cell.IsOpen) {
      // 标记非雷会进入冷却
      if (!cell.IsMine) {
        if (shieldCount.value > 0) {
          myProps.value[1002].num -= 1
          wsClient.send({ propId: 1002, column: c, row: r, url: 'prop/use' }) // 同步消耗
          if (shieldCount.value <= 0) {
            delete myProps.value[1002]
          }
          ElMessage.warning(`标记错误！护盾保护 (剩余 ${shieldCount.value} 个)`)
        }
        else {
          boomSound.play()
          applyCooldown()
          ElMessage({ message: '标记错误', type: 'info', duration: 800 })
        }
      }
      doFlag({ a: 1, c, r })
    }
    else {
      doExpand(index)
    }
  }
  else {
    // 挖开
    openSound.play()
    if (!cell.IsOpen && !cell.IsFlagged) {
      if (cell.IsMine) {
        // 护盾: 踩雷不进入冷却, 消耗一个护盾
        if (shieldCount.value > 0) {
          myProps.value[1002].num -= 1
          if (shieldCount.value <= 0) {
            delete myProps.value[1002]
          }
          wsClient.send({ propId: 1002, column: c, row: r, url: 'prop/use' }) // 同步消耗
          ElMessage.warning(`踩雷！护盾保护 (剩余 ${shieldCount.value} 个)`)
        }
        else {
          boomSound.play()
          applyCooldown()
          ElMessage({ message: '踩雷', type: 'info', duration: 800 })
        }
      }
      doOpen({ a: 0, c, r })
    }
    else if (cell.IsOpen) {
      doExpand(index)
    }
  }
}

// ========== 道具使用 ==========
function handlePropUse(propId: number, row: number, col: number) {
  const prop = myProps.value[propId]
  if (!prop || prop.num <= 0) {
    ElMessage.error('没有该道具')
    usingPropId.value = null
    return
  }
  if (!prop.active) {
    ElMessage.warning('该道具是自动使用的')
    usingPropId.value = null
    return
  }

  // 发送道具使用请求 + 本地立即扣减
  wsClient.send({ propId, column: col, row, url: 'prop/use' })
  prop.num -= 1
  if (prop.num <= 0) {
    delete myProps.value[propId]
  }
  usingPropId.value = null

  // ==== 雷之奥义(id=102): 客户端计算 7x7 区域，标记所有雷、打开所有安全格 ====
  //  服务端不负责计算，客户端需要自己算出所有 action 并批量发送
  if (propId === 102) {
    doXjbd(row, col)
  }

  // ==== 探测仪(id=101): 只需激活视觉效果，服务端处理道具消耗 ====
  //  客户端根据已有地图数据高亮 5x5 范围内的雷（见 isInDetectorRange）

  // 注册激活效果（服务端可能不广播 prop/use, 客户端主动登记）
  const knownDurations: Record<number, number> = { 101: 10000, 102: 1500 }
  const knownNames: Record<number, string> = {
    101: 'chaos_detector',
    102: 'chaos_xjbd',
  }
  const dur = knownDurations[propId]
  if (dur) {
    activeEffects.value[propId] = {
      propId,
      propName: knownNames[propId] || `prop_${propId}`,
      remainingMs: dur,
      startTime: Date.now(),
      centerCol: col,
      centerRow: row,
    }
  }

  ElMessage.success(`使用 ${getPropDisplayName(prop.name)}`)
}

/** 雷之奥义: 自动完成 7x7 区域 — 标记雷 + 打开安全格(含递归展开) */
function doXjbd(centerRow: number, centerCol: number) {
  const w = minefield.value.Width
  const h = minefield.value.Height
  const visited = new Set<number>()
  const actions: Action[] = []

  // 7x7 区域边界 (中心 ±3)
  const r0 = Math.max(0, centerRow - 3)
  const r1 = Math.min(h - 1, centerRow + 3)
  const c0 = Math.max(0, centerCol - 3)
  const c1 = Math.min(w - 1, centerCol + 3)

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const idx = r * w + c
      if (visited.has(idx))
        continue
      const cell = minefield.value.Cell[idx]
      if (cell.IsOpen || cell.IsFlagged)
        continue

      visited.add(idx)
      if (cell.IsMine) {
        // 雷 → 标记
        actions.push({ a: 1, r, c })
      }
      else {
        // 安全格 → 打开
        actions.push({ a: 0, r, c })
        // 0 值格子触发连锁展开
        if (cell.Mines === 0) {
          actions.push(...collectChainOpen(r, c, w, h, visited))
        }
      }
    }
  }

  if (actions.length > 0) {
    sendActions(actions)
  }
}

/** BFS 收集从 (r,c) 出发的连锁打开动作（0 值展开，遇非 0 安全格止步） */
function collectChainOpen(
  sr: number,
  sc: number,
  w: number,
  h: number,
  visited: Set<number>,
): Action[] {
  const result: Action[] = []
  const queue: [number, number][] = [[sr, sc]]

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0)
          continue
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nr >= h || nc < 0 || nc >= w)
          continue
        const idx = nr * w + nc
        if (visited.has(idx))
          continue
        const cell = minefield.value.Cell[idx]
        if (cell.IsOpen || cell.IsFlagged)
          continue
        visited.add(idx)
        if (cell.IsMine)
          continue // 连锁展开不标记雷
        result.push({ a: 0, r: nr, c: nc })
        if (cell.Mines === 0) {
          queue.push([nr, nc])
        }
      }
    }
  }
  return result
}

// ========== 冷却系统 ==========
function applyCooldown() {
  const now = Date.now()
  const penalty = 2.5 + (serverErrorCount.value + 1) * COOLDOWN_PER_ERROR
  cdTotal.value = penalty
  cdEndTime.value = Math.max(cdEndTime.value, now) + penalty * 1000
  cdRemaining.value = (cdEndTime.value - now) / 1000
  startCdTimer()
}

function startCdTimer() {
  if (cdTimer.value)
    return
  cdTimer.value = window.setInterval(() => {
    const remaining = Math.max(0, (cdEndTime.value - Date.now()) / 1000)
    cdRemaining.value = remaining
    if (remaining <= 0) {
      cdRemaining.value = 0
      if (cdTimer.value) {
        clearInterval(cdTimer.value)
        cdTimer.value = null
      }
    }
  }, 100)
}

// ========== 主动效果更新循环(双倍计时) ==========
function startEffectUpdateLoop() {
  effectUpdateTimer = window.setInterval(() => {
    const now = Date.now()
    const expiredAutoIds: number[] = []
    for (const key of Object.keys(activeEffects.value)) {
      const e = activeEffects.value[key]
      if (!e)
        continue
      const elapsed = now - e.startTime
      if (elapsed >= e.remainingMs) {
        // 自动道具效果过期时, 同步清理道具栏库存 (护盾不限时, 无需处理)
        if (e.propId === 1001) {
          expiredAutoIds.push(e.propId)
        }
        delete activeEffects.value[e.propId]
      }
    }
    for (const propId of expiredAutoIds) {
      const inv = myProps.value[propId]
      if (inv) {
        inv.num -= 1
        if (inv.num <= 0) {
          delete myProps.value[propId]
        }
      }
    }
  }, 500)
}

// ========== 操作 ==========
function doOpen(action: Action) {
  const actions: Action[] = []
  const cell
    = minefield.value.Cell[action.r * minefield.value.Width + action.c]
  if (cell.Mines === 0) {
    actions.push(...reveal(action.a, action.c, action.r))
  }
  actions.push(action)
  sendActions(actions)
}

function doFlag(action: Action) {
  sendActions([action])
}

function doExpand(index: number) {
  const cell = minefield.value.Cell[index]
  if (!cell.IsOpen)
    return

  const nearby = getNearbyCells(index)
  const flagCount = nearby.filter(
    n =>
      minefield.value.Cell[n].IsFlagged
      || (minefield.value.Cell[n].IsOpen && minefield.value.Cell[n].IsMine),
  ).length

  if (flagCount === cell.Mines) {
    openSound.play()
    const actions: Action[] = []
    nearby.forEach((i) => {
      const nCell = minefield.value.Cell[i]
      if (!nCell.IsOpen && !nCell.IsFlagged) {
        actions.push({
          a: 0,
          c: i % minefield.value.Width,
          r: Math.floor(i / minefield.value.Width),
        })
        if (nCell.Mines === 0) {
          actions.push(
            ...reveal(
              0,
              i % minefield.value.Width,
              Math.floor(i / minefield.value.Width),
            ),
          )
        }
      }
    })
    sendActions(actions)
  }
}

function reveal(a: number, c: number, r: number): Action[] {
  if (a !== 0)
    return []
  const actions: Action[] = []
  const cell = minefield.value.Cell[r * minefield.value.Width + c]
  if (cell.Mines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0)
          continue
        const nr = r + dr
        const nc = c + dc
        if (
          nr < 0
          || nr >= minefield.value.Height
          || nc < 0
          || nc >= minefield.value.Width
        ) {
          continue
        }
        const nCell = minefield.value.Cell[nr * minefield.value.Width + nc]
        if (nCell.IsOpen || nCell.IsFlagged)
          continue
        nCell.IsOpen = true
        actions.push({ a: 0, r: nr, c: nc })
        if (nCell.Mines === 0) {
          actions.push(...reveal(0, nc, nr))
        }
      }
    }
  }
  return actions
}

function sendActions(actions: Action[]) {
  if (actions.length === 0)
    return
  actions.forEach((act) => {
    const idx = act.r * minefield.value.Width + act.c
    const cell = minefield.value.Cell[idx]
    if (cell) {
      if (act.a === 0) {
        cell.IsOpen = true
        cell.IsFlagged = false
      }
      else if (act.a === 1) {
        cell.IsFlagged = true
      }
    }
  })
  wsClient.send({ url: 'action', actions })
}

function getNearbyCells(cell: number): number[] {
  const nearby: number[] = []
  const w = minefield.value.Width
  const h = minefield.value.Height
  const x = cell % w
  const y = Math.floor(cell / w)
  if (y > 0)
    nearby.push(cell - w)
  if (y < h - 1)
    nearby.push(cell + w)
  if (x > 0) {
    nearby.push(cell - 1)
    if (y > 0)
      nearby.push(cell - w - 1)
    if (y < h - 1)
      nearby.push(cell + w - 1)
  }
  if (x < w - 1) {
    nearby.push(cell + 1)
    if (y > 0)
      nearby.push(cell - w + 1)
    if (y < h - 1)
      nearby.push(cell + w + 1)
  }
  return nearby
}

// ========== 记分板 ==========
function updateScoreboard(users: ChaosUser[]) {
  const newScores: ScoreBoardType = {}
  const prevSelfScore = scoreBoard.value[getMyUid()]?.score ?? 0
  users.forEach((u) => {
    const uid = u.user.uid || String(u.user.id)
    newScores[uid] = {
      uid,
      name: u.user.nickName || uid,
      avatar: u.user.avatar || '',
      score: u.score,
      correct: u.countCorrect,
      incorrect: u.countIncorrect ?? u.countError,
      usePropCount: u.usePropCount,
      lastOpen: u.lastOpen,
    }
    // 检测分数变化以播放动画
    if (uid === getMyUid() && u.score !== prevSelfScore) {
      const delta = u.score - prevSelfScore
      if (delta !== 0 && scoreTip.value) {
        scoreTip.value.tips(delta, doubleScoreActive.value)
      }
    }
  })
  scoreBoard.value = newScores
}

function updateSinglePlayer(user: ChaosUser) {
  const uid = user.user.uid || String(user.user.id)
  const prevScore = scoreBoard.value[uid]?.score ?? 0
  scoreBoard.value[uid] = {
    uid,
    name: user.user.nickName || uid,
    avatar: user.user.avatar || '',
    score: user.score,
    correct: user.countCorrect,
    incorrect: user.countIncorrect ?? user.countError,
    usePropCount: user.usePropCount,
    lastOpen: user.lastOpen,
  }
  // 自己的分数变化动画
  if (uid === getMyUid() && user.score !== prevScore && scoreTip.value) {
    scoreTip.value.tips(user.score - prevScore, doubleScoreActive.value)
  }
}

function getMyUid(): string {
  return currentUid.value || ''
}

// ========== 区域判断 ==========
function isInNoFlagZone(index: number): boolean {
  const zone = minefield.value.noFlagZone
  if (!zone)
    return false
  const r = Math.floor(index / minefield.value.Width)
  const c = index % minefield.value.Width
  return (
    r >= zone.startRow
    && r <= zone.endRow
    && c >= zone.startColumn
    && c <= zone.endColumn
  )
}

function isInHighScoreZone(index: number): boolean {
  const zone = minefield.value.highScoreZone
  if (!zone)
    return false
  const r = Math.floor(index / minefield.value.Width)
  const c = index % minefield.value.Width
  return (
    r >= zone.startRow
    && r <= zone.endRow
    && c >= zone.startColumn
    && c <= zone.endColumn
  )
}

function isInDetectorRange(index: number): boolean {
  const detector = activeEffects.value[101]
  if (
    !detector
    || detector.centerCol === undefined
    || detector.centerRow === undefined
  ) {
    return false
  }
  const r = Math.floor(index / minefield.value.Width)
  const c = index % minefield.value.Width
  const dr = Math.abs(r - detector.centerRow)
  const dc = Math.abs(c - detector.centerCol)
  return dr <= 2 && dc <= 2 // 5x5 范围(中心 ±2)
}

function isInXjbdRange(index: number): boolean {
  const xjbd = activeEffects.value[102]
  if (!xjbd || xjbd.centerCol === undefined || xjbd.centerRow === undefined)
    return false
  const r = Math.floor(index / minefield.value.Width)
  const c = index % minefield.value.Width
  const dr = Math.abs(r - xjbd.centerRow)
  const dc = Math.abs(c - xjbd.centerCol)
  return dr <= 3 && dc <= 3 // 7x7 范围(中心 ±3)
}

// ========== 图片 ==========
function getImageSrc(cell: Cell): string {
  const theme = currentTheme.value
  const mines = cell.Mines
  if (cell.IsOpen) {
    if (cell.IsMine)
      return `./assets/themes/${theme}/flag.png`
    if (cell.Mines === 9)
      return `./assets/themes/${theme}/closed.png`
    return `./assets/themes/${theme}/type${mines}.png`
  }
  if (cell.IsFlagged)
    return `./assets/themes/${theme}/flag.png`
  return `./assets/themes/${theme}/closed.png`
}

// ========== 计时器 ==========
function startTimer() {
  if (!timerRunning) {
    timerRunning = true
    intervalFlag = window.setInterval(() => {
      timeWatcher.value = msToTime(Date.now() - startTimeStamp)
    }, 1)
  }
}

function msToTime(duration: number): string {
  const milliseconds = duration % 10
  const seconds = Math.floor(duration / 1000)
  const secondsStr = seconds < 10 ? `0${seconds}` : String(seconds)
  return `${secondsStr}:${milliseconds}`
}

// ========== 结算 UI ==========
function getRankBorder(rank: number) {
  if (rank === 1)
    return '3px solid gold'
  if (rank === 2)
    return '3px solid #aaa'
  if (rank === 3)
    return '3px solid #c96'
  return '2px solid #eee'
}
function getRankIcon(rank: number) {
  if (rank === 1)
    return '🥇'
  if (rank === 2)
    return '🥈'
  if (rank === 3)
    return '🥉'
  return ''
}

// ========== 提示 ==========
function doHint() {
  if (hintCount.value >= maxHints) {
    ElMessage.warning('提示次数已用完')
    return
  }
  for (let i = 0; i < minefield.value.Cell.length; i++) {
    const cell = minefield.value.Cell[i]
    if (!cell.IsOpen && !cell.IsFlagged && !cell.IsMine) {
      const r = Math.floor(i / minefield.value.Width)
      const c = i % minefield.value.Width
      doOpen({ a: 0, c, r })
      hintCount.value++
      if (hintCount.value >= maxHints) {
        ElMessage.info('提示次数已用完')
      }
      break
    }
  }
}

// ========== 重置 ==========

function reset() {
  cleanup()
  minefield.value = {
    Width: 0,
    Height: 0,
    Cells: 0,
    Mines: 0,
    Cell: [],
    First: false,
    StartTimeStamp: 0,
    highScoreZone: null,
    noFlagZone: null,
    maxTime: 3600000,
  }
  scoreBoard.value = {}
  myProps.value = {}
  activeEffects.value = {}
  cdEndTime.value = 0
  cdRemaining.value = 0
  cdTotal.value = 0
  serverErrorCount.value = 0
  hintCount.value = 0
  usingPropId.value = null
  timeWatcher.value = '00:000'
  timerRunning = false
  isJoined.value = false
  initGame()
  startEffectUpdateLoop()
}
</script>

<template>
  <!-- =================== 结算弹窗 =================== -->
  <div v-if="showResultDialog">
    <el-dialog
      v-model="showResultDialog"
      width="480px"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      center
    >
      <div style="text-align: center; padding: 0 0 10px 0">
        <!-- 第一名 -->
        <div v-if="resultList.length > 0" style="margin-bottom: 18px">
          <div
            style="display: flex; flex-direction: column; align-items: center"
          >
            <div style="position: relative">
              <img
                :src="resolveImageUrl(resultList[0].user.avatar)"
                style="
                  width: 90px;
                  height: 90px;
                  border-radius: 50%;
                  border: 4px solid gold;
                  object-fit: cover;
                "
              >
              <span
                style="
                  position: absolute;
                  right: -10px;
                  top: -10px;
                  font-size: 2.2rem;
                "
              >⚡</span>
            </div>
            <div style="font-size: 1.3rem; font-weight: bold; margin-top: 8px">
              {{ resultList[0].user.nickName }}
            </div>
            <div style="color: #888; font-size: 1rem; margin: 2px 0 6px 0">
              正确 {{ resultList[0].countCorrect }} 错误
              {{ resultList[0].countIncorrect ?? resultList[0].countError }}
              分数 {{ resultList[0].score }} 道具
              {{ resultList[0].usePropCount }}
            </div>
          </div>
        </div>
        <el-divider style="margin: 10px 0" />
        <div>
          <div
            v-for="(item, idx) in resultList"
            :key="item.user.uid"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin: 8px 0;
            "
          >
            <div style="display: flex; align-items: center">
              <span
                v-if="idx < 3"
                style="font-size: 1.3rem; width: 2.2em; text-align: center"
              >
                {{ getRankIcon(idx + 1) }}
              </span>
              <img
                :src="resolveImageUrl(item.user.avatar)"
                :style="{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: getRankBorder(idx + 1),
                  objectFit: 'cover',
                  marginRight: '8px',
                }"
              >
              <span style="font-weight: 600">{{ item.user.nickName }}</span>
              <span
                v-if="item.lastOpen"
                style="color: #e44; font-size: 0.95em; margin-left: 6px"
              >最后一击</span>
            </div>
            <div style="font-size: 0.98em">
              <span style="color: #0a0">{{ item.countCorrect }}</span> /
              <span style="color: #e44">{{
                item.countIncorrect ?? item.countError
              }}</span>
              /
              <span style="color: #09c">{{ item.score }}</span>
            </div>
          </div>
        </div>
        <div
          style="
            display: flex;
            justify-content: space-between;
            margin-top: 18px;
          "
        >
          <el-button type="default" @click="showResultDialog = false">
            返回
          </el-button>
          <el-button
            type="primary"
            @click="
              showResultDialog = false;
              reset();
            "
          >
            再来一局
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>

  <!-- =================== 顶部栏 =================== -->
  <div class="topPositionFixed">
    <div class="header-content">
      <el-button
        class="logout-button"
        style="width: auto"
        :disabled="hintCount >= maxHints"
        @click="doHint"
      >
        提示 ({{ maxHints - hintCount }})
      </el-button>
      <el-button
        :style="{ background: effectiveFlagMode ? '#5282b8' : '#5c8f4b', width: 'auto' }"
        class="flag-switch-button"
        @click="flagMode = !flagMode"
      >
        {{ effectiveFlagMode ? '标记' : '挖开' }}模式
        <kbd class="key-hint">{{ keybinds.flagMode }}</kbd>
        <span v-if="spaceHeld" class="space-held-hint">[Space]</span>
      </el-button>

      <el-button class="theme-switch-button" @click="toggleTheme">
        {{ currentTheme === 'wom' ? 'WOM' : '巧克力' }}
      </el-button>

      <el-button class="cursor-mode-button" @click="togglePlayerCursorMode">
        {{
          playerCursorMode === 'full'
            ? '👤 玩家'
            : playerCursorMode === 'avatar'
              ? '👤 仅头像'
              : '👤 隐藏'
        }}
      </el-button>

      <!-- 道具快捷键按钮 -->
      <el-button
        v-if="hasProp(101)"
        :style="{
          width: 'auto',
          background: usingPropId === 101 ? '#faad14' : '',
        }"
        @click="startUseProp(101)"
      >
        探测仪 <kbd class="key-hint">{{ keybinds.detector }}</kbd>
      </el-button>
      <el-button
        v-if="hasProp(102)"
        :style="{
          width: 'auto',
          background: usingPropId === 102 ? '#faad14' : '',
        }"
        @click="startUseProp(102)"
      >
        雷之奥义 <kbd class="key-hint">{{ keybinds.xjbd }}</kbd>
      </el-button>

      <!-- 冷却计时 -->
      <div v-if="cdRemaining > 0" class="cd-indicator">
        ⏳ CD {{ cdRemaining.toFixed(1) }}s
      </div>

      <!-- 双倍/护盾激活指示器 -->
      <div style="display: flex; gap: 8px; align-items: center">
        <span v-if="shieldActive" class="buff-indicator buff-shield">
          🛡 护盾 x{{ shieldCount }}
        </span>
        <span v-if="doubleScoreActive" class="buff-indicator buff-double">
          ⚡ 双倍 {{ doubleRemaining.toFixed(1) }}s
        </span>
      </div>

      <div class="safe-cells-indicator">
        剩余安全格子
        <span class="safe-cells-count">{{ remainingSafeCells }}</span>
      </div>
      <div class="timeWatcher">
        {{ timeWatcher }}
      </div>
    </div>
    <ScoreTip ref="scoreTip" class="scoreTipParent" />
  </div>

  <!-- =================== 主体 =================== -->
  <div class="main-layout">
    <div class="left-panel">
      <ScoreBoard
        v-if="Object.keys(scoreBoard).length > 0"
        :score-board="scoreBoard"
      />
    </div>

    <div class="center-panel">
      <!-- 冷却遮罩 -->
      <div v-if="isBlocked" class="cd-overlay-dialog">
        <div class="cd-overlay-card">
          <span class="cd-overlay-title">冷却中</span>
          <div class="cd-progress-bar">
            <div class="cd-progress-fill" :style="{ width: `${cdPercent}%` }" />
          </div>
          <span class="cd-overlay-time">{{ cdRemaining.toFixed(1) }}s</span>
        </div>
      </div>

      <el-scrollbar>
        <div
          v-if="minefield.Width > 0"
          :style="{
            gridTemplateColumns: `repeat(${minefield.Width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${minefield.Height}, ${cellSize}px)`,
          }"
          class="board"
        >
          <div
            v-for="(cell, index) in minefield.Cell"
            :key="index"
            class="cell-wrapper"
            :style="{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
            }"
          >
            <!-- 格子图片 -->
            <div
              :style="{
                backgroundImage: `url(${getImageSrc(cell)})`,
                width: '100%',
                height: '100%',
                backgroundSize: 'cover',
              }"
              class="cell"
              @mousedown="(event) => handleClick(event, index)"
            />

            <!-- CD 遮罩 -->
            <div v-if="isBlocked" class="cd-overlay" />

            <!-- 红区遮罩 (只能打开不能插旗) -->
            <div v-if="isInNoFlagZone(index)" class="no-flag-zone-overlay" />

            <!-- 黄区遮罩 (高分区域) -->
            <div
              v-if="isInHighScoreZone(index)"
              class="high-score-zone-overlay"
            />

            <!-- 探测仪 5x5 高亮 -->
            <div
              v-if="isInDetectorRange(index)"
              class="detector-highlight"
              :class="{
                'detector-highlight-mine': cell.IsMine && !cell.IsOpen,
              }"
            />

            <!-- 雷之奥义 7x7 区域闪烁 -->
            <div v-if="isInXjbdRange(index)" class="xjbd-highlight" />
          </div>

          <!-- 其他玩家光标 (绝对定位, 带移动过渡) -->
          <template v-for="(cursor, uid) in playerCursors" :key="uid">
            <div
              v-if="showPlayerCursors && uid !== currentUid"
              class="player-cursor"
              :class="{ 'player-cursor--init': !cursorInitialized(uid) }"
              :style="playerCursorStyle(cursor)"
            >
              <img
                :src="resolveImageUrl(cursor.avatar)"
                class="player-cursor-avatar"
              >
              <span v-if="showPlayerNames" class="player-cursor-name">{{
                cursor.name
              }}</span>
            </div>
          </template>

          <!-- 轨迹粒子 -->
          <template v-if="showPlayerCursors">
            <div
              v-for="trail in trails"
              :key="trail.id"
              class="trail-particle"
              :style="trailStyle(trail)"
            >
              <img :src="resolveImageUrl(trail.avatar)" class="trail-avatar">
            </div>
          </template>
        </div>
      </el-scrollbar>
    </div>
  </div>

  <!-- =================== 道具栏 (左下角固定) =================== -->
  <div class="prop-bar-fixed">
    <PropBar
      :props="myPropsList"
      :using-prop-id="usingPropId"
      :cd-remaining="cdRemaining"
      :active-effects="activeEffects"
      @use-prop="startUseProp"
    />
  </div>

  <!-- =================== 观战加入栏 =================== -->
  <div v-if="!isJoined" class="join-bar">
    <span>您当前处于观战状态</span>
    <el-button type="primary" @click="handleJoin">
      加入乱斗
    </el-button>
  </div>
</template>

<style scoped>
/* ===== 顶部栏 ===== */
.topPositionFixed {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 16px 6px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.header-content {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}
.flag-switch-button {
  color: #fff !important;
  border: none !important;
  font-weight: 700;
  transition: all 0.25s;
}
.theme-switch-button {
  width: 5.5rem;
  background: #7c5c3c !important;
  color: #f5e6d3 !important;
  border: none !important;
  font-weight: 700;
  font-size: 12px;
  transition: all 0.25s;
}
.theme-switch-button:hover {
  background: #9b7353 !important;
}
/* CD / Buff 指示器 */
.cd-indicator {
  color: #f87171;
  font-weight: 700;
  font-size: 15px;
  min-width: 115px;
  text-align: center;
  flex-shrink: 0;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  background: rgba(248, 113, 113, 0.1);
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid rgba(248, 113, 113, 0.2);
}
.buff-indicator {
  font-size: 13px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  white-space: nowrap;
  min-width: 110px;
  text-align: center;
  flex-shrink: 0;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}
.buff-shield {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.2);
}
.buff-double {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.2);
}
.safe-cells-indicator {
  font-size: 14px;
  font-weight: 600;
  color: #a5d6a7;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  margin-left: 8px;
  padding: 4px 12px;
  background: rgba(165, 214, 167, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(165, 214, 167, 0.15);
  white-space: nowrap;
}
.safe-cells-count {
  color: #66bb6a;
  font-size: 18px;
  font-weight: 800;
}
.timeWatcher {
  font-size: 28px;
  font-weight: 800;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
  color: #5eead4;
  margin-left: 16px;
  text-shadow: 0 0 16px rgba(94, 234, 212, 0.3);
  width: 110px;
  text-align: center;
  flex-shrink: 0;
}
.scoreTipParent {
  height: 0;
  overflow: visible;
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}
/* 道具栏 — 左下角固定, 不占布局空间 */
.prop-bar-fixed {
  position: fixed;
  bottom: 50px;
  left: 16px;
  z-index: 100;
}

/* 观战加入栏 */
.join-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  padding: 12px 24px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 200;
  color: white;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* ===== 主体 ===== */
.main-layout {
  display: flex;
  justify-content: center;
  gap: 16px;
  height: calc(100vh - 112px);
  max-width: 100vw;
  padding: 10px 12px;
}
.left-panel {
  width: 235px;
  flex-shrink: 0;
  overflow-y: auto;
  border-radius: 12px;
}
.center-panel {
  position: relative;
  flex-grow: 1;
  display: flex;
  justify-content: flex-start;
  padding-left: 8px;
  max-width: calc(100% - 275px);
}

/* ===== 冷却遮罩 ===== */
.cd-overlay-dialog {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  pointer-events: all;
}
.cd-overlay-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 36px;
  background: rgba(20, 20, 30, 0.92);
  border-radius: 12px;
  border: 1px solid rgba(255, 100, 100, 0.25);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
}
.cd-overlay-title {
  font-size: 18px;
  font-weight: 700;
  color: #f66;
}
.cd-progress-bar {
  width: 200px;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.cd-progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f66, #fa0);
  transition: width 0.1s linear;
}
.cd-overlay-time {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

/* ===== 棋盘 ===== */
.board {
  position: relative;
  display: grid;
  padding: 8px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.cell-wrapper {
  position: relative;
  transition: transform 0.1s;
}
.cell-wrapper:active {
  transform: scale(0.92);
}
.cell {
  background-size: cover;
  box-sizing: border-box;
  cursor: pointer;
  image-rendering: pixelated;
  border-radius: 2px;
}
.cell:hover {
  filter: brightness(1.25) saturate(1.1);
  z-index: 1;
}

/* ===== 玩家光标 ===== */
.player-cursor {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
  transition:
    left 0.35s ease,
    top 0.35s ease;
}
.player-cursor--init {
  transition: none;
  animation: cursor-pop-in 0.3s ease-out;
}
.player-cursor-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #ffd700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  object-fit: cover;
  background: #333;
}
.player-cursor-name {
  font-size: 9px;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  margin-top: 1px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes cursor-pop-in {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  60% {
    transform: translate(-50%, -50%) scale(1.15);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

/* ===== 轨迹粒子 ===== */
.trail-particle {
  position: absolute;
  z-index: 9;
  pointer-events: none;
  animation: trail-fly 0.5s ease-out forwards;
}
.trail-avatar {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 215, 0, 0.5);
  object-fit: cover;
  background: #333;
  opacity: 0.7;
}

@keyframes trail-fly {
  0% {
    transform: translate(
      calc(var(--trail-from-x) - var(--trail-to-x, 0px)),
      calc(var(--trail-from-y) - var(--trail-to-y, 0px))
    );
    opacity: 0.8;
  }
  100% {
    transform: translate(0, 0);
    opacity: 0;
  }
}

/* ===== 快捷键提示 ===== */
.key-hint {
  display: inline-block;
  font-size: 10px;
  font-family: inherit;
  padding: 1px 6px;
  margin-left: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #aaa;
  line-height: 1.5;
  vertical-align: middle;
}

/* ===== 遮罩层 ===== */
/* CD 冷却 — 红色扫描线 */
.cd-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 60, 60, 0.12) 0px,
    rgba(255, 60, 60, 0.12) 2px,
    transparent 2px,
    transparent 8px
  );
  pointer-events: none;
  z-index: 10;
  border-radius: 2px;
}

/* 红区 — 禁止标记 */
.no-flag-zone-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 50, 50, 0.45);
  pointer-events: none;
  z-index: 5;
  border-radius: 2px;
}

/* 黄区 — 高分区 */
.high-score-zone-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 200, 50, 0.3);
  pointer-events: none;
  z-index: 4;
  border-radius: 2px;
}

/* 探测仪 5x5 */
.detector-highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 230, 120, 0.22);
  pointer-events: none;
  z-index: 5;
  border-radius: 2px;
  box-shadow: inset 0 0 8px rgba(0, 230, 120, 0.15);
}
.detector-highlight-mine {
  background: rgba(255, 80, 40, 0.55);
  border: 1.5px dashed rgba(255, 80, 40, 0.9);
  box-shadow: inset 0 0 10px rgba(255, 80, 40, 0.3);
}

/* 雷之奥义 7x7 — 紫光闪烁 */
.xjbd-highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(140, 60, 255, 0.28);
  pointer-events: none;
  z-index: 6;
  border-radius: 2px;
  animation: xjbd-flash 0.35s ease-in-out infinite alternate;
}
@keyframes xjbd-flash {
  from {
    background: rgba(140, 60, 255, 0.18);
    box-shadow: inset 0 0 6px rgba(140, 60, 255, 0.2);
  }
  to {
    background: rgba(140, 60, 255, 0.45);
    box-shadow: inset 0 0 14px rgba(140, 60, 255, 0.4);
  }
}
</style>
