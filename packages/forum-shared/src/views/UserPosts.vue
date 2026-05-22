<script setup lang="ts">
import type { PostListDatum } from '@tapsss/shared'
import { onMounted, ref } from 'vue'
import PostCard from '../components/PostCard.vue'
import { useForumApi } from '../inject'

const props = defineProps<{
  uid: string
}>()

const api = useForumApi()
const posts = ref<PostListDatum[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const page = ref(0)
const hasMore = ref(true)

async function loadPosts(isLoadMore = false) {
  if (loading.value)
    return
  if (!isLoadMore) {
    page.value = 0
    posts.value = []
    hasMore.value = true
    error.value = null
  }
  if (!hasMore.value)
    return

  loading.value = true
  try {
    const res = await api.postListUser(Number(props.uid), page.value, 20)
    if (res && res.code === 200) {
      if (res.data) {
        if (isLoadMore) {
          posts.value.push(...res.data)
        }
        else {
          posts.value = res.data
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

onMounted(() => {
  loadPosts()
})
</script>

<template>
  <div class="user-posts">
    <div v-if="error" class="error-msg">
      {{ error }}
    </div>
    <div v-else class="post-list">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
      />
      <div v-if="loading" class="loading-more">
        加载中...
      </div>
      <div v-else-if="posts.length === 0" class="no-data">
        该用户暂无动态
      </div>
      <button v-else-if="hasMore" class="load-more-btn" @click="loadPosts(true)">
        加载更多
      </button>
      <div v-else class="no-more">
        没有更多动态了
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-posts {
  margin-top: 20px;
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
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
