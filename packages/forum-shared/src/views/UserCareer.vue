<script setup lang="ts">
import type {
  MinesweeperCareerResponse,
  NonoCareerResponse,
  PuzzleCareerResponse,
  SchulteCareerResponse,
  SudokuCareerResponse,
  TzfeCareerResponse,
} from '@tapsss/shared'
import { onMounted, ref } from 'vue'
import { useCareerStore } from '../stores/career'

const props = defineProps<{
  uid: string
}>()

const careerStore = useCareerStore()
const loading = ref(true)
const error = ref<string | null>(null)

const minesweeperData = ref<MinesweeperCareerResponse['data'] | null>(null)
const puzzleData = ref<PuzzleCareerResponse['data'] | null>(null)
const nonoData = ref<NonoCareerResponse['data'] | null>(null)
const sudokuData = ref<SudokuCareerResponse['data'] | null>(null)
const tzfeData = ref<TzfeCareerResponse['data'] | null>(null)
const schulteData = ref<SchulteCareerResponse['data'] | null>(null)

onMounted(async () => {
  const uid = Number(props.uid)
  if (!uid) {
    error.value = '无效的用户ID'
    loading.value = false
    return
  }

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
    error.value = '加载数据失败'
    console.error(err)
  }
  finally {
    loading.value = false
  }
})

function formatTime(ms: number) {
  if (ms === undefined || ms === null || ms === 0)
    return '-'
  return (ms / 1000).toFixed(3)
}

function getRank(rank?: number) {
  return rank ? `#${rank}` : '-'
}

function getScore(score: number) {
  return score ?? '-'
}
</script>

