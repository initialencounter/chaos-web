import { computed, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import {
  easeInOutQuad,
  fmtDate,
  fmtTime,
  lerp,
  roundRect,
  uidToColor,
} from '@/utils/helpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerData {
  uid: string
  name: string
  avatar: string | null
  values: (number | null)[]
}

export interface RaceData {
  meta: {
    totalPlayers: number
    totalDates: number
    dateRange: [string, string]
  }
  dates: string[]
  players: PlayerData[]
}

interface InterpolatedPlayer {
  uid: string
  name: string
  avatar: string | null
  value: number
}

interface VisualState {
  vy: number
  vw: number
  ty: number
  tw: number
  _leaving?: boolean
}

// ---------------------------------------------------------------------------
// Constants (tunable but kept as constants for this composable)
// ---------------------------------------------------------------------------

export const TOP_N = 50
const INTERP_STEPS = 6
const BAR_HEIGHT = 16
const BAR_GAP = 1.5
const AVATAR_SIZE = 13
const NAME_FONT_SIZE = 9
const TIME_FONT_SIZE = 8
const RANK_FONT_SIZE = 7
const BAR_RADIUS = 2
const LERP_SPEED = 0.32

const BG_COLOR = '#1A1A2E'
const TEXT_COLOR = '#EAEAEA'
const ACCENT_COLOR = '#E94560'
const MUTED_COLOR = 'rgba(234,234,234,0.35)'
const GOLD_COLOR = '#FFC107'

// ---------------------------------------------------------------------------
// useBarChartRace
// ---------------------------------------------------------------------------

