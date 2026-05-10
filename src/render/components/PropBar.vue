<script lang="ts" setup>
import type { ActivePropEffect, Prop } from '../types'
import { onMounted, onUnmounted, ref } from 'vue'
import { resolveImageUrl } from '../utils/image'

const props = defineProps<{
  props: Prop[]
  usingPropId: number | null
  cdRemaining: number
  activeEffects: ActivePropEffect[]
}>()

defineEmits<{
  useProp: [propId: number]
}>()

const now = ref(Date.now())
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 100)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

function isAutoActive(propId: number): boolean {
  return props.activeEffects.some(e => e.propId === propId && (e.startTime + e.remainingMs) > now.value)
}

function getAutoRemaining(propId: number): number {
  const e = props.activeEffects.find(e => e.propId === propId)
  if (!e)
    return 0
  return Math.max(0, (e.startTime + e.remainingMs - now.value) / 1000)
}

function getBadgeValue(prop: Prop): string | number {
  if (!prop.active && isAutoActive(prop.id)) {
    return `${getAutoRemaining(prop.id).toFixed(1)}s`
  }
  return prop.num
}

function getTimerPercent(propId: number): number {
  const e = props.activeEffects.find(e => e.propId === propId)
  if (!e || e.remainingMs <= 0)
    return 0
  const remaining = Math.max(0, e.startTime + e.remainingMs - now.value)
  return (remaining / e.remainingMs) * 100
}

function getPropDisplayName(name: string): string {
  const map: Record<string, string> = {
    chaos_detector: '探测仪',
    chaos_xjbd: '雷之奥义',
    chaos_double_score: '双倍',
    chaos_shield: '护盾',
  }
  return map[name] || name
}

function getPropDesc(prop: Prop): string {
  const descs: Record<string, string> = {
    chaos_detector: '显示5x5范围的雷,持续8秒。点击后选择格子使用',
    chaos_xjbd: '自动完成7x7区域,雷自动标记。点击后选择格子使用',
    chaos_double_score: '10秒内得分加倍。获得时自动使用',
    chaos_shield: '6秒无敌,踩雷不进入冷却但每次减1秒。获得时自动使用',
  }
  return descs[prop.name] || ''
}
</script>

<template>
  <div class="prop-bar">
    <div class="prop-bar-inner">
      <div class="prop-label">
        道具栏
      </div>
      <div
        v-for="prop in props.props"
        :key="prop.id"
        class="prop-item"
        :class="{
          'prop-active': prop.active && usingPropId === prop.id,
          'prop-disabled': cdRemaining > 0,
          'prop-auto': !prop.active,
          'prop-countdown': isAutoActive(prop.id),
        }"
        :title="getPropDesc(prop)"
        @click="prop.active ? $emit('useProp', prop.id) : null"
      >
        <el-badge :value="getBadgeValue(prop)" :offset="[-4, 0]" :class="{ 'countdown-badge': isAutoActive(prop.id) }">
          <img :src="resolveImageUrl(prop.icon)" class="prop-icon" :class="{ 'prop-icon-pulse': isAutoActive(prop.id) }">
        </el-badge>
        <div class="prop-name">
          {{ getPropDisplayName(prop.name) }}
        </div>
        <div v-if="isAutoActive(prop.id)" class="prop-timer-bar">
          <div class="prop-timer-fill" :style="{ width: `${getTimerPercent(prop.id)}%` }" />
        </div>
      </div>
      <span v-if="props.props.length === 0" class="prop-empty">暂无道具</span>
    </div>
  </div>
</template>

<style scoped>
.prop-bar {
  display: flex;
  justify-content: center;
}
.prop-bar-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(10px);
  padding: 6px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
}
.prop-label {
  font-size: 12px;
  color: #888;
  margin-right: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.prop-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s;
  border: 1.5px solid transparent;
}
.prop-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.prop-active {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.2);
}
.prop-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.prop-auto {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.1);
}
.prop-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
.prop-name {
  font-size: 11px;
  color: #c0c0c0;
  margin-top: 3px;
  white-space: nowrap;
  font-weight: 500;
}
.prop-empty {
  font-size: 12px;
  color: #666;
  padding: 0 10px;
  font-style: italic;
}

/* 自动道具倒计时样式 */
.prop-countdown {
  border-color: rgba(96, 165, 250, 0.5) !important;
  border-style: solid !important;
  background: rgba(96, 165, 250, 0.08);
}
.prop-icon-pulse {
  animation: icon-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes icon-pulse {
  from {
    filter: drop-shadow(0 0 3px rgba(96, 165, 250, 0.4));
  }
  to {
    filter: drop-shadow(0 0 10px rgba(96, 165, 250, 0.8));
  }
}
.prop-timer-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}
.prop-timer-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #34d399);
  border-radius: 2px;
  transition: width 0.1s linear;
}
:deep(.countdown-badge .el-badge__content) {
  background: #60a5fa !important;
  font-size: 10px !important;
}
</style>
