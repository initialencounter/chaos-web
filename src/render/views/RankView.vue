<script setup lang="ts">
import CompositeRankBoard from '@tapsss/forum-shared/components/CompositeRankBoard.vue'
import NavBar from '@/components/NavBar.vue'

defineProps<{
  currentUid: string
}>()
</script>

<template>
  <NavBar />
  <div class="rank-page">
    <CompositeRankBoard :current-uid="currentUid" />
  </div>
</template>

<style scoped>
.rank-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
</style>
