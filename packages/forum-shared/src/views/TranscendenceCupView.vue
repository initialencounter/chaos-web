<script setup lang="ts">
import type { TcupLeaderboard, TcupLeaderboardEntry, TcupLeaderboardResponse } from '@tapsss/shared/types'
import { escapeHtml, replaceMentionAndReplayLinks } from '@tapsss/shared/utils'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'TranscendenceCupView' })

const router = useRouter()
const leaderboards = ref<TcupLeaderboard[]>([])
const lastUpdated = ref(0)
const competitionTitle = ref('超越杯')
const competitionTimeWindow = ref('')
const competitionDescription = ref('')
const totalSubmissions = ref(0)
const totalValid = ref(0)
const totalFinal = ref(0)
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')

const activeTab = ref('totalPoints')

let refreshTimer: ReturnType<typeof setInterval> | null = null

// 15 个排行榜 ID，按展示顺序排列
const allBoardIds = [
  'totalPoints',
  'totalTime',
  'totalBvs',
  'primary-time',
  'primary-bvs',
  'primary-maxBv',
  'primary-minBv',
  'intermediate-time',
  'intermediate-bvs',
  'intermediate-maxBv',
  'intermediate-minBv',
  'advanced-time',
  'advanced-bvs',
  'advanced-maxBv',
  'advanced-minBv',
]

// 每个 ID 对应的简短 Tab 标签
const tabLabelMap: Record<string, string> = {
  'totalPoints': '总积分',
  'totalTime': '总时间',
  'totalBvs': '总BV/s',
  'primary-time': '初·时间',
  'primary-bvs': '初·BV/s',
  'primary-maxBv': '初·最大',
  'primary-minBv': '初·最小',
  'intermediate-time': '中·时间',
  'intermediate-bvs': '中·BV/s',
  'intermediate-maxBv': '中·最大',
  'intermediate-minBv': '中·最小',
  'advanced-time': '高·时间',
  'advanced-bvs': '高·BV/s',
  'advanced-maxBv': '高·最大',
  'advanced-minBv': '高·最小',
}

const currentBoard = computed(() => {
  return leaderboards.value.find(lb => lb.id === activeTab.value) ?? null
})

function formatValue(value: number, boardId: string): string {
  if (boardId.includes('bvs'))
    return value.toFixed(3)
  if (boardId.includes('time') || boardId.includes('Time'))
    return `${value.toFixed(3)}s`
  if (boardId.includes('v') || boardId === 'totalPoints')
    return String(value)
  return String(value)
}

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

function hasSource(entry: TcupLeaderboardEntry): boolean {
  return entry.recordId !== null
}

function renderComment(text: string): string {
  return replaceMentionAndReplayLinks(escapeHtml(text))
}

function handleCommentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const btn = target.closest('.replay-link') as HTMLElement | null
  if (btn) {
    const recordId = btn.dataset.recordId
    const recordType = btn.dataset.recordType
    if (recordId && recordType) {
      router.push({ name: 'replay', params: { recordId, recordType } })
    }
  }
}

async function fetchLeaderboards() {
  try {
    const res = await fetch('/api/tcup/leaderboards')
    const json: TcupLeaderboardResponse = await res.json()
    if (json.code === 200 && json.data) {
      leaderboards.value = json.data.leaderboards
      lastUpdated.value = json.data.lastUpdated
      competitionTitle.value = json.data.competitionTitle
      competitionTimeWindow.value = json.data.competitionTimeWindow
      competitionDescription.value = json.data.competitionDescription
      totalSubmissions.value = json.data.totalSubmissions
      totalValid.value = json.data.totalValidEntries
      totalFinal.value = json.data.totalFinalEntries
      error.value = ''
    }
    else {
      error.value = String(json.msg || '获取数据失败')
    }
  }
  catch (err) {
    error.value = String(err)
  }
}

