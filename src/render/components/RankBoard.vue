<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { resolveAndCache } from '@/utils/image'

defineProps<{
  modelValue: boolean
  currentUid: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const PAGE_SIZE = 20

type TabName = 'medal' | 'score' | 'coin'

interface RankItem {
  uid: string
  rank: number
  score: number
  win: number
  lose: number
  stage: number
  user: {
    avatar: string
    nickName: string
  }
}

interface TabState {
  list: RankItem[]
  page: number
  totalPage: number
  loaded: boolean
}

const activeTab = ref<TabName>('medal')
const loading = ref(false)
const refreshing = ref(false)
const pullDistance = ref(0)
const pullThreshold = 56

const tabState = reactive<Record<TabName, TabState>>({
  medal: { list: [], page: 1, totalPage: 1, loaded: false },
  score: { list: [], page: 1, totalPage: 1, loaded: false },
  coin: { list: [], page: 1, totalPage: 1, loaded: false },
})

const current = computed(() => tabState[activeTab.value])
const list = computed(() => current.value.list)
const page = computed({
  get: () => current.value.page,
  set: (v: number) => { current.value.page = v },
})
const totalPage = computed({
  get: () => current.value.totalPage,
  set: (v: number) => { current.value.totalPage = v },
})

const tabs: { name: TabName, label: string }[] = [
  { name: 'medal', label: '奖牌榜' },
  { name: 'score', label: '分数榜' },
  { name: 'coin', label: '财富榜' },
]

const columns = computed(() => {
  const base = [
    { prop: 'rank', label: '排名', width: 70 },
    { prop: 'avatar', label: '头像', width: 60 },
    { prop: 'nickName', label: '昵称' },
  ]
  if (activeTab.value === 'medal') {
    return [
      ...base,
      { prop: 'win', label: '胜场', width: 80 },
      { prop: 'lose', label: '败场', width: 80 },
      { prop: 'winRate', label: '胜率', width: 80 },
    ]
  }
  if (activeTab.value === 'score') {
    return [
      ...base,
      { prop: 'score', label: '分数', width: 100 },
    ]
  }
  return [
    ...base,
    { prop: 'stage', label: '财富', width: 100 },
  ]
})

function getRankClass(rank: number): string {
  if (rank === 1)
    return 'rank-1'
  if (rank === 2)
    return 'rank-2'
  if (rank === 3)
    return 'rank-3'
  return ''
}

function getRankIcon(rank: number): string {
  if (rank === 1)
    return '🥇'
  if (rank === 2)
    return '🥈'
  if (rank === 3)
    return '🥉'
  return ''
}

function getWinRate(item: RankItem): string {
  const total = item.win + item.lose
  if (total === 0)
    return '-'
  return `${((item.win / total) * 100).toFixed(1)}%`
}

async function fetchData(isRefresh = false) {
  if (isRefresh) {
    refreshing.value = true
    page.value = 1
  }
  else {
    loading.value = true
  }
  try {
    let result: { success: boolean, data?: any[], msg?: string }
    const apiPage = page.value - 1
    switch (activeTab.value) {
      case 'medal':
        result = await window.electronAPI.apiRequest('/Minesweeper/rank/chaos/list', 'POST', { page: apiPage, count: PAGE_SIZE })
        break
      case 'score':
        result = await window.electronAPI.apiRequest('/Minesweeper/rank/chaos/score/list', 'POST', { page: apiPage, count: PAGE_SIZE })
        break
      case 'coin':
        result = await window.electronAPI.apiRequest('/Minesweeper/rank/coin/list', 'POST', { page: apiPage, count: PAGE_SIZE })
        break
      default:
        return
    }
    if (result.success && result.data) {
      current.value.list = result.data as RankItem[]
      totalPage.value = result.data.length < PAGE_SIZE ? page.value : page.value + 1
      current.value.loaded = true
      // resolve avatar URLs to cached file:// paths
      for (const item of current.value.list) {
        if (item.user?.avatar) {
          resolveAndCache(item.user.avatar).then((cached) => {
            item.user.avatar = cached
          })
        }
      }
    }
    else {
      ElMessage.error(result.msg || '加载失败')
    }
  }
  catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  }
  finally {
    loading.value = false
    refreshing.value = false
    pullDistance.value = 0
  }
}

function switchTab(name: TabName) {
  if (activeTab.value === name)
    return
  activeTab.value = name
  if (!current.value.loaded) {
    fetchData()
  }
}

function onPageChange(p: number) {
  page.value = p
  fetchData()
}

// ============ pull-to-refresh ============
let tracking = false
let startY = 0
let moved = false

function onPointerDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  if (el.scrollTop > 0)
    return
  tracking = true
  moved = false
  startY = e.clientY
  el.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!tracking)
    return
  const dy = e.clientY - startY
  if (dy > 0) {
    moved = true
    pullDistance.value = Math.min(dy * 0.5, pullThreshold + 20)
  }
}

function onPointerUp(e: PointerEvent) {
  if (!tracking)
    return
  tracking = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  if (moved && pullDistance.value >= pullThreshold) {
    fetchData(true)
  }
  else {
    pullDistance.value = 0
  }
}

