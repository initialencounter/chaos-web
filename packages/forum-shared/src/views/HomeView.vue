<script setup lang="ts">
import type { PostListDatum } from '@tapsss/shared'
import { replaceEmojiStrings } from '@tapsss/shared/utils'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PostCard from '../components/PostCard.vue'
import { usePostStore } from '../stores'

defineOptions({ name: 'HomeView' })

const router = useRouter()
const postStore = usePostStore()
const posts = ref<PostListDatum[]>([])
const stickPosts = ref<PostListDatum[]>([])
const loading = ref(false)
const currentPage = ref(0)
const postsPerPage = 20
const postType = ref(0) // 0: 最新, 1: 热门, 3: 关注

async function loadPosts(type = 0, page = 0) {
  loading.value = true
  try {
    await postStore.fetchPostList(type, page, postsPerPage)
    const response = postStore.postList
    if (response?.code === 200 && response.data) {
      if (page === 0) {
        posts.value = response.data.filter((p: PostListDatum) => !p.stick)
        stickPosts.value = response.data.filter((p: PostListDatum) => p.stick)
      }
      else {
        posts.value.push(...response.data.filter((p: PostListDatum) => !p.stick))
        stickPosts.value.push(...response.data.filter((p: PostListDatum) => p.stick))
      }
    }
    else {
      console.error('Failed to fetch posts:', response?.msg)
    }
  }
  catch (error) {
    console.error('Error fetching posts:', error)
  }
  finally {
    loading.value = false
  }
}

function changeType(type: number) {
  postType.value = type
  currentPage.value = 0
  loadPosts(type, 0)
}

function loadMore() {
  currentPage.value++
  loadPosts(postType.value, currentPage.value)
}

function goToPostDetail(id: number) {
  router.push({ name: 'post', params: { id } })
}

onMounted(async () => {
  if (posts.value.length === 0) {
    await loadPosts()
  }
})
</script>

<template>
  <div class="home">
    <div class="header-nav">
      <div class="nav-left">
        <div class="avatar-placeholder" />
      </div>
      <div class="nav-center">
        <div class="nav-tab" :class="{ active: postType === 0 }" @click="changeType(0)">
          最新
        </div>
        <div class="nav-tab" :class="{ active: postType === 1 }" @click="changeType(1)">
          热门
        </div>
        <div class="nav-tab" :class="{ active: postType === 3 }" @click="changeType(3)">
          关注
        </div>
      </div>
      <div class="nav-right">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
    </div>

    <div class="stick-posts-container">
      <div v-if="stickPosts.length > 0" class="stick-posts">
        <div v-for="post in stickPosts" :key="post.id" class="stick-post-item" @click="goToPostDetail(post.id)">
          <span class="stick-badge">置顶</span>
          <div class="stick-post-title">
            {{ replaceEmojiStrings(post.title ?? '') }}
          </div>
        </div>
      </div>
    </div>

    <div class="posts-list-wrapper">
      <div v-if="loading && posts.length === 0" class="loading">
        加载中...
      </div>
      <div v-else-if="posts.length === 0" class="empty">
        暂无帖子
      </div>
      <div v-else>
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          class="post-item"
        />

        <div class="load-more">
          <button :disabled="loading" class="load-more-btn" @click="loadMore">
            {{ loading ? "加载中..." : "加载更多" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  background-color: #121212;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e0e0e0;
}

.header-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  background-color: #1b1b1b;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid #333;
}

.avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #333;
}

.nav-center {
  display: flex;
  gap: 20px;
}

.nav-tab {
  font-size: 16px;
  color: #999;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.nav-tab.active {
  color: #ffffff;
  font-weight: bold;
  font-size: 18px;
}

.nav-tab.active::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 4px;
  background-color: #fa7299;
  border-radius: 2px;
}

.search-icon {
  width: 24px;
  height: 24px;
  color: #e0e0e0;
}

.stick-posts-container {
  background-color: #1b1b1b;
  padding: 0 15px;
}

.stick-post-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #333;
  cursor: pointer;
}

.stick-post-item:last-child {
  border-bottom: none;
}

.stick-badge {
  font-size: 0.75rem;
  padding: 2px 4px;
  border-radius: 4px;
  background-color: #fa7299;
  color: white;
  margin-right: 8px;
  white-space: nowrap;
}

.stick-post-title {
  color: #e0e0e0;
  font-size: 0.95rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.posts-list-wrapper {
  background-color: #1b1b1b;
  padding: 15px;
  min-height: 50vh;
  margin-top: 10px;
}

.post-item {
  margin-bottom: 15px;
  border-bottom: 1px solid #333;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 1rem;
}

.load-more {
  text-align: center;
  margin-top: 20px;
  padding-bottom: 20px;
}

.load-more-btn {
  padding: 10px 24px;
  background-color: #2a2a2a;
  color: #e0e0e0;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
}

/* Deep overrides to theme PostCard properly as requested */
:deep(.post-card) {
  background-color: transparent !important;
  color: #e0e0e0 !important;
  padding: 15px 0 !important;
  border-radius: 0 !important;
  border: none !important;
  margin-bottom: 0 !important;
  border-bottom: 1px solid #333 !important;
}

:deep(.post-card:last-child) {
  border-bottom: none !important;
}

:deep(.post-card:hover) {
  background-color: transparent !important;
  transform: none !important;
  box-shadow: none !important;
}

:deep(.nickname) {
  color: #e0e0e0 !important;
}

:deep(.post-title) {
  color: #ffffff !important;
}

:deep(.post-content) {
  color: #ccc !important;
}

:deep(.last-comment) {
  background-color: #2a2a2a !important;
}

:deep(.lc-content) {
  color: #ccc !important;
}

:deep(.tag) {
  color: #fa7299 !important;
}

:deep(.like-btn),
:deep(.interaction) {
  color: #999 !important;
  background-color: transparent !important;
  border: none !important;
}

:deep(.time-device) {
  color: #999 !important;
}
</style>
