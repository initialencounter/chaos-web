<script setup lang="ts">
import HomeView from '@tapsss/forum-shared/views/HomeView.vue'
import NavBar from '@/components/NavBar.vue'

defineProps<{ currentUid?: string }>()
defineEmits<{ logout: [] }>()
</script>

<template>
  <NavBar />
  <HomeView />
</template>
