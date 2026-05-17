<script setup lang="ts">
import SearchView from '@tapsss/forum-shared/views/SearchView.vue'
import NavBar from '@/components/NavBar.vue'

defineProps<{ currentUid?: string }>()
defineEmits<{ logout: [] }>()
</script>

<template>
  <NavBar />
  <SearchView />
</template>