<template>
  <div class="career-container">
    <div v-if="loading" class="loading">
      Loading...
    </div>
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    <div v-else class="sections">
      <!-- 扫雷 -->
      <div v-if="minesweeperData" class="game-section">
        <div class="section-header">
          <div class="header-mark" />
          <h2>扫雷</h2>
          <span class="badge">多指FL</span>
        </div>
        <div class="stats-list">
          <div class="stat-row">
            <span class="label">初级</span>
            <router-link
              v-if="minesweeperData.begTimeRank?.record?.id"
              :to="{ name: 'replay', params: { recordId: minesweeperData.begTimeRank.record.id.toString(), recordType: '0' } }"
              class="value link"
            >
              {{ formatTime(minesweeperData.begTimeRank?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(minesweeperData.begTimeRank?.time ?? 0)
            }}</span>
            <span class="rank">{{
              getRank(minesweeperData.begTimeRank?.rank)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="label">中级</span>
            <router-link
              v-if="minesweeperData.intTimeRank?.record?.id"
              :to="{ name: 'replay', params: { recordId: minesweeperData.intTimeRank.record.id.toString(), recordType: '0' } }"
              class="value link"
            >
              {{ formatTime(minesweeperData.intTimeRank?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(minesweeperData.intTimeRank?.time ?? 0)
            }}</span>
            <span class="rank">{{
              getRank(minesweeperData.intTimeRank?.rank)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="label">高级</span>
            <router-link
              v-if="minesweeperData.expTimeRank?.record?.id"
              :to="{ name: 'replay', params: { recordId: minesweeperData.expTimeRank.record.id.toString(), recordType: '0' } }"
              class="value link"
            >
              {{ formatTime(minesweeperData.expTimeRank?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(minesweeperData.expTimeRank?.time ?? 0)
            }}</span>
            <span class="rank">{{
              getRank(minesweeperData.expTimeRank?.rank)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="label">总成绩</span>
            <router-link
              v-if="minesweeperData.totalTimeRank?.record?.id"
              :to="{ name: 'replay', params: { recordId: minesweeperData.totalTimeRank.record.id.toString(), recordType: '0' } }"
              class="value link"
            >
              {{ formatTime(minesweeperData.totalTimeRank?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(minesweeperData.totalTimeRank?.time ?? 0)
            }}</span>
            <span class="rank">{{
              getRank(minesweeperData.totalTimeRank?.rank)
            }}</span>
          </div>
        </div>
      </div>

      <!-- 舒尔特方格 -->
      <div v-if="schulteData" class="game-section">
        <div class="section-header">
          <div class="header-mark" />
          <h2>舒尔特方格</h2>
          <span class="badge dark">5x5</span>
        </div>
        <div class="stats-list">
          <div class="stat-row title-row">
            <span class="label">游戏局数</span>
            <span class="value">时间</span>
            <span class="rank">排名</span>
          </div>
          <div class="stat-row">
            <span class="label">{{ schulteData.countTotal }}</span>
            <span class="value">{{ formatTime(schulteData.time) }}</span>
            <span class="rank">{{ schulteData.rank }}</span>
          </div>
        </div>
      </div>

      <!-- 数字华容道 -->
      <div v-if="puzzleData" class="game-section">
        <div class="section-header">
          <div class="header-mark" />
          <h2>数字华容道</h2>
          <span class="badge">滑动</span>
        </div>
        <div class="stats-list">
          <div class="stat-row">
            <span class="label">3x3</span>
            <router-link
              v-if="puzzleData.info3?.record?.id"
              :to="{ name: 'replay', params: { recordId: puzzleData.info3.record.id.toString(), recordType: '1' } }"
              class="value link"
            >
              {{ formatTime(puzzleData.info3?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(puzzleData.info3?.time)
            }}</span>
            <span class="rank">{{ getRank(puzzleData.info3?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">4x4</span>
            <router-link
              v-if="puzzleData.info4?.record?.id"
              :to="{ name: 'replay', params: { recordId: puzzleData.info4.record.id.toString(), recordType: '1' } }"
              class="value link"
            >
              {{ formatTime(puzzleData.info4?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(puzzleData.info4?.time)
            }}</span>
            <span class="rank">{{ getRank(puzzleData.info4?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">5x5</span>
            <router-link
              v-if="puzzleData.info5?.record?.id"
              :to="{ name: 'replay', params: { recordId: puzzleData.info5.record.id.toString(), recordType: '1' } }"
              class="value link"
            >
              {{ formatTime(puzzleData.info5?.time) }}
            </router-link>
            <span v-else class="value">{{
              formatTime(puzzleData.info5?.time)
            }}</span>
            <span class="rank">{{ getRank(puzzleData.info5?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">总成绩</span>
            <span class="value">{{
              formatTime(puzzleData.infoTotal?.time)
            }}</span>
            <span class="rank">{{ getRank(puzzleData.infoTotal?.rank) }}</span>
          </div>
        </div>
      </div>

      <!-- 2048 -->
      <div v-if="tzfeData" class="game-section">
        <div class="section-header">
          <div class="header-mark" />
          <h2>2048</h2>
          <span class="badge dark">4x4</span>
        </div>
        <div class="stats-list">
          <div class="stat-row title-row">
            <span class="label">游戏局数</span>
            <span class="value">分数</span>
            <span class="rank">时间</span>
          </div>
          <div class="stat-row">
            <span class="label">{{ tzfeData.countTotal }}</span>
            <span class="value">{{ tzfeData.score || "-" }}</span>
            <span class="rank text-right">{{ formatTime(tzfeData.time) }}</span>
          </div>
        </div>
      </div>

      <!-- 数独 -->
      <div v-if="sudokuData" class="game-section">
        <div class="section-header">
          <div class="header-mark" />
          <h2>数独</h2>
        </div>
        <div class="stats-list">
          <div class="stat-row title-row">
            <span class="label">总分数</span>
            <span class="value">完成关卡</span>
            <span class="rank">排名</span>
          </div>
          <div class="stat-row">
            <span class="label">{{
              getScore(
                sudokuData.scoreEasy
                  + sudokuData.scoreNormal
                  + sudokuData.scoreHard
                  + sudokuData.scoreHell,
              )
            }}</span>
            <span class="value">{{
              getScore(
                sudokuData.countEasy
                  + sudokuData.countNormal
                  + sudokuData.countHard
                  + sudokuData.countHell,
              )
            }}</span>
            <span class="rank">{{ getRank(sudokuData.rank) }}</span>
          </div>
        </div>
      </div>

      <!-- 数织 -->
      <div v-if="nonoData" class="game-section">
        <div class="section-header">
          <div class="header-mark" />
          <h2>数织</h2>
        </div>
        <div class="stats-list">
          <div class="stat-row">
            <span class="label">初级</span>
            <span class="value">{{
              formatTime(nonoData.begTimeRank?.time)
            }}</span>
            <span class="rank">{{ getRank(nonoData.begTimeRank?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">中级</span>
            <span class="value">{{
              formatTime(nonoData.intTimeRank?.time)
            }}</span>
            <span class="rank">{{ getRank(nonoData.intTimeRank?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">高级</span>
            <span class="value">{{
              formatTime(nonoData.expTimeRank?.time)
            }}</span>
            <span class="rank">{{ getRank(nonoData.expTimeRank?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">专家</span>
            <span class="value">{{
              formatTime(nonoData.proTimeRank?.time)
            }}</span>
            <span class="rank">{{ getRank(nonoData.proTimeRank?.rank) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">总成绩</span>
            <span class="value">{{
              formatTime(nonoData.totalTimeRank?.time)
            }}</span>
            <span class="rank">{{
              getRank(nonoData.totalTimeRank?.rank)
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.career-container {
  max-width: 800px;
  margin: 0 auto;
  background-color: #121212;
  color: #eeeeee;
  min-height: 100vh;
  padding-bottom: 30px;
}

.loading,
.error {
  text-align: center;
  padding: 50px;
  font-size: 1.2rem;
  color: #999;
}

.game-section {
  padding: 20px;
  border-bottom: 8px solid #1e1e1e;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  position: relative;
}

.header-mark {
  width: 4px;
  height: 20px;
  background-color: #fa7299;
  border-radius: 4px;
  margin-right: 12px;
}

.section-header h2 {
  font-size: 1.3rem;
  margin: 0;
  font-weight: 500;
  color: #ffffff;
}

.badge {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: rgba(250, 114, 153, 0.15);
  color: #fa7299;
}

.badge.dark {
  background-color: transparent;
  color: #666;
}

.stats-list {
  display: flex;
  flex-direction: column;
}

.stat-row {
  display: flex;
  align-items: center;
  padding: 12px 10px;
  font-size: 1.05rem;
}

.title-row {
  font-size: 0.85rem;
  color: #777;
  padding-bottom: 8px;
  margin-bottom: 4px;
}

.label {
  flex: 1;
  color: #dddddd;
}

.title-row .label,
.title-row .value,
.title-row .rank {
  color: #777;
}

.value {
  flex: 2;
  text-align: center;
}

.rank {
  flex: 1;
  text-align: right;
  color: #dddddd;
}

.text-right {
  text-align: right;
}

.link {
  color: #ffffff;
  text-decoration: none;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
  color: #fa7299;
}
</style>
