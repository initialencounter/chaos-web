<script setup lang="ts">
import { ref } from 'vue'
import { useBarChartRace } from '@/composables/useBarChartRace'

// ---------------------------------------------------------------------------
// Refs for DOM elements handed to the composable
// ---------------------------------------------------------------------------
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapRef = ref<HTMLElement | null>(null)

const {
  playing,
  speed,
  loading,
  error,
  frameLabel,
  infoPlayers,
  progressPercent,
  togglePlay,
  setSpeed,
  seekTo,
} = useBarChartRace(canvasRef, canvasWrapRef)

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------
function playIcon() {
  if (playing.value)
    return '⏸' // ⏸
  return '▶' // ▶
}

const speedOptions = [0.5, 1, 2, 4]

function onProgressInput(e: Event) {
  const target = e.target as HTMLInputElement
  seekTo(Number.parseFloat(target.value))
}
</script>

<template>
  <div class="bar-chart-race">
    <!-- Header -->
    <div class="header" />

    <!-- Canvas -->
    <div ref="canvasWrapRef" class="canvas-wrap">
      <canvas ref="canvasRef" />

      <!-- Loading overlay -->
      <div v-if="loading" class="loading-overlay">
        <div class="spinner" />加载数据中...
      </div>

      <!-- Error overlay -->
      <div v-if="error" class="error-overlay">
        <p class="error-title">
          ⚠ 加载失败
        </p>
        <p class="error-msg">
          {{ error }}
        </p>
        <p class="error-hint">
          请使用 HTTP 服务器打开此页面：<br>
          <code>cd bar_chart_race && pnpm dev</code>
        </p>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button class="btn-play" :title="playing ? '暂停' : '播放'" @click="togglePlay">
        {{ playIcon() }}
      </button>

      <span class="speed-label">速度</span>
      <div class="speed-group">
        <button v-for="s in speedOptions" :key="s" :class="{ active: speed === s }" @click="setSpeed(s)">
          {{ s }}&times;
        </button>
      </div>

      <div class="progress-wrap">
        <input type="range" min="0" max="100" step="0.1" :value="progressPercent" @input="onProgressInput">
        <span class="frame-label">{{ frameLabel }}</span>
      </div>

      <span class="info-text">{{ infoPlayers }}</span>
    </div>

    <!-- Footer -->
    <div class="footer-note">
      高级+中级+初级 最佳时间之和 | 时间越短排名越高 | 数据每日更新
    </div>
  </div>
</template>

<style scoped>
.bar-chart-race {
  width: 100%;
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- Header ---- */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.date-badge {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e94560;
  background: rgba(233, 69, 96, 0.12);
  padding: 4px 16px;
  border-radius: 20px;
  white-space: nowrap;
}

/* ---- Canvas ---- */
.canvas-wrap {
  position: relative;
  background: #16213e;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

canvas {
  display: block;
  width: 100%;
  height: auto;
}

/* ---- Overlays ---- */
.loading-overlay,
.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #16213e;
  font-size: 1.2rem;
  color: rgba(234, 234, 234, 0.35);
}

.error-overlay {
  flex-direction: column;
  color: #e94560;
  text-align: center;
}

.error-title {
  font-size: 1.1rem;
  margin-bottom: 12px;
  color: #e94560;
}

.error-msg {
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.error-hint {
  font-size: 0.8rem;
  color: rgba(234, 234, 234, 0.35);
}

.error-hint code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: #e94560;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---- Controls ---- */
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: #16213e;
  color: #eaeaea;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;
  font-family: inherit;
}

button:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.35);
}

button:active {
  background: rgba(255, 255, 255, 0.04);
}

button.active {
  background: #e94560;
  border-color: #e94560;
  color: #fff;
}

.btn-play {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  font-size: 1.2rem;
}

.speed-label {
  color: rgba(234, 234, 234, 0.35);
  font-size: 0.8rem;
}

.speed-group {
  display: flex;
  gap: 0;
}

.speed-group button {
  border-radius: 0;
  margin-left: -1px;
}

.speed-group button:first-child {
  border-radius: 8px 0 0 8px;
  margin-left: 0;
}

.speed-group button:last-child {
  border-radius: 0 8px 8px 0;
}

.progress-wrap {
  flex: 1;
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-wrap input[type='range'] {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.15);
  outline: none;
  cursor: pointer;
}

.progress-wrap input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e94560;
  cursor: pointer;
}

.frame-label {
  font-size: 0.8rem;
  color: rgba(234, 234, 234, 0.35);
  white-space: nowrap;
  min-width: 60px;
  text-align: right;
}

.info-text {
  font-size: 0.8rem;
  color: rgba(234, 234, 234, 0.35);
}

/* ---- Footer ---- */
.footer-note {
  text-align: center;
  font-size: 0.75rem;
  color: rgba(234, 234, 234, 0.35);
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .bar-chart-race {
    gap: 10px;
  }

  .date-badge {
    font-size: 0.9rem;
  }

  .controls {
    gap: 8px;
  }

  button {
    padding: 6px 10px;
    font-size: 0.8rem;
  }
}
</style>
