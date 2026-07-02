<script setup lang="ts">
import type { CompositeRankEntry, CompositeRankResponse } from '@tapsss/shared'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  currentUid?: string
}>(), {
  currentUid: '',
})

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const lastUpdated = ref(0)
const entries = ref<CompositeRankEntry[]>([])
const gameLabels = ref<Record<string, string>>({})
const gameKeys = computed(() => Object.keys(gameLabels.value))

const activeTab = ref<'composite' | string>('composite')

const tabLabelMap = computed<Record<string, string>>(() => ({
  composite: '综合排行',
  ...gameLabels.value,
}))

const allTabKeys = computed(() => ['composite', ...gameKeys.value])

// ---- 工具函数 ----
function formatDate(ts: number): string {
  if (!ts)
    return '-'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function getRankBadge(rank: number): string {
  if (rank === 1)
    return '🥇'
  if (rank === 2)
    return '🥈'
  if (rank === 3)
    return '🥉'
  return String(rank)
}

function getRankClass(rank: number): string {
  if (rank === 1)
    return 'rank-gold'
  if (rank === 2)
    return 'rank-silver'
  if (rank === 3)
    return 'rank-bronze'
  return ''
}

function goToUser(uid: string) {
  router.push({ name: 'user', params: { uid } })
}

// ---- API ----
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI

async function fetchFromServer(): Promise<CompositeRankResponse> {
  if (isElectron) {
    const raw = await (window as any).electronAPI.proxyRequest('/api/rank/composite')
    if (!raw.success) {
      throw new Error(raw.msg || '获取排行榜失败')
    }
    return { code: raw.code || 200, data: raw.data, msg: null }
  }
  const res = await fetch('/api/rank/composite')
  return await res.json()
}

async function fetchData() {
  loading.value = true
  error.value = ''

  try {
    const json = await fetchFromServer()
    if (json.code === 200 && json.data) {
      entries.value = json.data.entries
      lastUpdated.value = json.data.lastUpdated
      gameLabels.value = json.data.gameLabels
      error.value = ''
    }
    else {
      error.value = String(json.msg || '获取数据失败')
    }
  }
  catch (e: unknown) {
    error.value = (e as Error).message || '加载失败'
  }
  finally {
    loading.value = false
  }
}

async function manualRefresh() {
  refreshing.value = true
  try {
    if (isElectron) {
      await (window as any).electronAPI.proxyRequest('/api/rank/composite/refresh')
    }
    else {
      await fetch('/api/rank/composite/refresh', { method: 'POST' })
    }
    await fetchData()
  }
  catch (e: unknown) {
    error.value = (e as Error).message || '刷新失败'
  }
  finally {
    refreshing.value = false
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchData()
  refreshTimer = setInterval(() => {
    fetchData()
  }, 60000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div class="composite-rank">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        🏆 综合游戏排行榜
      </h1>
      <p class="subtitle">
        聚合 6 款小游戏排名 · 综合评分算法
      </p>
    </div>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">上榜玩家</span>
        <span class="stat-value">{{ entries.length }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最后更新</span>
        <span class="stat-value stat-time">{{ lastUpdated ? formatDate(lastUpdated) : '未更新' }}</span>
      </div>
      <button class="refresh-btn" :disabled="refreshing" @click="manualRefresh">
        {{ refreshing ? '刷新中...' : '🔄 手动刷新' }}
      </button>
    </div>

    <!-- 加载/错误 -->
    <div v-if="loading" class="status-msg">
      加载中...
    </div>
    <div v-else-if="error" class="status-msg error">
      {{ error }}
    </div>
    <div v-else-if="entries.length === 0" class="status-msg">
      暂无排行数据
    </div>

    <!-- Tab 导航 -->
    <div v-else class="tabs-wrapper">
      <div class="tabs">
        <button
          v-for="key in allTabKeys"
          :key="key"
          class="tab-btn"
          :class="{ active: activeTab === key }"
          @click="activeTab = key"
        >
          {{ tabLabelMap[key] || key }}
        </button>
      </div>
    </div>

    <!-- 排行榜表格 -->
    <div v-if="entries.length > 0" class="table-wrapper">
      <!-- 综合排行 -->
      <table v-if="activeTab === 'composite'" class="leaderboard-table">
        <thead>
          <tr>
            <th class="col-rank">
              #
            </th>
            <th class="col-player">
              玩家
            </th>
            <th v-for="key in gameKeys" :key="key" class="col-game">
              {{ gameLabels[key] }}
            </th>
            <th class="col-composite">
              综合评分
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, idx) in entries"
            :key="entry.uid"
            :class="[getRankClass(idx + 1), { 'is-self': entry.uid === currentUid }]"
          >
            <td class="col-rank">
              <span class="rank-badge">{{ getRankBadge(idx + 1) }}</span>
            </td>
            <td class="col-player">
              <div class="player-cell" @click="goToUser(entry.uid)">
                <img
                  :src="entry.avatar || '/icon/0.png'"
                  class="player-avatar"
                  @error="(e: Event) => { (e.target as HTMLImageElement).src = '/icon/0.png' }"
                >
                <span class="player-name">{{ entry.nickName || `UID:${entry.uid}` }}</span>
              </div>
            </td>
            <td v-for="key in gameKeys" :key="key" class="col-game">
              <span class="game-score">{{ entry.games[key]?.score?.toFixed(2) ?? '-' }}</span>
              <span class="game-rank-sub">#{{ entry.games[key]?.rank || '-' }}</span>
            </td>
            <td class="col-composite">
              <strong>{{ entry.compositePercent.toFixed(2) }}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 单项游戏排行 -->
      <table v-else class="leaderboard-table">
        <thead>
          <tr>
            <th class="col-rank">
              #
            </th>
            <th class="col-player">
              玩家
            </th>
            <th class="col-game-rank">
              游戏排名
            </th>
            <th class="col-game-score-col">
              评分
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="entry.uid"
            :class="[getRankClass(entry.games[activeTab]?.rank || 0), { 'is-self': entry.uid === currentUid }]"
          >
            <td class="col-rank">
              <span class="rank-badge">{{ getRankBadge(entry.games[activeTab]?.rank || 0) }}</span>
            </td>
            <td class="col-player">
              <div class="player-cell" @click="goToUser(entry.uid)">
                <img
                  :src="entry.avatar || '/icon/0.png'"
                  class="player-avatar"
                  @error="(e: Event) => { (e.target as HTMLImageElement).src = '/icon/0.png' }"
                >
                <span class="player-name">{{ entry.nickName || `UID:${entry.uid}` }}</span>
              </div>
            </td>
            <td class="col-game-rank">
              #{{ entry.games[activeTab]?.rank || '-' }}
            </td>
            <td class="col-game-score-col">
              <strong>{{ entry.games[activeTab]?.score?.toFixed(2) ?? '-' }}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.composite-rank {
  min-height: 100vh;
  background-color: #121212;
  color: #e0e0e0;
  padding: 20px 16px;
  max-width: 1100px;
  margin: 0 auto;
}

/* ---- 头部 ---- */
.header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  font-size: 28px;
  margin: 0 0 8px;
  color: #ffffff;
}

.subtitle {
  margin: 0 0 12px;
  color: #999;
  font-size: 14px;
}

/* ---- 统计栏 ---- */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px 20px;
  background-color: #1b1b1b;
  border-radius: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #ffffff;
}

.stat-time {
  font-size: 13px;
  font-weight: normal;
  color: #999;
}

.refresh-btn {
  margin-left: auto;
  padding: 8px 16px;
  background-color: #333;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #444;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---- 状态提示 ---- */
.status-msg {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 16px;
}

.status-msg.error {
  color: #f44336;
}

/* ---- Tab 外层 ---- */
.tabs-wrapper {
  margin-bottom: 20px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* ---- Tab 导航 ---- */
.tabs {
  display: flex;
  gap: 4px;
  background-color: #1b1b1b;
  border-radius: 10px;
  padding: 4px;
  width: max-content;
  min-width: 100%;
}

.tab-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  background: none;
  border: none;
  border-radius: 8px;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn:hover {
  color: #e0e0e0;
  background-color: #252525;
}

.tab-btn.active {
  color: #ffffff;
  background-color: #333;
  font-weight: 600;
}

/* ---- 表格 ---- */
.table-wrapper {
  overflow-x: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  background-color: #1b1b1b;
  border-radius: 10px;
  overflow: hidden;
}

.leaderboard-table thead {
  background-color: #252525;
}

.leaderboard-table th {
  padding: 12px 10px;
  text-align: center;
  font-size: 12px;
  color: #999;
  font-weight: 500;
  border-bottom: 1px solid #333;
  white-space: nowrap;
}

.leaderboard-table td {
  padding: 10px;
  text-align: center;
  border-bottom: 1px solid #2a2a2a;
  font-size: 14px;
}

.leaderboard-table tbody tr:hover {
  background-color: #2a2a2a;
}

.leaderboard-table tbody tr:last-child td {
  border-bottom: none;
}

.leaderboard-table tbody tr.is-self {
  background-color: rgba(250, 114, 153, 0.08);
}

.leaderboard-table tbody tr.is-self:hover {
  background-color: rgba(250, 114, 153, 0.14);
}

/* ---- 排名 ---- */
.col-rank {
  width: 50px;
}

.rank-badge {
  font-size: 18px;
}

.rank-gold .rank-badge {
  font-size: 22px;
}

.rank-silver .rank-badge {
  font-size: 20px;
}

.rank-bronze .rank-badge {
  font-size: 19px;
}

/* ---- 玩家 ---- */
.col-player {
  text-align: left !important;
  min-width: 160px;
}

.player-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.player-cell:hover .player-name {
  color: #fa7299;
}

.player-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #333;
  flex-shrink: 0;
}

.player-name {
  color: #e0e0e0;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 游戏分列 ---- */
.col-game {
  text-align: center;
  min-width: 72px;
}

.game-score {
  display: block;
  font-weight: 600;
  color: #fa7299;
  font-size: 14px;
}

.game-rank-sub {
  display: block;
  font-size: 10px;
  color: #667;
  margin-top: 1px;
}

/* ---- 综合评分列 ---- */
.col-composite {
  text-align: center;
  min-width: 90px;
}

.col-composite strong {
  color: #fa7299;
  font-size: 16px;
}

/* ---- 单项排行列 ---- */
.col-game-rank {
  text-align: center;
  width: 90px;
  color: #ccc;
  font-size: 14px;
}

.col-game-score-col {
  text-align: center;
  width: 80px;
}

.col-game-score-col strong {
  color: #fa7299;
  font-size: 15px;
}

/* ---- 响应式 ---- */
@media (max-width: 768px) {
  .composite-rank {
    padding: 12px 8px;
  }

  .title {
    font-size: 22px;
  }

  .stats-bar {
    gap: 12px;
    padding: 10px 14px;
  }

  .tab-btn {
    font-size: 11px;
    padding: 6px 8px;
  }

  .leaderboard-table th,
  .leaderboard-table td {
    padding: 8px 6px;
    font-size: 12px;
  }

  .player-avatar {
    width: 28px;
    height: 28px;
  }
}
</style>
