<script setup lang="ts">
import type { SearchUser } from '@tapsss/shared'
import { getRankText, replaceEmojiStrings, TIMING_LEVELS_COLOR, TIMING_LEVELS_TEXT_COLOR } from '@tapsss/shared/utils'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{
  user: SearchUser
}>()

const levelIndex = computed(() =>
  props.user.timingLevel === -1 ? 0 : props.user.timingLevel,
)

const rankStyle = computed(() => ({
  backgroundColor: TIMING_LEVELS_COLOR[levelIndex.value ?? 0] || '#000',
  color: TIMING_LEVELS_TEXT_COLOR[levelIndex.value ?? 0] || '#FFF',
}))

const router = useRouter()

function goToUser() {
  if (props.user.uid) {
    router.push({ name: 'user', params: { uid: props.user.uid } })
  }
}
</script>

<template>
  <div class="user-card" @click="goToUser">
    <div class="user-info">
      <div class="left-section">
        <UserAvatar :user="user" :size="50" class="avatar" />
        <div class="details">
          <div class="header">
            <span class="nickname" :class="[{ 'is-vip': user.vip }]">{{ user.nickName }}</span>
            <span
              v-if="getRankText(levelIndex ?? 0, user.timingRank ?? 0)"
              class="rank-badge"
              :style="rankStyle"
            >
              {{ getRankText(levelIndex ?? 0, user.timingRank ?? 0) }}
            </span>
            <span v-if="user.sex === 1" class="gender male">♂</span>
            <span v-if="user.sex === 2" class="gender female">♀</span>
          </div>
          <div class="stats">
            <span class="uid">uid: {{ user.uid }}</span>
          </div>
        </div>
      </div>
      <div v-if="user.sign" class="right-section">
        <div class="sign" :title="replaceEmojiStrings(user.sign)">
          {{ replaceEmojiStrings(user.sign) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-card {
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
  color: #fff;
  border: 1px solid transparent;
}

.user-card:hover {
  transform: translateY(-2px);
  background-color: #333;
  border-color: #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.right-section {
  flex-shrink: 0;
  max-width: 40%;
  text-align: right;
  border-left: 1px dashed #444;
  padding-left: 16px;
}

.avatar {
  flex-shrink: 0;
}

.details {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.nickname {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nickname.is-vip {
  color: #ff0000;
}

.gender {
  font-weight: bold;
  font-size: 1.1rem;
}

.gender.male {
  color: #5db9ff;
}

.gender.female {
  color: #ff5d9e;
}

.sign {
  font-size: 0.9rem;
  color: #999;
  font-style: italic;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  word-break: break-word;
}

.stats {
  font-size: 0.85rem;
  color: #888;
}

.rank-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .user-card {
    padding: 12px;
  }
}
</style>
