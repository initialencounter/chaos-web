<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreBoard as ScoreBoardType, ScoreEntry } from '@/types'

const props = defineProps<{
  scoreBoard: ScoreBoardType
}>()

const sortedEntries = computed<ScoreEntry[]>(() => {
  return Object.values(props.scoreBoard)
    .sort((a, b) => b.score - a.score)
})

function getRankClass(idx: number): string {
  if (idx === 0) return 'rank-1'
  if (idx === 1) return 'rank-2'
  if (idx === 2) return 'rank-3'
  return ''
}

function getRankIcon(idx: number): string {
  if (idx === 0) return '🥇'
  if (idx === 1) return '🥈'
  if (idx === 2) return '🥉'
  return String(idx + 1)
}
</script>

<template>
  <div class="scoreboard">
    <div class="scoreboard-title">
      <span class="title-icon">🏆</span> 玩家排行
    </div>
    <div
      v-for="(entry, idx) in sortedEntries"
      :key="entry.uid"
      class="score-row"
      :class="getRankClass(idx)"
    >
      <div class="rank-num">{{ getRankIcon(idx) }}</div>
      <img
        v-if="entry.avatar"
        :src="entry.avatar"
        class="avatar"
        @error="(e) => (e.target as HTMLImageElement).style.display='none'"
      />
      <div v-else class="avatar-placeholder">{{ entry.name.charAt(0) }}</div>
      <div class="player-info">
        <div class="player-name">
          {{ entry.name }}
          <span v-if="entry.lastOpen" class="last-hit-tag">🎯</span>
        </div>
        <div class="player-stats">
          <span class="stat-correct">{{ entry.correct }}</span>
          <span class="stat-sep">·</span>
          <span class="stat-incorrect">{{ entry.incorrect }}</span>
          <span class="stat-sep">·</span>
          <span class="stat-score">{{ entry.score }}分</span>
        </div>
      </div>
      <div v-if="entry.usePropCount > 0" class="prop-count">
        🧪{{ entry.usePropCount }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.scoreboard {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(16px);
  border-radius: 14px;
  padding: 12px 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}
.scoreboard-title {
  font-weight: 700;
  font-size: 14px;
  color: #c0c0c0;
  margin-bottom: 10px;
  text-align: center;
  letter-spacing: 2px;
}
.title-icon {
  margin-right: 4px;
}
.score-row {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  margin-bottom: 3px;
  gap: 8px;
  font-size: 13px;
  transition: background 0.2s, transform 0.15s;
}
.score-row:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(2px);
}
.rank-1 {
  background: rgba(255, 200, 40, 0.12);
  border: 1px solid rgba(255, 200, 40, 0.18);
}
.rank-2 {
  background: rgba(180, 180, 200, 0.08);
  border: 1px solid rgba(180, 180, 200, 0.10);
}
.rank-3 {
  background: rgba(210, 140, 80, 0.08);
  border: 1px solid rgba(210, 140, 80, 0.10);
}

.rank-num {
  width: 24px;
  text-align: center;
  font-size: 14px;
  flex-shrink: 0;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.12);
}
.avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
  font-weight: 700;
}
.player-info {
  flex: 1;
  min-width: 0;
}
.player-name {
  font-weight: 600;
  color: #e0e0e0;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.last-hit-tag {
  font-size: 11px;
}
.player-stats {
  font-size: 11px;
  color: #888;
  display: flex;
  gap: 3px;
  margin-top: 1px;
}
.stat-correct { color: #5eead4; font-weight: 700; }
.stat-incorrect { color: #f87171; font-weight: 700; }
.stat-score { color: #60a5fa; font-weight: 700; }
.stat-sep { color: #555; }
.prop-count {
  font-size: 10px;
  background: rgba(250, 173, 20, 0.15);
  color: #fbbf24;
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
  font-weight: 600;
}
</style>
