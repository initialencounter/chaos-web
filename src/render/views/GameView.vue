<script lang="ts" setup>
import { ref } from 'vue'
import Board from '@/components/Board.vue'
import CareerDialog from '@/components/CareerDialog.vue'
import Footer from '@/components/Footer.vue'
import RankBoard from '@/components/RankBoard.vue'

defineOptions({ name: 'GameView' })

const props = defineProps<{
  currentUid: string
}>()
const emit = defineEmits<{
  (e: 'logout'): void
}>()
const showRankBoard = ref(false)
const showCareer = ref(false)
</script>

<template>
  <div class="app-shell">
    <div class="app-header">
      <span class="app-title">Mines Client Lite</span>
      <div class="header-actions">
        <el-button size="small" plain @click="showRankBoard = true">
          排行榜
        </el-button>
        <el-button size="small" plain @click="showCareer = true">
          生涯
        </el-button>
        <el-button size="small" plain @click="$router.push({ name: 'forum-home' })">
          论坛
        </el-button>
        <el-button type="danger" size="small" plain @click="emit('logout')">
          退出登录
        </el-button>
      </div>
    </div>
    <el-container>
      <el-main>
        <Board />
      </el-main>
      <el-footer>
        <Footer />
      </el-footer>
    </el-container>
  </div>

  <RankBoard
    v-model="showRankBoard"
    :current-uid="props.currentUid"
  />

  <CareerDialog
    v-model="showCareer"
    :uid="props.currentUid"
  />
</template>
