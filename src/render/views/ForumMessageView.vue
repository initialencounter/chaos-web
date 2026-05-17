<script setup lang="ts">
import MessageView from '@tapsss/forum-shared/views/MessageView.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'

defineProps<{
  currentUid?: string
}>()
defineEmits<{ logout: [] }>()

const route = useRoute()

const query = computed(() => {
  return {
    currentUid: typeof route.query.currentUid == 'string' ? route.query.currentUid : '',
    toUid: typeof route.query.toUid == 'string' ? route.query.toUid : '',
    nickName: typeof route.query.nickName == 'string' ? route.query.nickName : '',
    avatarUrl: typeof route.query.avatarUrl == 'string' ? route.query.avatarUrl : '',
  }
})
</script>

<template>
  <NavBar />
  <MessageView :current-uid="query.currentUid" :to-uid="query.toUid" :nick-name="query.nickName" :avatar-url="query.avatarUrl" />
</template>
