<script setup lang="ts">
import type {
  HomeUser,
  MinesweeperCareerResponse,
  NonoCareerResponse,
  PuzzleCareerResponse,
  SaoleiOauth,
  SchulteCareerResponse,
  SudokuCareerResponse,
  TzfeCareerResponse,
  UserMatchMedal,
} from '@tapsss/shared'
import { formatTime, replaceEmojiStrings } from '@tapsss/shared/utils'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { resolveAsset } from '../inject'
import { useCareerStore } from '../stores/career'
import { useUserStore } from '../stores/user'
import RadarChart from './RadarChart.vue'

const props = defineProps<{
  user: HomeUser
  saolei?: SaoleiOauth | null
  userMatchMedals?: UserMatchMedal[]
}>()

const emit = defineEmits<{
  (e: 'relationChange', relation: number): void
}>()

const router = useRouter()
const userStore = useUserStore()
const careerStore = useCareerStore()

const cachedSaoleiAvatar = ref('')
const cachedMedalIcons = ref<Record<number, string>>({})
const togglingFollow = ref(false)
const togglingBlock = ref(false)

// ---- 生涯数据（用于雷达图） ----
const minesweeperData = ref<MinesweeperCareerResponse['data'] | null>(null)
const puzzleData = ref<PuzzleCareerResponse['data'] | null>(null)
const nonoData = ref<NonoCareerResponse['data'] | null>(null)
const sudokuData = ref<SudokuCareerResponse['data'] | null>(null)
const tzfeData = ref<TzfeCareerResponse['data'] | null>(null)
const schulteData = ref<SchulteCareerResponse['data'] | null>(null)

onMounted(async () => {
  const uid = props.user.id
  if (!uid)
    return
  try {
    await Promise.all([
      careerStore.fetchMinesweeperCareer(uid),
      careerStore.fetchPuzzleCareer(uid),
      careerStore.fetchNonoCareer(uid),
      careerStore.fetchSudokuCareer(uid),
      careerStore.fetchTzfeCareer(uid),
      careerStore.fetchSchulteCareer(uid),
    ])
    if (careerStore.minesweeper?.code === 200)
      minesweeperData.value = careerStore.minesweeper.data
    if (careerStore.puzzle?.code === 200)
      puzzleData.value = careerStore.puzzle.data
    if (careerStore.nono?.code === 200)
      nonoData.value = careerStore.nono.data
    if (careerStore.sudoku?.code === 200)
      sudokuData.value = careerStore.sudoku.data
    if (careerStore.tzfe?.code === 200)
      tzfeData.value = careerStore.tzfe.data
    if (careerStore.schulte?.code === 200)
      schulteData.value = careerStore.schulte.data
  }
  catch (err) {
    console.error('获取生涯数据失败:', err)
  }
})

const radarRanks = computed<number[]>(() => [
  minesweeperData.value?.totalTimeRank?.rank ?? 3000,
  schulteData.value?.rank ?? 3000,
  puzzleData.value?.infoTotal?.rank ?? 3000,
  tzfeData.value?.rankTime ?? tzfeData.value?.rankScore ?? 3000,
  sudokuData.value?.rank ?? 3000,
  nonoData.value?.totalTimeRank?.rank ?? 3000,
])

watch(() => props.saolei?.avatar, async (url) => {
  cachedSaoleiAvatar.value = await resolveAsset(url)
}, { immediate: true })

watch(() => props.userMatchMedals, async (medals) => {
  if (!medals)
    return
  const map: Record<number, string> = {}
  await Promise.all(medals.map(async (medal, idx) => {
    if (medal.icon) {
      map[idx] = await resolveAsset(medal.icon)
    }
  }))
  cachedMedalIcons.value = map
}, { immediate: true })

async function toggleFollow() {
  if (togglingFollow.value)
    return
  togglingFollow.value = true
  try {
    const newRelation = props.user.relation === 1 ? 0 : 1
    const res = await userStore.setRelation(props.user.id, newRelation)
    if (res.code === 200) {
      emit('relationChange', newRelation)
    }
  }
  catch (e) {
    console.error('关注操作失败:', e)
  }
  finally {
    togglingFollow.value = false
  }
}

async function toggleBlock() {
  if (togglingBlock.value)
    return
  togglingBlock.value = true
  try {
    const newRelation = props.user.relation === 0 ? 2 : 0
    const res = await userStore.setRelation(props.user.id, newRelation)
    if (res.code === 200) {
      emit('relationChange', newRelation)
    }
  }
  catch (e) {
    console.error('拉黑操作失败:', e)
  }
  finally {
    togglingBlock.value = false
  }
}

function goMessage() {
  router.push({
    name: 'message',
    query: { toUid: props.user.id, nickName: props.user.nickName, avatarUrl: props.user.avatar },
  })
}
</script>

