<template>
  <div class="prop-bar">
    <div class="prop-bar-inner">
      <div class="prop-label">道具栏</div>
      <div
        v-for="prop in props"
        :key="prop.id"
        class="prop-item"
        :class="{
          'prop-active': prop.active && usingPropId === prop.id,
          'prop-disabled': cdRemaining > 0,
          'prop-auto': !prop.active,
        }"
        @click="prop.active ? $emit('useProp', prop.id) : null"
        :title="getPropDesc(prop)"
      >
        <el-badge :value="prop.num" :offset="[-4, 0]">
          <img :src="prop.icon" class="prop-icon" />
        </el-badge>
        <div class="prop-name">{{ getPropDisplayName(prop.name) }}</div>
      </div>
      <span v-if="props.length === 0" class="prop-empty">暂无道具</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Prop } from '@/types'

defineProps<{
  props: Prop[]
  usingPropId: number | null
  cdRemaining: number
}>()

defineEmits<{
  useProp: [propId: number]
}>()

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
  opacity: 0.40;
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
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
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
</style>
