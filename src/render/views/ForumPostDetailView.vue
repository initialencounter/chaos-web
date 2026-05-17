<script setup lang="ts">
import PostDetailView from '@tapsss/forum-shared/views/PostDetailView.vue'
import NavBar from '@/components/NavBar.vue'

const props = defineProps<{
  id: string
}>()
</script>

<template>
  <NavBar />
  <PostDetailView :id="props.id" />
</template>
