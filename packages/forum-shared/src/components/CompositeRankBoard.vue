<script setup lang="ts">
import type { CompositeRankEntry, CompositeRankResponse } from '@tapsss/shared'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  currentUid?: string
}>(), {
  currentUid: '',
})

const router = useRouter()
const loading = ref(false)
const error = ref('')
const lastUpdated = ref(0)
const entries = ref<CompositeRankEntry[]>([])
const total = ref(0)
const gameLabels = ref<Record<string, string>>({})
const gameKeys = computed(() => Object.keys(gameLabels.value))

const activeTab = ref<'composite' | string>('composite')
const searchInput = ref('')
const searchApplied = ref('')

const tabLabelMap = computed<Record<string, string>>(() => ({
  composite: '综合排行',
  ...gameLabels.value,
}))

const allTabKeys = computed(() => ['composite', ...gameKeys.value])

// ---- 分页 ----
const currentPage = ref(1)
const pageSize = 100
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

// ---- 搜索相关 ----
const matchCount = ref(0)
const highlightedUid = ref('')

// 切换 tab 时重置搜索和页码
watch(activeTab, () => {
  currentPage.value = 1
  searchInput.value = ''
  searchApplied.value = ''
  matchCount.value = 0
  highlightedUid.value = ''
  fetchData()
})

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

