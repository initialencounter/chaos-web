<script setup lang="ts">
import MessageView from '@tapsss/forum-shared/views/MessageView.vue'
import NavBar from '@/components/NavBar.vue'

defineProps<{ currentUid?: string }>()
defineEmits<{ logout: [] }>()
</script>

<template>
  <NavBar />
  <MessageView :current-uid="currentUid" />
</template>
