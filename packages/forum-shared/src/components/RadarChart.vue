<script setup lang="ts">
import { computed, ref } from 'vue'
import iconMinesweeper from '../../../../icons/ic_game_minesweeper.webp'
import iconNonosweeper from '../../../../icons/ic_game_nonosweeper.png'
import iconPuzzle from '../../../../icons/ic_game_puzzle.webp'
import iconSchulte from '../../../../icons/ic_game_schulte.webp'
import icon2048 from '../../../../icons/ic_game_sudoku_small.webp'
import iconTzfe from '../../../../icons/ic_game_tzfe.webp'

const props = withDefaults(defineProps<{
  ranks?: number[]
}>(), {
  ranks: () => [3000, 3000, 3000, 3000, 3000, 3000],
})

const LABELS = ['扫雷', '舒尔特', '华容道', '2048', '数独', '数织']
const GAME_ICONS = [iconMinesweeper, iconSchulte, iconPuzzle, iconTzfe, icon2048, iconNonosweeper]
const ICON_SIZE = 24

// ---- layout constants ----
const CX = 150
const CY = 150
const MAX_R = 110
const GRID_LEVELS = [1, 2, 3, 4, 5]

// ---- score computation ----
function computeScore(rank: number): number {
  let r = rank
  if (r === 0) {
    r = 3000
  }
  if (r < 1) {
    r = 1
  }
  if (r <= 10) {
    return 5 - (r - 1) / 36
  }
  return Math.max(0, 5 - 0.25 * (Math.log10(r)) ** 2)
}

const scores = computed(() => props.ranks.map(r => computeScore(r)))
const totalScore = computed(() => scores.value.reduce((a, b) => a + b, 0))

// ---- geometry helpers ----
/** 第 i 个轴的角度（弧度），从12点方向顺时针 */
function getAngle(i: number): number {
  return -Math.PI / 2 + i * (Math.PI / 3)
}

function polarToCartesian(r: number, i: number) {
  return {
    x: CX + r * Math.cos(getAngle(i)),
    y: CY + r * Math.sin(getAngle(i)),
  }
}

