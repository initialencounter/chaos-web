<script lang="ts" setup>
import {ref} from "vue";

const scoreTipList = ref<{
  name: string
}[]>([])
const tips = (score: number) => {
  if (score === 0) return
  const tipText = '积分' + (score > 0 ? '+' + score : score)
  if(scoreTipList.value.length > 10) scoreTipList.value=[]
  scoreTipList.value.push({name: tipText})
}

defineExpose({
  tips
})

</script>

<template>
  <div>
    <div v-for="(item) of scoreTipList">
      <div class="animated-div">
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

</style>