async function manualRefresh() {
  refreshing.value = true
  try {
    const res = await fetch('/api/tcup/refresh', { method: 'POST' })
    const json = await res.json()
    if (json.code === 200) {
      await fetchLeaderboards()
    }
  }
  catch (err) {
    console.error('刷新失败:', err)
  }
  finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  loading.value = true
  await fetchLeaderboards()
  loading.value = false
  refreshTimer = setInterval(() => {
    fetchLeaderboards()
  }, 60000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div class="tcup">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        🏆 {{ competitionTitle }}
      </h1>
      <p class="subtitle">
        经典 · 初/中/高级 — 比赛时间: {{ competitionTimeWindow }}
      </p>
      <div class="rules-summary" v-html="competitionDescription" />
    </div>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">总提交</span>
        <span class="stat-value">{{ totalSubmissions }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">有效成绩</span>
        <span class="stat-value">{{ totalValid }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最终成绩</span>
        <span class="stat-value stat-final">{{ totalFinal }}</span>
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
    <div v-else-if="leaderboards.length === 0" class="status-msg">
      暂无参赛记录
    </div>

    <!-- Tab 导航: 15 个榜单一横排 -->
    <div v-else class="tabs-wrapper">
      <div class="tabs">
        <button
          v-for="id in allBoardIds"
          :key="id"
          class="tab-btn"
          :class="{ active: activeTab === id }"
          @click="activeTab = id"
        >
          {{ tabLabelMap[id] || id }}
        </button>
      </div>
    </div>

    <!-- 当前榜内容 -->
    <div v-if="currentBoard" class="tab-content">
      <div class="board-section">
        <h3 class="board-title">
          {{ currentBoard.title }}
        </h3>
        <div v-if="currentBoard.entries.length === 0" class="board-empty">
          暂无数据
        </div>
        <div v-else class="table-wrapper">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th class="col-rank">
                  #
                </th>
                <th class="col-player">
                  玩家
                </th>
                <th class="col-value">
                  成绩
                </th>
                <th v-if="currentBoard.id !== 'totalPoints'" class="col-pts">
                  积分
                </th>
                <th v-if="currentBoard.id !== 'totalPoints'" class="col-source">
                  来源
                </th>
                <th v-if="currentBoard.id !== 'totalPoints'" class="col-replay">
                  录像
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in currentBoard.entries"
                :key="`${entry.uid}-${currentBoard.id}`"
                :class="[getRankClass(entry.rank), { 'is-final': entry.upload }]"
              >
                <td class="col-rank">
                  <span class="rank-badge">{{ getRankBadge(entry.rank) }}</span>
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
                <td class="col-value">
                  <strong>{{ formatValue(entry.value, currentBoard.id) }}</strong>
                </td>
                <td v-if="currentBoard.id !== 'totalPoints'" class="col-pts">
                  <span class="pts-badge" :class="{ 'pts-zero': entry.points === 0 }">{{ entry.points > 0 ? `+${entry.points}` : entry.points }}</span>
                </td>
                <td v-if="currentBoard.id !== 'totalPoints'" class="col-source">
                  <div v-if="entry.detail" class="source-detail">
                    {{ entry.detail }}
                  </div>
                  <div v-else-if="hasSource(entry)" class="source-info">
                    <span class="source-detail">{{ entry.time?.toFixed(3) }}s</span>
                    <span class="source-detail">3BV:{{ entry.bv }}</span>
                    <span class="source-detail">3BV/s:{{ entry.bvs?.toFixed(3) }}</span>
                  </div>
                  <span v-else class="source-na">-</span>
                </td>
                <td v-if="currentBoard.id !== 'totalPoints'" class="col-replay" @click="handleCommentClick">
                  <span
                    v-if="hasSource(entry) && entry.commentText"
                    class="comment-html"
                    :title="entry.commentText"
                    v-html="renderComment(entry.commentText)"
                  />
                  <span v-else class="source-na">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tcup {
  min-height: 100vh;
  background-color: #121212;
  color: #e0e0e0;
  padding: 20px 16px;
  max-width: 1100px;
  margin: 0 auto;
}

/* 头部 */
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

.rules-summary {
  font-size: 13px;
  color: #999;
  background-color: #1b1b1b;
  border-radius: 8px;
  padding: 10px 16px;
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.divider {
  color: #333;
}

/* 统计栏 */
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

.stat-final {
  color: #4caf50;
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

/* 状态提示 */
.status-msg {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 16px;
}

.status-msg.error {
  color: #f44336;
}

/* Tab 外层: 水平可滚动 */
.tabs-wrapper {
  margin-bottom: 20px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Tab 导航: 不换行，一横排 */
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
  padding: 8px 12px;
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

/* 排行榜标题 */
.board-title {
  font-size: 18px;
  color: #ffffff;
  margin: 0 0 10px;
  padding-left: 4px;
  border-left: 3px solid #fa7299;
}

.board-empty {
  text-align: center;
  padding: 20px;
  color: #666;
  background-color: #1b1b1b;
  border-radius: 8px;
}

/* 表格 */
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
  padding: 10px 10px;
  text-align: center;
  font-size: 12px;
  color: #999;
  font-weight: 500;
  border-bottom: 1px solid #333;
  white-space: nowrap;
}

.leaderboard-table td {
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid #2a2a2a;
  font-size: 14px;
}

.leaderboard-table tbody tr:hover {
  background-color: #2a2a2a;
}

.leaderboard-table tbody tr.is-final {
  background-color: rgba(76, 175, 80, 0.06);
}

.leaderboard-table tbody tr.is-final:hover {
  background-color: rgba(76, 175, 80, 0.12);
}

.leaderboard-table tbody tr:last-child td {
  border-bottom: none;
}

/* 排名 */
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

/* 玩家 */
.col-player {
  text-align: left !important;
  min-width: 140px;
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
  width: 32px;
  height: 32px;
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

/* 成绩列 */
.col-value strong {
  color: #fa7299;
  font-size: 15px;
}

/* 积分列 */
.col-pts {
  width: 60px;
}

.pts-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #4caf50;
  background-color: rgba(76, 175, 80, 0.15);
}

.pts-badge.pts-zero {
  color: #666;
  background-color: rgba(255, 255, 255, 0.05);
}

/* 来源列 */
.col-source {
  min-width: 130px;
  font-size: 12px;
}

/* 录像列 */
.col-replay {
  max-width: 200px;
  font-size: 12px;
}

.source-info {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.source-detail {
  color: #999;
  white-space: nowrap;
}

.source-na {
  color: #666;
}

.comment-html {
  display: block;
  color: #ccc;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: break-word;
}

.comment-html :deep(.replay-link) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  text-decoration: none;
}

.comment-html :deep(.replay-icon) {
  width: 14px;
  height: 14px;
}

/* 响应式 */
@media (max-width: 768px) {
  .tcup {
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
    padding: 6px 4px;
    font-size: 12px;
  }
  .player-avatar {
    width: 24px;
    height: 24px;
  }
  .col-source,
  .col-replay {
    display: none;
  }
}
</style>