export function useBarChartRace(
  canvasRef: Readonly<ReturnType<typeof ref<HTMLCanvasElement | null>>>,
  canvasWrapRef: Readonly<ReturnType<typeof ref<HTMLElement | null>>>,
) {
  // ---- Reactive state ----
  const data = shallowRef<RaceData | null>(null)
  const avatars = shallowRef<Record<string, HTMLImageElement | null>>({})
  const playing = ref(false)
  const speed = ref(1)
  const animationProgress = ref(0)
  const totalFrames = ref(0)
  const visualState = reactive<Record<string, VisualState>>({})
  const loading = ref(true)
  const error = ref<string | null>(null)
  const dpr = ref(1)
  const needsSnap = ref(true)
  let currentXMin = 0
  let currentXMax = 0
  let fixedXMin = 0
  let fixedXMax = 0
  let lastRAF: number | null = null

  // ---- Computed ----
  const dateBadge = computed(() => {
    if (!data.value)
      return '--'
    const effectiveProgress = animationProgress.value / INTERP_STEPS
    const idx = Math.min(Math.floor(effectiveProgress), data.value.dates.length - 1)
    return fmtDate(data.value.dates[idx] ?? '')
  })

  const frameLabel = computed(() => {
    if (!data.value)
      return '0 / 0'
    const effectiveProgress = animationProgress.value / INTERP_STEPS
    const idx = Math.min(Math.floor(effectiveProgress), data.value.dates.length - 1)
    return `${idx + 1} / ${data.value.dates.length}`
  })

  const infoPlayers = computed(() => {
    if (!data.value)
      return ''
    return `${data.value.meta.totalPlayers} 位玩家 · ${data.value.meta.totalDates} 天`
  })

  const progressPercent = computed(() => {
    if (totalFrames.value <= 1)
      return 0
    return (animationProgress.value / (totalFrames.value - 1)) * 100
  })

  // ---- Layout helpers (depend on canvas size) ----
  function getCanvasCtx() {
    const canvas = canvasRef.value
    if (!canvas)
      return null
    return canvas.getContext('2d')
  }

  function getLayout() {
    const canvas = canvasRef.value
    if (!canvas)
      return { w: 0, h: 0, padTop: 0, padBottom: 0, padLeft: 0, padRight: 0, chartW: 0 }
    const w = canvas.width / dpr.value
    const h = canvas.height / dpr.value
    const padTop = 66
    const padBottom = 28
    const padLeft = 42
    const padRight = 80
    const chartW = w - padLeft - padRight
    return { w, h, padTop, padBottom, padLeft, padRight, chartW }
  }

  // ---- Canvas sizing ----
  function resizeCanvas() {
    const canvas = canvasRef.value
    const wrap = canvasWrapRef.value
    if (!canvas || !wrap)
      return

    dpr.value = window.devicePixelRatio || 1
    const wrapWidth = wrap.clientWidth
    const totalBarsHeight = TOP_N * BAR_HEIGHT + (TOP_N - 1) * BAR_GAP
    const paddingTop = 66
    const paddingBottom = 28
    const height = totalBarsHeight + paddingTop + paddingBottom

    canvas.width = wrapWidth * dpr.value
    canvas.height = height * dpr.value - 45
    canvas.style.width = `${wrapWidth}px`
    canvas.style.height = `${height}px`

    const ctx = getCanvasCtx()
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr.value, dpr.value)
    }
  }

  // ---- Data loading ----
  async function loadData(): Promise<RaceData> {
    const resp = await fetch('race_data.json')
    if (!resp.ok)
      throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  function preloadAvatars(players: PlayerData[]): Promise<Record<string, HTMLImageElement | null>> {
    const toLoad = players.filter(p => p.avatar)
    if (toLoad.length === 0)
      return Promise.resolve({})

    return new Promise((resolve) => {
      const result: Record<string, HTMLImageElement | null> = {}
      let pending = toLoad.length
      for (const p of toLoad) {
        const img = new Image()
        img.onload = () => {
          result[p.uid] = img
          pending--
          if (pending === 0)
            resolve(result)
        }
        img.onerror = () => {
          result[p.uid] = null
          pending--
          if (pending === 0)
            resolve(result)
        }
        img.src = p.avatar!
      }
    })
  }

  // ---- Interpolate player values at a given progress ----
  function getInterpolatedValues(progress: number): InterpolatedPlayer[] {
    const d = data.value!
    const dates = d.dates
    const players = d.players
    const effectiveProgress = progress / INTERP_STEPS
    const dateIdx = Math.floor(effectiveProgress)
    const t = effectiveProgress - dateIdx

    if (dateIdx >= dates.length - 1) {
      return players
        .map((p) => {
          const v = p.values[dates.length - 1]
          return v !== null ? { uid: p.uid, name: p.name, avatar: p.avatar, value: v } : null
        })
        .filter((x): x is InterpolatedPlayer => x !== null)
        .sort((a, b) => a.value - b.value)
    }

    const tEased = easeInOutQuad(t)
    return players
      .map((p) => {
        const v0 = p.values[dateIdx]
        const v1 = p.values[dateIdx + 1]
        if (v0 !== null && v1 !== null) {
          return { uid: p.uid, name: p.name, avatar: p.avatar, value: v0 + (v1 - v0) * tEased }
        }
        else if (v0 !== null) {
          return { uid: p.uid, name: p.name, avatar: p.avatar, value: v0 }
        }
        else if (v1 !== null) {
          return { uid: p.uid, name: p.name, avatar: p.avatar, value: v1 + (1 - tEased) * 999 }
        }
        return null
      })
      .filter((x): x is InterpolatedPlayer => x !== null)
      .sort((a, b) => a.value - b.value)
  }

  // ---- Update visual targets ----
  function updateVisualTargets(sorted: InterpolatedPlayer[]) {
    const { padTop, chartW, padRight, padLeft } = getLayout()
    const rowH = BAR_HEIGHT + BAR_GAP
    const totalH = TOP_N * rowH
    const currentUids = new Set<string>()

    // While the leaderboard is still filling up (fewer than TOP_N players),
    // pin to a precomputed fixed scale so bars don't jump around as new
    // players enter. Once full, lerp the scale for smooth transitions.
    if (sorted.length < TOP_N && (fixedXMin !== 0 || fixedXMax !== 0)) {
      // Board not full yet — pin to fixed scale
      currentXMin = fixedXMin
      currentXMax = fixedXMax
    }
    else {
      const tMax = sorted.length > 0 ? sorted[sorted.length - 1]!.value : 0
      const tMin = sorted.length > 0 ? sorted[0]!.value : 0
      const tRange = tMax - tMin || 10
      const targetXMax = tMax + tRange * 0.15
      const targetXMin = Math.max(0, tMin - tRange * 0.25)

      if (currentXMax === 0 && currentXMin === 0) {
        currentXMin = targetXMin
        currentXMax = targetXMax
      }
      else {
        const SCALE_LERP = 0.08
        currentXMin = lerp(currentXMin, targetXMin, SCALE_LERP)
        currentXMax = lerp(currentXMax, targetXMax, SCALE_LERP)
      }
    }

    const xMin = currentXMin
    const xMax = currentXMax

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]!
      currentUids.add(p.uid)
      const targetY = padTop + i * rowH
      const barWidth = ((p.value - xMin) / (xMax - xMin)) * (chartW - padRight + padLeft + 8)
      const targetW = Math.max(barWidth, 4)

      if (!visualState[p.uid]) {
        visualState[p.uid] = {
          vy: padTop + totalH + 40,
          vw: targetW,
          ty: targetY,
          tw: targetW,
        }
      }
      else {
        visualState[p.uid]!.ty = targetY
        visualState[p.uid]!.tw = targetW
      }
    }

    // Mark players leaving the chart
    for (const uid of Object.keys(visualState)) {
      if (!currentUids.has(uid)) {
        const vs = visualState[uid]!
        if (!vs._leaving) {
          vs._leaving = true
          vs.ty = padTop + totalH + 40
          vs.tw = 0
        }
      }
    }
  }

  // ---- Lerp visual state toward targets ----
  function tickVisualState() {
    const toDelete: string[] = []
    const { padTop } = getLayout()
    const totalH = TOP_N * (BAR_HEIGHT + BAR_GAP)

    for (const [uid, vs] of Object.entries(visualState)) {
      vs.vy = lerp(vs.vy, vs.ty, LERP_SPEED)
      vs.vw = lerp(vs.vw, vs.tw, LERP_SPEED)

      if (vs._leaving) {
        if (vs.vy > padTop + totalH + 30 || (Math.abs(vs.vy - vs.ty) < 0.3 && vs.vy > padTop + totalH)) {
          toDelete.push(uid)
        }
      }
    }
    for (const uid of toDelete) delete visualState[uid]
  }

  // ---- Snap visual state to targets (for seeking) ----
  function snapVisualState() {
    for (const vs of Object.values(visualState)) {
      vs.vy = vs.ty
      vs.vw = vs.tw
    }
    for (const uid of Object.keys(visualState)) {
      if (visualState[uid]!._leaving)
        delete visualState[uid]
    }
    // Reset scale so it re-initializes from the next frame's visible range
    currentXMin = 0
    currentXMax = 0
  }

  // ---- Render ----
  function render(progress: number) {
    const ctx = getCanvasCtx()
    const d = data.value
    if (!ctx || !d)
      return

    const { w, h, padTop, padLeft, padRight, chartW } = getLayout()

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, w, h)

    // Title area — positioned within top padding, everything adapts to padTop
    const titleRight = w - padRight
    const titleFontSize = Math.round(padTop * 0.33)
    const subFontSize = Math.round(padTop * 0.17)
    const dateFontSize = Math.round(padTop * 0.24)
    const titleLineH = Math.round(padTop * 0.38)
    const titleBaseY = Math.round(padTop * 0.55)

    // Title — 右上角
    ctx.fillStyle = TEXT_COLOR
    ctx.font = `700 ${titleFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('扫雷三模式总时间排行榜', titleRight, titleBaseY)

    // Subtitle
    ctx.fillStyle = MUTED_COLOR
    ctx.font = `${subFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('高级+中级+初级 最佳时间之和 | 时间越短排名越高', titleRight, titleBaseY + titleLineH)

    const effectiveProgress = progress / INTERP_STEPS
    const dateIdx = Math.min(Math.floor(effectiveProgress), d.dates.length - 1)
    const dateStr = d.dates[dateIdx] ?? ''
    ctx.fillStyle = ACCENT_COLOR
    ctx.font = `700 ${dateFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(fmtDate(dateStr), titleRight, titleBaseY + titleLineH * 2)

    // Sorted players
    const sorted = getInterpolatedValues(progress).slice(0, TOP_N)
    if (sorted.length === 0)
      return

    // Update target positions
    updateVisualTargets(sorted)

    if (needsSnap.value) {
      snapVisualState()
      needsSnap.value = false
    }

    // Build uid→rank lookup
    const rankMap: Record<string, number> = {}
    sorted.forEach((p, i) => {
      rankMap[p.uid] = i + 1
    })

    // Sort entries bottom-to-top so upper bars overlap lower bars
    const totalH = TOP_N * BAR_HEIGHT + (TOP_N - 1) * BAR_GAP
    const entries = Object.entries(visualState)
      .filter(([, vs]) => !vs._leaving || vs.vy < padTop + totalH + 40)
      .sort(([, a], [, b]) => b.vy - a.vy)

    const barX = padLeft
    const avatarImgs = avatars.value

    for (const [uid, vs] of entries) {
      const player = sorted.find(p => p.uid === uid)
      const name = player?.name ?? (d.players.find(p => p.uid === uid)?.name ?? uid)
      const rank = rankMap[uid] ?? '--'
      const isTop1 = rank === 1

      const barY = vs.vy - 40
      const barW = Math.max(vs.vw, 3)
      const barH = BAR_HEIGHT

      // Opacity: fade in from bottom, fade out to bottom
      let opacity = 1
      if (vs.vy > padTop + totalH) {
        opacity = Math.max(0, 1 - (vs.vy - padTop - totalH) / 30)
      }
      if (vs.vy < padTop) {
        opacity = Math.max(0, 1 - (padTop - vs.vy) / 16)
      }
      ctx.globalAlpha = 0.88 * opacity

      // Bar
      ctx.fillStyle = isTop1 ? GOLD_COLOR : uidToColor(uid)
      roundRect(ctx, barX, barY, barW, barH, BAR_RADIUS)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 0.4
      roundRect(ctx, barX, barY, barW, barH, BAR_RADIUS)
      ctx.stroke()

      ctx.globalAlpha = opacity

      // Avatar
      const avatarImg = avatarImgs[uid]
      const avatarX = barX + 2
      const avatarY = barY + (BAR_HEIGHT - AVATAR_SIZE) / 2
      if (avatarImg && AVATAR_SIZE >= 10) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(avatarImg, avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE)
        ctx.restore()
      }

      // Rank number
      const rankX = barX - 5
      const rankY = barY + BAR_HEIGHT / 2
      ctx.fillStyle = isTop1 ? ACCENT_COLOR : MUTED_COLOR
      ctx.font = `${RANK_FONT_SIZE}px "Microsoft YaHei", sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`#${rank}`, rankX, rankY)
      ctx.textAlign = 'left'

      // Player name
      const nameX = barX + AVATAR_SIZE + 6
      const maxNameWidth = Math.max(50, chartW * 0.22)
      let displayName = name ?? uid
      ctx.font = `${NAME_FONT_SIZE}px "Microsoft YaHei", "PingFang SC", sans-serif`
      if (ctx.measureText(displayName).width > maxNameWidth) {
        while (displayName.length > 1 && ctx.measureText(`${displayName}…`).width > maxNameWidth) {
          displayName = displayName.slice(0, -1)
        }
        displayName += '…'
      }
      ctx.fillStyle = TEXT_COLOR
      ctx.textBaseline = 'middle'
      ctx.fillText(displayName, nameX, barY + BAR_HEIGHT / 2)

      // Time value
      if (player) {
        const timeX = barX + barW + 3
        ctx.fillStyle = TEXT_COLOR
        ctx.globalAlpha = 0.8 * opacity
        ctx.font = `${TIME_FONT_SIZE}px "Microsoft YaHei", sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(fmtTime(player.value), timeX, barY + BAR_HEIGHT / 2)
      }

      ctx.globalAlpha = 1
    }
  }

  // ---- Animation loop ----
  function tick(timestamp: number) {
    if (!lastRAF)
      lastRAF = timestamp
    const dt = Math.min((timestamp - lastRAF) / 1000, 0.1)
    lastRAF = timestamp

    if (playing.value) {
      const advance = speed.value * INTERP_STEPS * dt
      const nextProgress = animationProgress.value + advance

      if (nextProgress >= totalFrames.value - 1) {
        // Playback finished
        animationProgress.value = totalFrames.value - 1
        playing.value = false
        tickVisualState()
        render(animationProgress.value)
        lastRAF = null
        return
      }

      animationProgress.value = nextProgress
      tickVisualState()
    }

    render(animationProgress.value)

    if (playing.value) {
      requestAnimationFrame(tick)
    }
    else {
      lastRAF = null
    }
  }

  function startLoop() {
    if (lastRAF !== null)
      return
    lastRAF = null
    requestAnimationFrame(tick)
  }

  // ---- Controls ----
  function togglePlay() {
    if (animationProgress.value >= totalFrames.value - 1) {
      animationProgress.value = 0
      // Clear visual state on restart
      for (const key of Object.keys(visualState)) delete visualState[key]
      needsSnap.value = true
    }
    playing.value = !playing.value
    if (playing.value)
      startLoop()
  }

  function setSpeed(s: number) {
    speed.value = s
  }

  function seekTo(value: number) {
    animationProgress.value = (value / 100) * (totalFrames.value - 1)
    needsSnap.value = true
    // Reset visual state on seek
    for (const key of Object.keys(visualState)) delete visualState[key]
    render(animationProgress.value)
  }

  function stepBack() {
    animationProgress.value = Math.max(0, animationProgress.value - INTERP_STEPS)
    seekTo((animationProgress.value / (totalFrames.value - 1 || 1)) * 100)
  }

  function stepForward() {
    animationProgress.value = Math.min(totalFrames.value - 1, animationProgress.value + INTERP_STEPS)
    seekTo((animationProgress.value / (totalFrames.value - 1 || 1)) * 100)
  }

  // ---- Keyboard handler ----
  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        stepBack()
        break
      case 'ArrowRight':
        e.preventDefault()
        stepForward()
        break
      case '0':
        e.preventDefault()
        setSpeed(1)
        break
      case '1':
        e.preventDefault()
        setSpeed(0.5)
        break
      case '2':
        e.preventDefault()
        setSpeed(2)
        break
      case '4':
        e.preventDefault()
        setSpeed(4)
        break
    }
  }

  // ---- Init & cleanup ----
  async function init() {
    loading.value = true
    error.value = null
    try {
      const raceData = await loadData()
      data.value = raceData

      // Precompute the bar scale from the fully-populated top 50 across all
      // dates. Used as a fixed scale while the board is still filling up so
      // bars stay stable instead of jumping as new players enter.
      {
        let fMin = Infinity
        let fMax = -Infinity
        for (let di = 0; di < raceData.dates.length; di++) {
          const vals: number[] = []
          for (const p of raceData.players) {
            const v = p.values[di]
            if (v !== null)
              vals.push(v)
          }
          vals.sort((a, b) => a - b)
          if (vals.length >= TOP_N) {
            const topMin = vals[0]!
            const topMax = vals[TOP_N - 1]!
            if (topMin < fMin)
              fMin = topMin
            if (topMax > fMax)
              fMax = topMax
          }
        }
        if (fMin !== Infinity) {
          const fRange = fMax - fMin || 10
          fixedXMin = Math.max(0, fMin - fRange * 0.25)
          fixedXMax = fMax + fRange * 0.15
        }
      }

      totalFrames.value = (raceData.dates.length - 1) * INTERP_STEPS + 1

      resizeCanvas()

      // Load avatars
      avatars.value = await preloadAvatars(raceData.players)

      // Initial render at final frame
      animationProgress.value = totalFrames.value - 1
      needsSnap.value = true
      render(animationProgress.value)

      loading.value = false
    }
    catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      loading.value = false
      console.error('Load failed:', err)
    }
  }

  // Register lifecycle
  onMounted(() => {
    init()
    window.addEventListener('resize', handleResize)
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('keydown', handleKeydown)
  })

  function handleResize() {
    resizeCanvas()
    needsSnap.value = true
    render(animationProgress.value)
  }

  // Watch speed changes to update external DOM if needed (handled by template binding)

  return {
    // State (readonly from outside)
    playing,
    speed,
    animationProgress,
    totalFrames,
    loading,
    error,
    data,
    // Computed
    dateBadge,
    frameLabel,
    infoPlayers,
    progressPercent,
    // Methods
    togglePlay,
    setSpeed,
    seekTo,
    resizeCanvas,
  }
}
