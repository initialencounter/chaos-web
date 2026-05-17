<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useResolveAsset } from '../inject'

const props = withDefaults(defineProps<{
  user?: {
    uid?: string | null
    id?: number | null
    avatar?: string | null
  } | null
  size?: number | string
  className?: string
}>(), {
  size: 50,
  className: '',
})

const router = useRouter()
const resolveAsset = useResolveAsset()

const cachedSrc = ref('')

async function loadAvatar() {
  cachedSrc.value = await resolveAsset(props.user?.avatar)
}

onMounted(loadAvatar)
watch(() => props.user?.avatar, loadAvatar)

const style = computed(() => {
  const s = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: s,
    height: s,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    cursor: 'pointer',
  }
})

function goToUser() {
  const uid = props.user?.uid || props.user?.id
  if (!uid)
    return
  router.push({ name: 'user', params: { uid: uid.toString() } })
}
</script>

<template>
  <img
    :class="className"
    :src="cachedSrc"
    :style="style"
    alt="avatar"
    @click.stop="goToUser"
  >
</template>
