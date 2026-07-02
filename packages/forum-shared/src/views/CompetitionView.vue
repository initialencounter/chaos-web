<script setup lang="ts">
import type { CompetitionLeaderboardEntry, CompetitionLeaderboardResponse } from '@tapsss/shared/types'
import { escapeHtml, replaceMentionAndReplayLinks } from '@tapsss/shared/utils'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { resolveAsset } from '../inject'

defineOptions({ name: 'CompetitionView' })

const router = useRouter()
const competitionTitle = ref('')
const competitionTimeWindow = ref('')
const competitionDescription = ref('')
const entries = ref<CompetitionLeaderboardEntry[]>([])
const lastUpdated = ref(0)
const totalSubmissions = ref(0)
const totalValid = ref(0)
const totalFinal = ref(0)
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')

// ---- 头像 URL 解析缓存 ----
const resolvedAvatars = ref<Record<string, string>>({})

watch(entries, async (newEntries) => {
  const urls = [...new Set(newEntries.map(e => e.avatar).filter(Boolean))] as string[]
  const map: Record<string, string> = {}
  await Promise.all(urls.map(async (url) => {
    map[url] = await resolveAsset(url)
  }))
  resolvedAvatars.value = map
}, { immediate: true })

function getAvatar(url: string | undefined | null): string {
  if (!url)
    return '/icon/0.png'
  return resolvedAvatars.value[url] || '/icon/0.png'
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

function formatScore(s: number): string {
  return s.toFixed(3)
}

function formatTime(seconds: number): string {
  return `${seconds.toFixed(3)}s`
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

async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/competition/leaderboard')
    const json: CompetitionLeaderboardResponse = await res.json()
    if (json.code === 200 && json.data) {
      competitionTitle.value = json.data.competitionTitle
      competitionTimeWindow.value = json.data.competitionTimeWindow
      competitionDescription.value = json.data.competitionDescription
      entries.value = json.data.entries
      lastUpdated.value = json.data.lastUpdated
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
    const res = await fetch('/api/competition/refresh', { method: 'POST' })
    const json = await res.json()
    if (json.code === 200) {
      await fetchLeaderboard()
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
  await fetchLeaderboard()
  loading.value = false
  // 每 60 秒自动刷新排行榜（仅拉取，不触发完整 poll）
  refreshTimer = setInterval(() => {
    fetchLeaderboard()
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
  <div class="competition">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        🏆 {{ competitionTitle }}
      </h1>
      <p class="subtitle">
        经典 · 高级 — 比赛时间: {{ competitionTimeWindow }}
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
    <div v-else-if="entries.length === 0" class="status-msg">
      暂无参赛记录
    </div>

    <!-- 排行榜表格 -->
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
            <th class="col-score">
              得分
            </th>
            <th class="col-ioe">
              IOE
            </th>
            <th class="col-time">
              时间
            </th>
            <th class="col-bv">
              3BV
            </th>
            <th class="col-tap">
              点击
            </th>
            <th class="col-status">
              状态
            </th>
            <th class="col-comment">
              评论
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="`${entry.uid}-${entry.recordId}`"
            :class="[getRankClass(entry.rank), { 'is-final': entry.upload }]"
          >
            <td class="col-rank">
              <span class="rank-badge">{{ getRankBadge(entry.rank) }}</span>
            </td>
            <td class="col-player">
              <div class="player-cell" @click="goToUser(entry.uid)">
                <img
                  :src="getAvatar(entry.avatar)"
                  class="player-avatar"
                  @error="(e: Event) => { (e.target as HTMLImageElement).src = '/icon/0.png' }"
                >
                <span class="player-name">{{ entry.nickName || `UID:${entry.uid}` }}</span>
              </div>
            </td>
            <td class="col-score">
              <strong>{{ formatScore(entry.score) }}</strong>
            </td>
            <td class="col-ioe">
              {{ formatScore(entry.ioe) }}
            </td>
            <td class="col-time">
              {{ formatTime(entry.time) }}
            </td>
            <td class="col-bv">
              {{ entry.bv }}
            </td>
            <td class="col-tap">
              {{ entry.tap }}
            </td>
            <td class="col-status">
              <span v-if="entry.finished" class="status-badge final">已完成 ✅</span>
              <span v-else class="status-badge provisional">未完成</span>
            </td>
            <td class="col-comment" @click="handleCommentClick">
              <span class="comment-html" :title="entry.commentText" v-html="renderComment(entry.commentText)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.competition {
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

.rules-summary strong {
  color: #fa7299;
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

/* 得分列 */
.col-score strong {
  color: #fa7299;
  font-size: 16px;
}

/* 状态 */
.col-status {
  width: 100px;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.final {
  background-color: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.status-badge.provisional {
  background-color: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

/* 列宽 */
.col-score {
  width: 90px;
}
.col-ioe {
  width: 80px;
}
.col-time {
  width: 100px;
}
.col-bv {
  width: 60px;
}
.col-tap {
  width: 60px;
}

.col-comment {
  max-width: 280px;
}

.comment-html {
  display: block;
  color: #ccc;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: break-word;
}

.comment-html :deep(.replay-link) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  text-decoration: none;
}

.comment-html :deep(.replay-icon) {
  width: 16px;
  height: 16px;
}

/* 响应式 */
@media (max-width: 768px) {
  .competition {
    padding: 12px 8px;
  }
  .title {
    font-size: 22px;
  }
  .stats-bar {
    gap: 12px;
    padding: 10px 14px;
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
  .col-comment {
    max-width: 120px;
  }
  .comment-html {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
}
</style>
