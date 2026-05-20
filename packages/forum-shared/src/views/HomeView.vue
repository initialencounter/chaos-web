<script setup lang="ts">
import type { PostListDatum } from '@tapsss/shared'
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
    <div class="filter-tabs">
      <button
        class="tab-btn" :class="[{ active: postType === 0 }]"
        @click="changeType(0)"
      >
        最新
      </button>
      <button
        class="tab-btn" :class="[{ active: postType === 1 }]"
        @click="changeType(1)"
      >
        热门
      </button>
      <button
        class="tab-btn" :class="[{ active: postType === 3 }]"
        @click="changeType(3)"
      >
        关注
      </button>
    </div>

    <div class="stick-posts-container">
      <div v-if="stickPosts.length > 0" class="stick-posts">
        <div v-for="post in stickPosts" :key="post.id" class="stick-post-item" @click="goToPostDetail(post.id)">
          <span class="stick-badge">置顶</span>
          <div class="stick-post-title">
            {{ post.title }}
          </div>
        </div>
      </div>
    </div>

    <div class="posts-container">
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
  padding: 20px;
}

.forum-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #333;
}

.forum-header h1 {
  color: #ffffff;
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.subtitle {
  color: #999;
  font-size: 1.1rem;
  margin-bottom: 10px;
}

.filter-tabs {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
  justify-content: center;
}

.tab-btn {
  padding: 10px 20px;
  background-color: #2a2a2a;
  color: #ffffff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.tab-btn:hover {
  background-color: #3a3a3a;
}

.tab-btn.active {
  background-color: #fa7299;
  color: #ffffff;
}

.stick-posts-container {
  margin-bottom: 10px;
}

.stick-post-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #333;
  cursor: pointer;
  transition: opacity 0.3s;
}

.stick-post-item:last-child {
  border-bottom: none;
}

.stick-post-item:hover {
  opacity: 0.8;
}

.stick-badge {
  background-color: #fa7299;
  color: #fff;
  font-size: 0.85rem;
  padding: 3px 8px;
  border-radius: 4px;
  margin-right: 15px;
  white-space: nowrap;
}

.stick-post-title {
  color: #ddd;
  font-size: 1.05rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.posts-container {
  margin-bottom: 40px;
}

.post-item {
  margin-bottom: 20px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 1.2rem;
}

.load-more {
  text-align: center;
  margin-top: 30px;
}

.load-more-btn {
  padding: 12px 30px;
  background-color: #2a2a2a;
  color: #ffffff;
  border: 1px solid #444;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s;
}

.load-more-btn:hover:not(:disabled) {
  background-color: #3a3a3a;
  border-color: #fa7299;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .home {
    padding: 12px;
  }
}
</style>
