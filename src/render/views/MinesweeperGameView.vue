<script lang="ts" setup>
import MinesweeperGame from '@tapsss/forum-shared/components/MinesweeperGame.vue'
</script>

<template>
  <div class="minesweeper-game-page">
    <div class="page-header">
      <el-button plain size="small" @click="$router.push({ name: 'game' })">
        ← 返回
      </el-button>
      <h2>扫雷</h2>
    </div>
    <MinesweeperGame />
  </div>
</template>

<style scoped>
.minesweeper-game-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #fff;
}
</style>