function polygonPoints(radii: number[]): string {
  return radii.map((r, i) => {
    const { x, y } = polarToCartesian(r, i)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

// ---- grid polygons (5层同心六边形) ----
const gridPolygons = computed(() =>
  GRID_LEVELS.map(level => polygonPoints(Array.from<number>({ length: 6 }).fill((level / 5) * MAX_R))),
)

// ---- 轴线（中心到6个顶点） ----
const axisEndpoints = computed(() =>
  Array.from({ length: 6 }, (_, i) => {
    const { x, y } = polarToCartesian(MAX_R, i)
    return { x: x.toFixed(1), y: y.toFixed(1) }
  }),
)

// ---- 数据多边形 ----
const dataRadii = computed(() => scores.value.map(s => (s / 5) * MAX_R))
const dataPolygonPoints = computed(() => polygonPoints(dataRadii.value))
const dataVertices = computed(() =>
  dataRadii.value.map((r, i) => ({ ...polarToCartesian(r, i), index: i })),
)

// ---- 轴标签 ----
function getLabelAnchor(i: number): string {
  const deg = getAngle(i) * (180 / Math.PI)
  if (deg < -85 && deg > -95) {
    return 'middle'
  }
  else if (deg > 85 && deg < 95) {
    return 'middle'
  }
  else if (deg > -5 && deg < 5) {
    return 'start'
  }
  else if (deg > 175 || deg < -175) {
    return 'end'
  }
  else if (deg > 0) {
    return 'start'
  }
  return 'end'
}

function getLabelDy(i: number): string {
  const deg = getAngle(i) * (180 / Math.PI)
  if (deg < -85 && deg > -95) {
    return '-0.4em'
  }
  if (deg > 85 && deg < 95) {
    return '1.1em'
  }
  return '0.35em'
}

// 单个标签微调偏移（像素）
const LABEL_R_OFFSETS: Record<number, number> = {
  1: 0, // 舒尔特：往右移
  2: 0, // 华容道：往左移
  4: 20, // 数独：往左移
  5: 20, // 数织：往右移
}

const LABEL_Y_OFFSETS: Record<number, number> = {
  0: 0, // 扫雷：不动
  1: 10, // 舒尔特：往上移
  2: 10, // 华容道：往下移
  3: 0, // 2048：往下移
  4: 0, // 数独：往上移
  5: 10, // 数织：不动
}

const labelItems = computed(() =>
  LABELS.map((label, i) => {
    const r = MAX_R + 22 + (LABEL_R_OFFSETS[i] || 0)
    const { x, y } = polarToCartesian(r, i)
    return {
      label,
      index: i,
      icon: GAME_ICONS[i],
      x: x.toFixed(1),
      y: (y + (LABEL_Y_OFFSETS[i] || 0)).toFixed(1),
      anchor: getLabelAnchor(i),
      dy: getLabelDy(i),
    }
  }),
)

// ---- tooltip ----
const hoveredIndex = ref<number | null>(null)
const tooltipCx = ref(0)
const tooltipCy = ref(0)

function onPointEnter(index: number) {
  hoveredIndex.value = index
  const v = dataVertices.value[index]
  tooltipCx.value = v.x
  tooltipCy.value = v.y
}

function onPointLeave() {
  hoveredIndex.value = null
}
</script>

<template>
  <div class="radar-section">
    <div class="radar-wrapper">
      <svg
        viewBox="0 0 300 360"
        xmlns="http://www.w3.org/2000/svg"
        class="radar-svg"
      >
        <defs>
          <linearGradient
            id="areaGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stop-color="#fa7299" stop-opacity="0.35" />
            <stop offset="45%" stop-color="#fa7299" stop-opacity="0.18" />
            <stop offset="100%" stop-color="#fa7299" stop-opacity="0.05" />
          </linearGradient>
        </defs>

        <!-- 网格多边形 -->
        <polygon
          v-for="(pts, idx) in gridPolygons"
          :key="`grid-${idx}`"
          :points="pts"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          stroke-width="1"
        />

        <!-- 轴线 -->
        <line
          v-for="(p, idx) in axisEndpoints"
          :key="`axis-${idx}`"
          x1="150"
          y1="150"
          :x2="p.x"
          :y2="p.y"
          stroke="#444444"
          stroke-width="1"
        />

        <!-- 数据多边形 -->
        <polygon
          :points="dataPolygonPoints"
          fill="url(#areaGradient)"
          stroke="#fa7299"
          stroke-width="2.5"
          stroke-linejoin="round"
        />

        <!-- 数据点 -->
        <circle
          v-for="v in dataVertices"
          :key="`pt-${v.index}`"
          :cx="v.x.toFixed(1)"
          :cy="v.y.toFixed(1)"
          :r="hoveredIndex === v.index ? 9 : 5"
          :fill="hoveredIndex === v.index ? '#ffffff' : '#fa7299'"
          :stroke="hoveredIndex === v.index ? '#fa7299' : '#252525'"
          stroke-width="2"
          style="cursor: pointer; transition: r 0.15s, fill 0.15s, stroke 0.15s;"
          @mouseenter="onPointEnter(v.index)"
          @mouseleave="onPointLeave"
        />

        <!-- 轴标签（图标 + 分数） -->
        <g v-for="item in labelItems" :key="`label-${item.label}`">
          <image
            v-if="item.icon"
            :href="item.icon"
            :x="(Number(item.x) - ICON_SIZE / 2).toFixed(1)"
            :y="(Number(item.y) - ICON_SIZE / 2).toFixed(1)"
            :width="ICON_SIZE"
            :height="ICON_SIZE"
          />
          <text
            v-else
            :x="item.x"
            :y="item.y"
            :text-anchor="item.anchor"
            :dy="item.dy"
            fill="#cccccc"
            font-weight="bold"
            font-size="13"
          >
            {{ item.label }}
          </text>
          <text
            :x="(Number(item.x) + ICON_SIZE / 2 + 4).toFixed(1)"
            :y="item.y"
            text-anchor="start"
            dy="0.35em"
            fill="#cccccc"
            font-size="11"
          >
            {{ (scores[item.index]).toFixed(2) }}
          </text>
        </g>
        <!-- 总分 -->
        <text
          x="150"
          y="340"
          text-anchor="middle"
          fill="#fa7299"
          font-weight="bold"
          font-size="15"
        >
          综合评分 {{ (totalScore * 100 / 30).toFixed(2) }}
        </text>
      </svg>

      <!-- tooltip -->
      <div
        v-show="hoveredIndex !== null"
        class="radar-tooltip"
        :style="{
          left: `${(tooltipCx / 300) * 100}%`,
          top: `${(tooltipCy / 300) * 100}%`,
        }"
      >
        {{ hoveredIndex !== null ? `${LABELS[hoveredIndex]} : ${(scores[hoveredIndex]).toFixed(2)} / 5` : '' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.radar-section {
  padding: 8px 10px;
  border-bottom: 8px solid #1e1e1e;
}

.radar-wrapper {
  position: relative;
  width: 100%;
  max-width: 350px;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
}

.radar-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.radar-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  pointer-events: none;
  white-space: nowrap;
  background: #2a2a2a;
  color: #cccccc;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #555555;
  font-size: 13px;
  z-index: 10;
}
</style>
