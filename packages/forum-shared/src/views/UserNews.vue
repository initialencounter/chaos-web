<script setup lang="ts">
import { recordBgColor, recordTextColor } from '@tapsss/shared/utils'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForumApi } from '../inject'

interface NewsItem {
  id: number
  uid: string
  text: string
  recordType: number
  recordId: number
  route: string | null
  createTime: number
}

const props = defineProps<{
  uid: string
}>()

const api = useForumApi()
const router = useRouter()
const news = ref<NewsItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const page = ref(0)
const hasMore = ref(true)

async function loadNews(isLoadMore = false) {
  if (loading.value) {
    return
  }
  if (!isLoadMore) {
    page.value = 0
    news.value = []
    hasMore.value = true
    error.value = null
  }
  if (!hasMore.value) {
    return
  }

  loading.value = true
  try {
    const res = await api.gameNewsUser(Number(props.uid), -1, page.value, 20)
    if (res && res.code === 200) {
      if (res.data) {
        if (isLoadMore) {
          news.value.push(...res.data)
        }
        else {
          news.value = res.data
        }
        if (res.data.length < 20) {
          hasMore.value = false
        }
        else {
          page.value++
        }
      }
      else {
        hasMore.value = false
      }
    }
    else {
      error.value = res.msg || '获取动态失败'
    }
  }
  catch (err) {
    console.error(err)
    error.value = '加载发生错误'
  }
  finally {
    loading.value = false
  }
}

function handleNewsClick(item: NewsItem) {
  if (item.recordId) {
    router.push({
      name: 'replay',
      params: {
        recordId: item.recordId.toString(),
        recordType: item.recordType.toString(),
      },
    })
  }
  else if (item.route) {
    router.push(item.route)
  }
}

function getRecordBg(type: number): string {
  return recordBgColor[type] || '#1e1e1e'
}

function getRecordColor(type: number): string {
  return recordTextColor[type] || '#aaa'
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60 * 1000) {
    return '刚刚'
  }
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

onMounted(() => {
  loadNews()
})
</script>

<template>
  <div class="user-news">
    <div v-if="error" class="error-msg">
      {{ error }}
    </div>
    <div v-else class="news-list">
      <div
        v-for="item in news"
        :key="item.id"
        class="news-card"
        :class="{ clickable: !!item.recordId || !!item.route }"
        :style="{ backgroundColor: getRecordBg(item.recordType) }"
        @click="handleNewsClick(item)"
      >
        <div class="news-icon">
          <img
            :src="`./icon/${item.recordType}.png`"
            alt="icon"
          >
        </div>
        <div class="news-content">
          <div class="news-text" :style="{ color: getRecordColor(item.recordType) }">
            {{ item.text }}
          </div>
          <div class="news-time">
            {{ formatTime(item.createTime) }}
          </div>
        </div>
      </div>
      <div v-if="loading" class="loading-more">
        加载中...
      </div>
      <div v-else-if="news.length === 0" class="no-data">
        暂无动态
      </div>
      <button v-else-if="hasMore" class="load-more-btn" @click="loadNews(true)">
        加载更多
      </button>
      <div v-else class="no-more">
        没有更多了
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-news {
  margin-top: 20px;
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.news-card {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 10px;
  padding: 14px 16px;
  transition: background 0.2s;
}

.news-card.clickable {
  cursor: pointer;
}

.news-icon img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
}

.news-content {
  flex: 1;
  min-width: 0;
}

.news-text {
  font-size: 0.95rem;
  line-height: 1.4;
  word-break: break-all;
}

.news-time {
  font-size: 0.8rem;
  color: #888;
  margin-top: 6px;
}

.loading-more,
.no-more,
.no-data,
.error-msg {
  text-align: center;
  color: #888;
  padding: 20px;
}

.error-msg {
  color: #fa7299;
}

.load-more-btn {
  display: block;
  width: 100%;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fa7299;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 15px;
  transition: all 0.3s;
}

.load-more-btn:hover {
  background: #333;
  border-color: #fa7299;
}
</style>