<template>
  <div class="about-ta">
    <div class="relation-actions">
      <button
        class="relation-btn"
        :class="{ active: user.relation === 1 }"
        :disabled="togglingFollow"
        @click="toggleFollow"
      >
        {{ user.relation === 1 ? '已关注' : '关注' }}
      </button>
      <button
        class="relation-btn block-btn"
        :class="{ active: user.relation === 3 }"
        :disabled="togglingBlock"
        @click="toggleBlock"
      >
        {{ user.relation === 2 ? '已拉黑' : '拉黑' }}
      </button>
      <button
        class="relation-btn message-btn"
        @click="goMessage"
      >
        私信
      </button>
    </div>

    <div class="details-section">
      <h3>基本资料</h3>
      <div class="profile-content">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="lbl">UID</span>
            <span class="val">{{ user.uid }}</span>
          </div>
          <div class="detail-item">
            <span class="lbl">注册时间</span>
            <span class="val">{{
              new Date(user.createTime)
                .toISOString()
                .substring(0, 10)
                .replace(/-/g, "/")
            }}</span>
          </div>
          <div class="detail-item">
            <span class="lbl">人气</span>
            <span class="val">{{ user.visits }}</span>
          </div>
          <div class="detail-item">
            <span class="lbl">地区</span>
            <span class="val">{{ user.country || "暂无" }}
              {{ user.province ? `- ${user.province}` : "" }}</span>
          </div>

          <div class="detail-item">
            <span class="lbl">账号状态</span>
            <span class="val">
              <span v-if="user.accountStatus === 0">正常</span>
              <span v-else class="danger-text">异常 (状态码: {{ user.accountStatus }})</span>
            </span>
          </div>

          <div class="detail-item">
            <span class="lbl">简介</span>
            <span class="val">{{
              replaceEmojiStrings(user.sign || "这个人很懒，什么都没有留下")
            }}</span>
          </div>
        </div>
        <div class="radar-chart-area">
          <RadarChart :ranks="radarRanks" />
        </div>
      </div>
    </div>

    <div v-if="saolei" class="saolei-section">
      <h3>扫雷网绑定</h3>
      <div class="saolei-card">
        <img
          class="saolei-avatar"
          :src="cachedSaoleiAvatar"
          alt="saolei avatar"
        >
        <div class="saolei-info">
          <div class="saolei-name">
            {{ saolei.name }} <span class="lbl">(ID: {{ saolei.openId }})</span>
          </div>
          <div class="saolei-time">
            绑定于: {{ formatTime(parseInt(saolei.createTime) || 0) }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="userMatchMedals?.length" class="medals-section">
      <h3>比赛奖牌</h3>
      <div class="medals">
        <div
          v-for="(medal, idx) in userMatchMedals"
          :key="medal.id"
          class="medal-item"
          :title="`Rank: ${medal.rank}`"
        >
          <img v-if="cachedMedalIcons[idx]" :src="cachedMedalIcons[idx]" :alt="medal.title">
          <div class="medal-info">
            <div class="medal-title">
              {{ medal.title }}
            </div>
            <div class="medal-rank">
              No.{{ medal.rank }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relation-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.relation-btn {
  padding: 8px 24px;
  border: 1px solid #555;
  border-radius: 20px;
  background: transparent;
  color: #ccc;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s;
}

.relation-btn:hover:not(:disabled) {
  border-color: #fa7299;
  color: #fa7299;
}

.relation-btn.active {
  background: #fa7299;
  border-color: #fa7299;
  color: #fff;
}

.relation-btn.block-btn:hover:not(:disabled) {
  border-color: #f44336;
  color: #f44336;
}

.relation-btn.block-btn.active {
  background: #f44336;
  border-color: #f44336;
  color: #fff;
}

.relation-btn.message-btn:hover {
  border-color: #4fc3f7;
  color: #4fc3f7;
}

.relation-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

h3 {
  border-bottom: 1px solid #444;
  padding-bottom: 8px;
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2rem;
  color: #eee;
}

.details-section,
.saolei-section,
.medals-section {
  background: #252525;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 15px;
  flex: 1;
  min-width: 0;
}

/* 基本资料 + 雷达图 左右布局 */
.profile-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.radar-chart-area {
  flex: 0 0 280px;
  width: 280px;
}

/* 覆盖 RadarChart 在侧栏中的多余样式 */
:deep(.radar-section) {
  padding: 0;
  border-bottom: none;
}

:deep(.radar-wrapper) {
  max-width: 280px;
}

@media (max-width: 768px) {
  .profile-content {
    flex-direction: column-reverse;
    align-items: center;
  }
  .radar-chart-area {
    flex: 0 0 auto;
    width: 100%;
    max-width: 320px;
  }
  :deep(.radar-wrapper) {
    max-width: 320px;
    margin: 0 auto;
  }
}
.detail-item {
  display: flex;
  flex-direction: column;
}
.detail-item .lbl {
  color: #aaa;
  font-size: 0.85rem;
  margin-bottom: 4px;
}
.detail-item .val {
  font-size: 1rem;
}
.danger-text {
  color: #f44336;
}

.saolei-card {
  display: flex;
  align-items: center;
  gap: 15px;
  background: #333;
  padding: 15px;
  border-radius: 8px;
}
.saolei-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid #555;
}
.saolei-name {
  font-size: 1.1rem;
  font-weight: bold;
}
.saolei-name .lbl {
  font-size: 0.9rem;
  color: #bbb;
  font-weight: normal;
}
.saolei-time {
  font-size: 0.85rem;
  color: #999;
  margin-top: 5px;
}

.medals {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}
.medal-item {
  background: #333;
  padding: 10px 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.medal-item img {
  width: 40px;
  height: 40px;
}
.medal-info {
  display: flex;
  flex-direction: column;
}
.medal-title {
  font-weight: bold;
  font-size: 1rem;
}
.medal-rank {
  font-size: 0.85rem;
  color: #ff9800;
  margin-top: 3px;
}
</style>
