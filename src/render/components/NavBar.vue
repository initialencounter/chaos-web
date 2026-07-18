<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

function goToHome() {
  router.push({ name: 'forum-home' })
}
</script>

<template>
  <nav class="navbar">
    <div class="nav-container">
      <div class="nav-left">
        <router-link :to="{ name: 'game' }" class="back-link">
          ← 返回游戏
        </router-link>
        <span class="nav-divider" />
        <span class="brand-text" @click="goToHome">联萌社区</span>
      </div>

      <div class="nav-links">
        <router-link
          :to="{ name: 'forum-home' }"
          class="nav-link"
          :class="{ active: route.path === '/forum' }"
        >
          首页
        </router-link>
        <router-link
          :to="{ name: 'post-new' }"
          class="nav-link"
        >
          发布
        </router-link>
        <router-link
          :to="{ name: 'message' }"
          class="nav-link"
          :class="{ active: route.path === '/forum/message' }"
        >
          消息
        </router-link>
        <router-link
          :to="{ name: 'search' }"
          class="nav-link"
          :class="{ active: route.path === '/forum/search' }"
        >
          搜索
        </router-link>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  border-bottom: 1px solid #333;
  padding: 0 20px;
  height: 48px;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-link {
  color: #9ea1a6;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
  white-space: nowrap;
}

.back-link:hover {
  color: #fa7299;
}

.nav-divider {
  width: 1px;
  height: 18px;
  background-color: #444;
}

.brand-text {
  font-size: 1.1rem;
  font-weight: bold;
  color: #ffffff;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  color: #9ea1a6;
  text-decoration: none;
  font-size: 0.9rem;
  padding: 6px 14px;
  border-radius: 16px;
  transition: all 0.2s;
  white-space: nowrap;
}

.nav-link:hover {
  color: #ffffff;
  background-color: #2a2a2a;
}

.nav-link.active {
  color: #ffffff;
  background-color: #fa7299;
}

@media (max-width: 768px) {
  .navbar {
    height: auto;
    padding: 10px 20px;
  }

  .nav-container {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
