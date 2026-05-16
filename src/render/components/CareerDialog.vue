<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  uid: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const PAGE_SIZE = 20

interface RecordItem {
  id: number
  correct: number
  incorrect: number
  score: number
  rank: number
  createTime: number
}

const career = ref({ win: 0, lose: 0, rank: 0 })
const records = ref<RecordItem[]>([])
const recordPage = ref(1)
const recordTotalPage = ref(1)
const loadingCareer = ref(false)
const loadingRecords = ref(false)
const loaded = ref(false)

const winRate = computed(() => {
  const total = career.value.win + career.value.lose
  if (total === 0)
    return '-'
  return `${((career.value.win / total) * 100).toFixed(1)}%`
})

function formatTime(ts: number): string {
  if (!ts)
    return '-'
  const date = new Date(ts)
  const y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${M}-${d} ${h}:${m}`
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0)
    return '-'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

async function fetchCareer() {
  if (!props.uid)
    return
  loadingCareer.value = true
  try {
    const result = await window.electronAPI.apiRequest('/Minesweeper/minesweeper/chaos/career', 'POST', { uid: props.uid })
    if (result.success && result.data) {
      career.value = result.data
    }
    else {
      ElMessage.error(result.msg || '加载生涯数据失败')
    }
  }
  catch (e: any) {
    ElMessage.error(e.message || '加载生涯数据失败')
  }
  finally {
    loadingCareer.value = false
  }
}

async function fetchRecords() {
  if (!props.uid)
    return
  loadingRecords.value = true
  try {
    const result = await window.electronAPI.apiRequest('/Minesweeper/minesweeper/chaos/list/user/record', 'POST', { uid: props.uid, page: recordPage.value - 1, count: PAGE_SIZE })
    if (result.success && result.data) {
      records.value = result.data as RecordItem[]
      recordTotalPage.value = result.data.length < PAGE_SIZE ? recordPage.value : recordPage.value + 1
    }
    else {
      ElMessage.error(result.msg || '加载对局记录失败')
    }
  }
  catch (e: any) {
    ElMessage.error(e.message || '加载对局记录失败')
  }
  finally {
    loadingRecords.value = false
  }
}

function onRecordPageChange(p: number) {
  recordPage.value = p
  fetchRecords()
}

watch(() => props.uid, (val) => {
  if (val) {
    loaded.value = false
    recordPage.value = 1
    fetchCareer()
    fetchRecords()
  }
})

function onOpen() {
  if (!loaded.value && props.uid) {
    loaded.value = true
    recordPage.value = 1
    fetchCareer()
    fetchRecords()
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="生涯"
    width="580px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
    @update:model-value="emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="career-dialog">
      <!-- Career stats cards -->
      <div v-loading="loadingCareer" class="stats-cards">
        <div class="stat-card win">
          <div class="stat-val">
            {{ career.win }}
          </div>
          <div class="stat-label">
            胜场
          </div>
        </div>
        <div class="stat-card lose">
          <div class="stat-val">
            {{ career.lose }}
          </div>
          <div class="stat-label">
            败场
          </div>
        </div>
        <div class="stat-card rate">
          <div class="stat-val">
            {{ winRate }}
          </div>
          <div class="stat-label">
            胜率
          </div>
        </div>
        <div class="stat-card rank">
          <div class="stat-val">
            {{ career.rank }}
          </div>
          <div class="stat-label">
            排名
          </div>
        </div>
      </div>

      <el-divider />

      <!-- Game history -->
      <div class="history-section">
        <div class="section-title">
          对局记录
        </div>
        <div v-loading="loadingRecords" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>分数</th>
                <th>排名</th>
                <th>正确</th>
                <th>错误</th>
                <th>正确率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in records" :key="item.id">
                <td class="col-time">
                  {{ formatTime(item.createTime) }}
                </td>
                <td class="col-num score">
                  {{ item.score }}
                </td>
                <td class="col-num rank">
                  {{ item.rank }}
                </td>
                <td class="col-num correct">
                  {{ item.correct }}
                </td>
                <td class="col-num incorrect">
                  {{ item.incorrect }}
                </td>
                <td class="col-num rate">
                  {{ formatPercent(item.correct, item.correct + item.incorrect) }}
                </td>
              </tr>
              <tr v-if="!loadingRecords && records.length === 0">
                <td colspan="6" class="empty-row">
                  暂无对局记录
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="records.length > 0" class="pagination">
          <button
            class="page-btn"
            :disabled="recordPage <= 1"
            @click="onRecordPageChange(recordPage - 1)"
          >
            上一页
          </button>
          <span class="page-info">{{ recordPage }} / {{ recordTotalPage }}</span>
          <button
            class="page-btn"
            :disabled="records.length < PAGE_SIZE"
            @click="onRecordPageChange(recordPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div class="dialog-footer">
      <el-button @click="emit('update:modelValue', false)">
        关闭
      </el-button>
    </div>
  </el-dialog>
</template>

<style scoped>
.career-dialog {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stats-cards {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.stat-card {
  flex: 1;
  padding: 14px 8px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}
html:not(.dark) .stat-card {
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.stat-val {
  font-size: 22px;
  font-weight: 700;
}
.stat-label {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.stat-card.win .stat-val {
  color: #5eead4;
}
html:not(.dark) .stat-card.win .stat-val {
  color: #0d9488;
}
.stat-card.lose .stat-val {
  color: #f87171;
}
html:not(.dark) .stat-card.lose .stat-val {
  color: #dc2626;
}
.stat-card.rate .stat-val {
  color: #60a5fa;
}
html:not(.dark) .stat-card.rate .stat-val {
  color: #2563eb;
}
.stat-card.rank .stat-val {
  color: #fbbf24;
}
html:not(.dark) .stat-card.rank .stat-val {
  color: #d97706;
}

.history-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #aaa;
  text-align: center;
}
html:not(.dark) .section-title {
  color: #475569;
}

.table-wrap {
  min-height: 120px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead th {
  padding: 6px 8px;
  text-align: center;
  font-weight: 600;
  color: #888;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
}
html:not(.dark) thead th {
  color: #64748b;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

tbody td {
  padding: 6px 8px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}
html:not(.dark) tbody td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

tbody tr:hover {
  background: rgba(255, 255, 255, 0.04);
}
html:not(.dark) tbody tr:hover {
  background: rgba(0, 0, 0, 0.03);
}

.col-time {
  color: #aaa;
  font-size: 12px;
  white-space: nowrap;
}
html:not(.dark) .col-time {
  color: #64748b;
}

.col-num {
  font-weight: 600;
}
.score {
  color: #fbbf24;
}
html:not(.dark) .score {
  color: #d97706;
}
.rank {
  color: #c0c0c0;
}
html:not(.dark) .rank {
  color: #475569;
}
.correct {
  color: #5eead4;
}
html:not(.dark) .correct {
  color: #0d9488;
}
.incorrect {
  color: #f87171;
}
html:not(.dark) .incorrect {
  color: #dc2626;
}
.rate {
  color: #60a5fa;
}
html:not(.dark) .rate {
  color: #2563eb;
}

.empty-row {
  text-align: center;
  color: #666;
  padding: 30px 0;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.page-btn {
  padding: 5px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #aaa;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
html:not(.dark) .page-btn {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
  color: #666;
}
.page-btn:hover:not(:disabled) {
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.25);
}
html:not(.dark) .page-btn:hover:not(:disabled) {
  color: #334155;
  border-color: rgba(0, 0, 0, 0.25);
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: #888;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
</style>
