<script lang="ts" setup>
import { ref } from 'vue'

const scoreTipList = ref<{
  name: string
}[]>([])
function tips(score: number, doubleScore = false) {
  if (score === 0)
    return
  const displayScore = doubleScore ? score * 2 : score
  const tipText = `积分${displayScore > 0 ? `+${displayScore}` : displayScore
  }${doubleScore ? ' ⚡x2' : ''}`
  if (scoreTipList.value.length > 10)
    scoreTipList.value = []
  scoreTipList.value.push({ name: tipText })
}

defineExpose({
  tips,
})
</script>

<template>
  <div>
    <div v-for="(item, idx) of scoreTipList" :key="idx">
      <div class="animated-div" :class="{ 'double-tip': item.name.includes('x2') }">
        {{ item.name }}
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes moveAndFade {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-20px);
    opacity: 0;
  }
}

.animated-div {
  position: absolute;
  top: 0;
  color: #5eead4;
  font-weight: 700;
  font-size: 15px;
  width: 10rem;
  opacity: 0;
  text-shadow: 0 0 10px rgba(94, 234, 212, 0.5);
  animation: moveAndFade 2s ease-out;
}
.double-tip {
  color: #fbbf24;
  font-size: 17px;
  text-shadow: 0 0 14px rgba(251, 191, 36, 0.6);
}
</style>
