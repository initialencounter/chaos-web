import type { TimingSuccessResponse } from '@tapsss/shared'
import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { executeRequest, LOGIN_CONFIG } from '@tapsss/server'

LOGIN_CONFIG.uid = '133061'
LOGIN_CONFIG.token = ''

interface DifficultyConfig {
  label: string
  rows: number
  cols: number
  mines: number
  level: number // 对应 recordbody 中的 level
  op: number // 对应 record 的 op 字段
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  beginner: { label: '初级', rows: 8, cols: 8, mines: 10, level: 1, op: 3 },
  intermediate: { label: '中级', rows: 16, cols: 16, mines: 40, level: 2, op: 6 },
  expert: { label: '高级', rows: 16, cols: 30, mines: 99, level: 3, op: 11 },
}

const record: any = {
  bv: 186,
  bvs: 0.335,
  collect: false,
  column: 30,
  createTime: 1783750362911,
  effectiveTap: 236,
  estimatedTime: 0,
  finished: true,
  handle: '',
  id: 0,
  localId: '',
  map: '',
  mine: 99,
  mode: 1,
  op: 11,
  playCount: 0,
  postId: 0,
  rank: 0,
  rankPercent: 0.0,
  row: 16,
  solvedBv: 186,
  tap: 396,
  themeId: 2411,
  time: 554886,
  type: 2,
  uid: '',
  upload: false,
}
const cfg: DifficultyConfig = DIFFICULTIES[record.mine === 10 ? 'beginner' : record.mine === 40 ? 'intermediate' : 'expert']

const iterationCount = 10000
const logFileName = `logs_${cfg.label}_${iterationCount}.json`
let gainCoin = 0
async function submitrecord() {
  delete record.handle
  delete record.map
  record.localId = crypto.randomUUID()
  record.createTime = Date.now()
  record.uid = LOGIN_CONFIG.uid
  const res = await executeRequest<TimingSuccessResponse>('/Minesweeper/minesweeper/timing/success', 'POST', { level: cfg.level, record: JSON.stringify(record), countPercent: false })
  if (res && res.code === 200 && res.data) {
    // console.warn('提交成功', res.data)
    if (res.data?.coin)
      gainCoin += res.data.coin
    writeFileSync(logFileName, JSON.stringify(res.data, null, 2), { flag: 'a', encoding: 'utf-8' })
  }
  else {
    console.error('提交失败', res)
    writeFileSync(logFileName, JSON.stringify(res, null, 2), { flag: 'a', encoding: 'utf-8' })
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

(async () => {
  for (let i = 0; i < iterationCount; i++) {
    await submitrecord()
    console.warn(`已提交 ${i + 1} 条记录，累计获得金币：${gainCoin}`)
    await sleep(100)
  }
})()
