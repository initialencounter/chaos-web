<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MinesweeperPlayer from '../components/MinesweeperPlayer.vue'
import NonoPlayer from '../components/NonoPlayer.vue'
import PuzzlePlayer from '../components/PuzzlePlayer.vue'
import SchultePlayer from '../components/SchultePlayer.vue'
import TzfePlayer from '../components/TzfePlayer.vue'

defineOptions({ name: 'ReplayDetailView' })

const route = useRoute()
const router = useRouter()

const recordId = route.params.recordId as string
const recordType = (route.params.recordType as string) || '0'

const minesweeperRef = ref<InstanceType<typeof MinesweeperPlayer> | null>(null)
const nonoRef = ref<InstanceType<typeof NonoPlayer> | null>(null)
const puzzleRef = ref<InstanceType<typeof PuzzlePlayer> | null>(null)
const schulteRef = ref<InstanceType<typeof SchultePlayer> | null>(null)
const tzfeRef = ref<InstanceType<typeof TzfePlayer> | null>(null)

const postId = computed(() => {
  const ref = minesweeperRef.value || nonoRef.value || puzzleRef.value || schulteRef.value || tzfeRef.value
  return (ref?.replayData as any)?.postId ?? null
})

function goBack() {
  router.go(-1)
}

function goToPost() {
  if (postId.value) {
    router.push({ name: 'post', params: { id: postId.value } })
  }
}
</script>

<template>
  <div class="replay-view">
    <div class="header">
      <button class="back-btn" @click="goBack">
        ← 返回
      </button>
      <button v-if="postId" class="post-btn" @click="goToPost">
        📝 查看帖子
      </button>
      <h1>录像回放 #{{ recordId }}</h1>
    </div>
    <div v-if="recordType === '0'">
      <MinesweeperPlayer ref="minesweeperRef" :record-id="recordId" />
    </div>
    <div v-else-if="recordType === '1'">
      <PuzzlePlayer ref="puzzleRef" :record-id="recordId" />
    </div>
    <div v-else-if="recordType === '4'">
      <NonoPlayer ref="nonoRef" :record-id="recordId" />
    </div>
    <div v-else-if="recordType === '3'">
      <SchultePlayer ref="schulteRef" :record-id="recordId" />
    </div>
    <div v-else-if="recordType === '2'">
      <TzfePlayer ref="tzfeRef" :record-id="recordId" />
    </div>
    <div v-else>
      <p>未知的录像类型: {{ recordType }}</p>
    </div>
  </div>
</template>

<style scoped>
.replay-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 1.8rem;
  color: #fff;
  margin: 0;
}

.back-btn {
  display: inline-block;
  color: #fa7299;
  text-decoration: none;
  font-size: 1rem;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background-color: #2a2a2a;
  border-color: #fa7299;
}

.post-btn {
  display: inline-block;
  color: #5d9cec;
  text-decoration: none;
  font-size: 1rem;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.post-btn:hover {
  background-color: #2a2a2a;
  border-color: #5d9cec;
}

@media (max-width: 768px) {
  .replay-view {
    padding: 12px;
  }
}
</style>
