<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  ranks?: number[]
}>(), {
  ranks: () => [3000, 3000, 3000, 3000, 3000, 3000],
})

const LABELS = ['扫雷', '舒尔特', '华容道', '2048', '数独', '数织']

// ---- layout constants ----
const CX = 150
const CY = 150
const MAX_R = 110
const GRID_LEVELS = [1, 2, 3, 4, 5]

// ---- score computation ----
function computeScore(rank: number): number {
  let r = rank
  if (r < 1) {
    r = 1
  }
  if (r <= 10) {
    return 5 - (r - 1) / 36
  }
  return Math.max(0, 5 - 0.25 * (Math.log10(r)) ** 2)
}

const scores = computed(() => props.ranks.map(r => computeScore(r)))

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
  1: 35, // 舒尔特：往右移
  2: -10, // 华容道：往左移
  4: 30, // 数独：往左移
}

const LABEL_Y_OFFSETS: Record<number, number> = {
  0: 10, // 扫雷：不动
  1: 20, // 舒尔特：往上移
  2: 2, // 华容道：往下移
  4: -20, // 数独：往上移
  3: -10, // 2048：往下移
}

const labelItems = computed(() =>
  LABELS.map((label, i) => {
    const r = MAX_R + 22 + (LABEL_R_OFFSETS[i] || 0)
    const { x, y } = polarToCartesian(r, i)
    return {
      label,
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
        viewBox="0 0 300 300"
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

        <!-- 轴标签 -->
        <text
          v-for="item in labelItems"
          :key="`label-${item.label}`"
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
        {{ hoveredIndex !== null ? `${LABELS[hoveredIndex]} : ${scores[hoveredIndex].toFixed(2)} / 5.00` : '' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.radar-section {
  padding: 16px 20px;
  border-bottom: 8px solid #1e1e1e;
}

.radar-wrapper {
  position: relative;
  width: 100%;
  max-width: 360px;
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
