// 权重向量 w = (5, 3.5, 4.5, 3, 1, 3)^T（对应: 扫雷, 舒尔特, 华容道, 2048, 数独, 数织）
export const WEIGHTS = [5, 3.5, 4.5, 3, 1, 3]

/**
 * 排名转评分算法
 * - rank === 0 → 视为 maxRank(3000)
 * - rank < 1  → clamp 为 1
 * - 前 10 名按线性：5 - (rank-1)/36
 * - 之后按对数衰减：5 - 0.25 * (log₁₀(rank))²
 */
export function computeScore(rank: number): number {
  let r = rank
  if (r === 0) {
    r = 3000
  }
  if (r < 1) {
    r = 1
  }
  if (r <= 10) {
    return 5 - ((r - 1) / 36)
  }
  return 5 - (0.25 * ((Math.log10(r)) ** 2))
}

/**
 * 综合评分：s_final = 10 × √(∑(score_i × weight_i))
 */
export function computeTotalScore(scores: number[]): number {
  let sw = 0
  for (let i = 0; i < scores.length; i++) {
    sw += scores[i] * WEIGHTS[i]
  }
  return 10 * Math.sqrt(sw)
}