function onOpen() {
  if (!current.value.loaded) {
    fetchData()
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="排行榜"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
    @update:model-value="emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="rank-board">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.name"
          class="tab-btn" :class="[{ active: activeTab === tab.name }]"
          @click="switchTab(tab.name)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        class="table-wrap"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <!-- pull indicator -->
        <div class="pull-indicator" :style="{ height: `${pullDistance}px` }">
          <span v-if="refreshing" class="pull-text">刷新中...</span>
          <span v-else-if="pullDistance >= pullThreshold" class="pull-text ready">释放刷新</span>
          <span v-else-if="pullDistance > 0" class="pull-text">下拉刷新</span>
        </div>

        <table>
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.prop" :style="col.width ? { width: `${col.width}px` } : {}">
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in list"
              :key="item.uid"
              :class="[getRankClass(item.rank), { 'is-self': item.uid === currentUid }]"
            >
              <td class="col-rank">
                <span v-if="item.rank <= 3" class="rank-icon">{{ getRankIcon(item.rank) }}</span>
                <span v-else class="rank-num">{{ item.rank }}</span>
              </td>
              <td class="col-avatar">
                <img
                  :src="item.user.avatar || './assets/Z7.png'"
                  class="avatar"
                  @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                >
              </td>
              <td class="col-name">
                <span class="nick-name">{{ item.user.nickName }}</span>
              </td>
              <template v-if="activeTab === 'medal'">
                <td class="col-num win">
                  {{ item.win }}
                </td>
                <td class="col-num lose">
                  {{ item.lose }}
                </td>
                <td class="col-num rate">
                  {{ getWinRate(item) }}
                </td>
              </template>
              <template v-else-if="activeTab === 'score'">
                <td class="col-num score">
                  {{ item.score }}
                </td>
              </template>
              <template v-else>
                <td class="col-num coin">
                  {{ item.stage }}
                </td>
              </template>
            </tr>
            <tr v-if="!loading && list.length === 0">
              <td :colspan="columns.length" class="empty-row">
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="list.length > 0" class="pagination">
        <button
          class="page-btn"
          :disabled="page <= 1"
          @click="onPageChange(page - 1)"
        >
          上一页
        </button>
        <span class="page-info">{{ page }} / {{ totalPage }}</span>
        <button
          class="page-btn"
          :disabled="list.length < PAGE_SIZE"
          @click="onPageChange(page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <div class="dialog-footer">
      <el-button @click="emit('update:modelValue', false)">
        关闭
      </el-button>
    </div>
  </el-dialog>
</template>

<style scoped>
.rank-board {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tabs {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
html:not(.dark) .tabs {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.tab-btn {
  padding: 6px 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #999;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
html:not(.dark) .tab-btn {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
  color: #888;
}
.tab-btn:hover {
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.25);
}
html:not(.dark) .tab-btn:hover {
  color: #334155;
  border-color: rgba(0, 0, 0, 0.25);
}
.tab-btn.active {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.5);
  color: #60a5fa;
}
html:not(.dark) .tab-btn.active {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.4);
  color: #2563eb;
}

/* ====== pull indicator ====== */
.table-wrap {
  min-height: 200px;
  overflow-y: auto;
  max-height: 50vh;
  touch-action: pan-y;
}
.pull-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: height 0.15s ease-out;
}
.pull-text {
  font-size: 12px;
  color: #777;
  user-select: none;
}
.pull-text.ready {
  color: #60a5fa;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead th {
  padding: 8px 4px;
  text-align: left;
  font-weight: 600;
  color: #888;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
}
html:not(.dark) thead th {
  color: #64748b;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

tbody td {
  padding: 6px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}
html:not(.dark) tbody td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

tbody tr:hover {
  background: rgba(255, 255, 255, 0.04);
}
html:not(.dark) tbody tr:hover {
  background: rgba(0, 0, 0, 0.03);
}

tbody tr.rank-1 {
  background: rgba(255, 200, 40, 0.08);
}
tbody tr.rank-2 {
  background: rgba(180, 180, 200, 0.06);
}
tbody tr.rank-3 {
  background: rgba(210, 140, 80, 0.06);
}

tbody tr.is-self {
  outline: 1px solid rgba(96, 165, 250, 0.4);
  outline-offset: -1px;
  border-radius: 4px;
}

.col-rank {
  width: 70px;
  text-align: center;
}
.rank-icon {
  font-size: 16px;
}
.rank-num {
  color: #888;
}

.col-avatar {
  width: 60px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.12);
}
html:not(.dark) .avatar {
  border: 2px solid rgba(0, 0, 0, 0.12);
}

.nick-name {
  color: #e0e0e0;
  font-weight: 500;
}
html:not(.dark) .nick-name {
  color: #1e293b;
}

.col-num {
  text-align: center;
  font-weight: 600;
}
.win {
  color: #5eead4;
}
html:not(.dark) .win {
  color: #0d9488;
}
.lose {
  color: #f87171;
}
html:not(.dark) .lose {
  color: #dc2626;
}
.rate {
  color: #60a5fa;
}
html:not(.dark) .rate {
  color: #2563eb;
}
.score {
  color: #fbbf24;
}
html:not(.dark) .score {
  color: #d97706;
}
.coin {
  color: #fbbf24;
}
html:not(.dark) .coin {
  color: #d97706;
}

.empty-row {
  text-align: center;
  color: #666;
  padding: 40px 0;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 4px;
}

.page-btn {
  padding: 5px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #aaa;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
html:not(.dark) .page-btn {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
  color: #666;
}
.page-btn:hover:not(:disabled) {
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.25);
}
html:not(.dark) .page-btn:hover:not(:disabled) {
  color: #334155;
  border-color: rgba(0, 0, 0, 0.25);
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: #888;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
</style>
