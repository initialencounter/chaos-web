<script setup lang="ts">
import type { MinesweeperRecordListDatum, NonoRecordListDatum, PuzzleRecordListDatum, SchulteRecordListDatum, TzfeRecordListDatum } from '@tapsss/shared'
import {
  getRankText,
  TIMING_LEVELS_COLOR,
  TIMING_LEVELS_TEXT_COLOR,
} from '@tapsss/shared'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from '../components/UserAvatar.vue'
import { useRecordStore } from '../stores/record'

const props = defineProps<{
  uid: string
}>()

const router = useRouter()
const recordStore = useRecordStore()

const tabs = ['扫雷', '舒尔特方格', '数字华容道', '2048', '数织']
const activeTab = ref(0)

const loading = ref(false)
const records = ref<(MinesweeperRecordListDatum | SchulteRecordListDatum | PuzzleRecordListDatum | TzfeRecordListDatum | NonoRecordListDatum)[]>([])
const page = ref(0)
const pageSize = 20

async function loadRecords(isLoadMore = false) {
  if (!props.uid)
    return

  if (!isLoadMore) {
    page.value = 0
    records.value = []
  }
  loading.value = true
  try {
    if (activeTab.value === 0) {
      await recordStore.fetchMinesweeperRecordList(props.uid, page.value, pageSize)
      if (recordStore.minesweeperRecordList?.code === 200 && recordStore.minesweeperRecordList.data) {
        if (isLoadMore) {
          records.value.push(...recordStore.minesweeperRecordList.data)
        }
        else {
          records.value = recordStore.minesweeperRecordList.data
        }
      }
    }
    else if (activeTab.value === 1) {
      await recordStore.fetchSchulteRecordList(props.uid, page.value, pageSize)
      if (recordStore.schulteRecordList?.code === 200 && recordStore.schulteRecordList.data) {
        if (isLoadMore) {
          records.value.push(...recordStore.schulteRecordList.data)
        }
        else {
          records.value = recordStore.schulteRecordList.data
        }
      }
    }
    else if (activeTab.value === 2) {
      await recordStore.fetchPuzzleRecordList(props.uid, page.value, pageSize)
      if (recordStore.puzzleRecordList?.code === 200 && recordStore.puzzleRecordList.data) {
        if (isLoadMore) {
          records.value.push(...recordStore.puzzleRecordList.data)
        }
        else {
          records.value = recordStore.puzzleRecordList.data
        }
      }
    }
    else if (activeTab.value === 3) {
      await recordStore.fetchTzfeRecordList(props.uid, page.value, pageSize)
      if (recordStore.tzfeRecordList?.code === 200 && recordStore.tzfeRecordList.data) {
        if (isLoadMore) {
          records.value.push(...recordStore.tzfeRecordList.data)
        }
        else {
          records.value = recordStore.tzfeRecordList.data
        }
      }
    }
    else if (activeTab.value === 4) {
      await recordStore.fetchNonoRecordList(props.uid, page.value, pageSize)
      if (recordStore.nonoRecordList?.code === 200 && recordStore.nonoRecordList.data) {
        if (isLoadMore) {
          records.value.push(...recordStore.nonoRecordList.data)
        }
        else {
          records.value = recordStore.nonoRecordList.data
        }
      }
    }
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
}

function switchTab(index: number) {
  activeTab.value = index
  loadRecords()
}

function loadMore() {
  page.value++
  loadRecords(true)
}

function formatDate(timestamp: number) {
  const d = new Date(timestamp)
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  if (d.getFullYear() !== new Date().getFullYear()) {
    return `${d.getFullYear()}-${m}-${day} ${h}:${min}`
  }
  return `${m}-${day} ${h}:${min}`
}

function getLevelText(type: number) {
  if (type === 0)
    return '初级'
  if (type === 1)
    return '中级'
  if (type === 2)
    return '高级'
  return '自定义'
}

function getModeText(mode: number) {
  if (mode === 0)
    return '标记'
  if (mode === 1)
    return '无标记'
  return ''
}

const tapMap: Record<number, string> = {
  0: '0',
  1: '3',
  2: '1',
  3: '2',
  4: '4',
}

function openReplay(recordId: number) {
  router.push({
    name: 'replay',
    params: { recordId, recordType: tapMap[activeTab.value] },
  })
}

onMounted(() => {
  loadRecords()
})
</script>

<template>
  <div class="record-list-container">
    <!-- Header tabs -->
    <div class="header-nav">
      <div class="top-bar">
        <button class="back-btn" @click="router.back()">
          <span class="back-icon">‹</span>
        </button>
        <span class="title">所有录像</span>
      </div>
      <div class="tabs">
        <div
          v-for="(tab, index) in tabs"
          :key="index"
          class="tab-item" :class="[{ active: activeTab === index }]"
          @click="switchTab(index)"
        >
          {{ tab }}
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="list-wrapper">
      <div v-if="loading && records.length === 0" class="loading">
        加载中...
      </div>
      <div v-else-if="records.length === 0" class="empty">
        暂无录像
      </div>
      <div v-else class="records">
        <div
          v-for="item in records"
          :key="item.id"
          class="record-card"
          @click="openReplay(item.id)"
        >
          <!-- User info -->
          <div class="card-header">
            <div class="user-info">
              <UserAvatar
                :user="item.user"
                :size="28"
                :disable-click="true"
                class="avatar"
              />
              <span class="nickname">{{ item.user.nickName }}</span>
              <span
                v-if="getRankText(item.user.timingLevel === -1 ? 0 : item.user.timingLevel, item.user.timingRank)"
                class="rank-badge"
                :style="{
                  backgroundColor: TIMING_LEVELS_COLOR[item.user.timingLevel === -1 ? 0 : item.user.timingLevel] || '#000',
                  color: TIMING_LEVELS_TEXT_COLOR[item.user.timingLevel === -1 ? 0 : item.user.timingLevel] || '#FFF',
                }"
              >
                {{ getRankText(item.user.timingLevel === -1 ? 0 : item.user.timingLevel, item.user.timingRank) }}
              </span>
            </div>
            <div v-if="activeTab === 0" class="tags">
              <span class="tag tag-classic">经典</span>
              <span v-if="getModeText((item as any).mode)" class="tag tag-border">{{
                getModeText((item as any).mode)
              }}</span>
            </div>
          </div>

          <!-- Score display -->
          <div class="score-container">
            <div class="score-left">
              <span v-if="activeTab === 0">{{ getLevelText((item as any).type) }}</span>
              <span v-else>{{ (item as any).row }}x{{ (item as any).column }}</span>
            </div>
            <div class="score-main">
              <div v-if="(item as any).time !== undefined" class="score-val">
                {{ ((item as any).time / 1000).toFixed(3) }}
              </div>
              <div v-else-if="(item as any).score !== undefined" class="score-val">
                {{ (item as any).score }}
              </div>
              <div class="score-lbl">
                时间
              </div>
            </div>
            <div class="score-sub">
              <template v-if="activeTab === 0 && (item as any).bvs">
                <div class="score-val">
                  {{ (item as any).bvs.toFixed(3) }}
                </div>
                <div class="score-lbl">
                  3BV/s
                </div>
              </template>
              <template v-else-if="activeTab === 1 && (item as any).tapCorrect">
                <div class="score-val">
                  {{ (item as any).tapCorrect }}
                </div>
                <div class="score-lbl">
                  正确点击
                </div>
              </template>
              <template v-else-if="activeTab === 2 && (item as any).step">
                <div class="score-val">
                  {{ (item as any).step }}
                </div>
                <div class="score-lbl">
                  步数
                </div>
              </template>
              <template v-else-if="activeTab === 4 && (item as any).mode !== undefined">
                <!-- nono default sub score -->
              </template>
            </div>
          </div>

          <!-- Footer -->
          <div class="card-footer">
            <span class="date">{{ formatDate((item as any).createTime) }}</span>
            <span class="play-count"><span class="play-icon">▷</span> {{ (item as any).playCount || 0 }}</span>
          </div>
        </div>

        <div
          v-if="records.length > 0 && records.length % pageSize === 0"
          class="load-more-btn"
          @click="loadMore"
        >
          加载更多
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.record-list-container {
  background-color: #121212;
  min-height: 100vh;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
}