// ---- 分页辅助 ----
function displayRank(idx: number): number {
  return (currentPage.value - 1) * pageSize + idx + 1
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
  highlightedUid.value = ''
  fetchData()
  nextTick(() => {
    const table = document.querySelector('.leaderboard-table')
    if (table) {
      table.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

// ---- 搜索（服务端搜索，定位到匹配玩家所在页） ----
function doSearch() {
  searchApplied.value = searchInput.value.trim()
  currentPage.value = 1 // 服务端会根据搜索重新计算 page
  fetchData()
}

function clearSearch() {
  searchInput.value = ''
  searchApplied.value = ''
  matchCount.value = 0
  highlightedUid.value = ''
  currentPage.value = 1
  fetchData()
}

// ---- API ----
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI

function buildApiUrl(): string {
  const tab = activeTab.value
  const base = tab === 'composite' ? '/api/rank/composite' : `/api/rank/${tab}`
  const params = new URLSearchParams({
    page: String(currentPage.value),
    pageSize: String(pageSize),
  })
  if (searchApplied.value) {
    params.set('search', searchApplied.value)
  }
  return `${base}?${params.toString()}`
}

async function fetchFromServer(): Promise<CompositeRankResponse> {
  const url = buildApiUrl()
  if (isElectron) {
    const raw = await (window as any).electronAPI.proxyRequest(url)
    if (!raw.success) {
      throw new Error(raw.msg || '获取排行榜失败')
    }
    return { code: raw.code || 200, data: raw.data, msg: null }
  }
  const res = await fetch(url)
  return await res.json()
}

async function fetchData() {
  loading.value = true
  error.value = ''

  try {
    const json = await fetchFromServer()
    if (json.code === 200 && json.data) {
      entries.value = json.data.entries
      total.value = json.data.total
      matchCount.value = json.data.matchCount || 0
      highlightedUid.value = json.data.matchUid || ''
      currentPage.value = json.data.page
      lastUpdated.value = json.data.lastUpdated
      gameLabels.value = json.data.gameLabels
      error.value = ''

      // 搜索跳转后滚动到高亮行，然后清除 searchApplied 使翻页正常工作
      if (highlightedUid.value) {
        searchApplied.value = ''
        nextTick(() => {
          const row = document.querySelector('.row-highlight')
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }
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

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="composite-rank">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        🏆 全能榜
      </h1>
    </div>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">上榜玩家</span>
        <span class="stat-value">{{ total }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最后更新</span>
        <span class="stat-value stat-time">{{ lastUpdated ? formatDate(lastUpdated) : '未更新' }}</span>
      </div>
      <!-- 搜索框 -->
      <div class="search-box">
        <input
          v-model.trim="searchInput"
          class="search-input"
          type="text"
          placeholder="搜索玩家昵称或UID"
          @keyup.enter="doSearch"
        >
        <button v-if="searchInput" class="search-clear" @click="clearSearch">
          ✕
        </button>
        <button class="search-btn" @click="doSearch">
          搜索
        </button>
      </div>
      <span v-if="matchCount > 0" class="search-hint">
        找到 {{ matchCount }} 名玩家
      </span>
    </div>

    <!-- 加载/错误 -->
    <div v-if="error" class="status-msg error">
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
            <th class="col-composite">
              综合评分
            </th>
            <th v-for="key in gameKeys" :key="key" class="col-game">
              {{ gameLabels[key] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, idx) in entries"
            :key="entry.uid"
            :class="[
              getRankClass(displayRank(idx)),
              {
                'is-self': entry.uid === currentUid,
                'row-highlight': entry.uid === highlightedUid,
              },
            ]"
          >
            <td class="col-rank">
              <span class="rank-badge">{{ getRankBadge(displayRank(idx)) }}</span>
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
            <td class="col-composite">
              <strong>{{ entry.compositePercent.toFixed(2) }}</strong>
            </td>
            <td v-for="key in gameKeys" :key="key" class="col-game">
              <span class="game-score">{{ entry.games[key]?.score?.toFixed(2) ?? '-' }}</span>
              <span class="game-rank-sub">#{{ entry.games[key]?.rank || '-' }}</span>
            </td>
          </tr>
          <tr v-if="entries.length === 0 && searchInput && matchCount === 0">
            <td :colspan="gameKeys.length + 3" class="empty-row">
              未找到匹配 "{{ searchInput }}" 的玩家
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
            v-for="(entry, idx) in entries"
            :key="entry.uid"
            :class="[
              getRankClass(displayRank(idx)),
              {
                'is-self': entry.uid === currentUid,
                'row-highlight': entry.uid === highlightedUid,
              },
            ]"
          >
            <td class="col-rank">
              <span class="rank-badge">{{ getRankBadge(displayRank(idx)) }}</span>
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
          <tr v-if="entries.length === 0 && searchInput && matchCount === 0">
            <td :colspan="4" class="empty-row">
              未找到匹配 "{{ searchInput }}" 的玩家
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页控件 -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage <= 1"
          @click="goToPage(1)"
        >
          首页
        </button>
        <button
          class="page-btn"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ currentPage }} / {{ totalPages }} 页（共 {{ total }} 条）
        </span>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一页
        </button>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages"
          @click="goToPage(totalPages)"
        >
          末页
        </button>
      </div>
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

/* ---- 搜索框 ---- */
.search-box {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.search-input {
  width: 200px;
  padding: 7px 12px;
  border: 1px solid #444;
  border-radius: 8px;
  background-color: #252525;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder {
  color: #666;
}

.search-input:focus {
  border-color: #fa7299;
}

.search-clear {
  padding: 2px 6px;
  border: none;
  background: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
}

.search-clear:hover {
  color: #e0e0e0;
}

.search-btn {
  padding: 5px 10px;
  border: 1px solid #444;
  border-radius: 8px;
  background-color: #333;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.search-btn:hover {
  background-color: #444;
}

.search-hint {
  font-size: 12px;
  color: #fa7299;
  white-space: nowrap;
}

.refresh-btn {
  margin-left: 0;
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

.empty-row {
  text-align: center;
  color: #666;
  padding: 32px 0;
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

/* ---- 搜索高亮行 ---- */
.leaderboard-table tbody tr.row-highlight {
  background-color: rgba(250, 114, 153, 0.18) !important;
  outline: 1px solid rgba(250, 114, 153, 0.4);
  outline-offset: -1px;
}

.leaderboard-table tbody tr.row-highlight:hover {
  background-color: rgba(250, 114, 153, 0.25) !important;
}

/* ---- 搜索时非匹配行变暗 ---- */
.leaderboard-table tbody tr.row-dimmed {
  opacity: 0.35;
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

/* ---- 分页 ---- */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
  flex-wrap: wrap;
}

.page-btn {
  padding: 6px 14px;
  background-color: #252525;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.page-btn:hover:not(:disabled) {
  background-color: #3a3a3a;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  color: #999;
  font-size: 13px;
  white-space: nowrap;
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

  .search-input {
    width: 140px;
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