.header-nav {
  position: sticky;
  top: 0;
  background-color: #1b1b1b;
  z-index: 10;
  padding-top: 10px;
}

.top-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 18px;
  font-weight: bold;
}

.back-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  line-height: 1;
  margin-right: 15px;
  cursor: pointer;
}

.tabs {
  display: flex;
  overflow-x: auto;
  gap: 20px;
  padding: 10px 16px;
  border-bottom: 1px solid #333;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-item {
  white-space: nowrap;
  padding-bottom: 8px;
  color: #999;
  cursor: pointer;
  font-size: 15px;
}

.tab-item.active {
  color: #fa7299;
  font-weight: bold;
  border-bottom: 2px solid #fa7299;
}

.list-wrapper {
  padding: 16px;
  flex: 1;
}

.loading,
.empty {
  text-align: center;
  color: #888;
  padding: 40px 0;
}

.records {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-card {
  background-color: #242424;
  border-radius: 6px;
  padding: 14px;
  cursor: pointer;
  transition:
    transform 0.2s,
    background-color 0.2s;
}

.record-card:hover {
  background-color: #2a2a2a;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  border-radius: 50%;
  object-fit: cover;
}

.nickname {
  font-size: 14px;
  color: #fff;
}

.rank-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  white-space: nowrap;
}

.tags {
  display: flex;
  gap: 6px;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

.tag-classic {
  color: #fa7299;
  background-color: rgba(250, 114, 153, 0.1);
}

.tag-border {
  color: #aaa;
  border: 1px solid #555;
}

.score-container {
  display: flex;
  background-color: #333;
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 12px;
  align-items: center;
}

.score-left {
  flex: 1;
  font-size: 15px;
  color: #fff;
}

.score-main {
  flex: 1;
  text-align: center;
}

.score-sub {
  flex: 1;
  text-align: center;
}

.score-val {
  font-size: 20px;
  color: #fff;
  margin-bottom: 4px;
}

.score-lbl {
  font-size: 12px;
  color: #888;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #777;
}

.play-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.play-icon {
  font-size: 14px;
}

.load-more-btn {
  text-align: center;
  padding: 14px;
  color: #fa7299;
  background-color: #242424;
  border-radius: 6px;
  cursor: pointer;
}
.load-more-btn:hover {
  background-color: #2a2a2a;
}
</style>
