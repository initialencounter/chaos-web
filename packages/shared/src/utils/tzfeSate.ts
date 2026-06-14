// ---------- Java Random 模拟 ----------
class JavaRandom {
  private seed: bigint
  private static readonly MULTIPLIER = 0x5DEECE66Dn
  private static readonly ADDEND = 0xBn
  private static readonly MASK = (1n << 48n) - 1n

  static fromInitialSeed(seed: bigint): JavaRandom {
    const rng = new JavaRandom()
    rng.seed = (seed ^ JavaRandom.MULTIPLIER) & JavaRandom.MASK
    return rng
  }

  static fromInternalState(internalSeed: bigint): JavaRandom {
    const rng = new JavaRandom()
    rng.seed = internalSeed & JavaRandom.MASK
    return rng
  }

  getInternalState(): bigint {
    return this.seed
  }

  private constructor() {
    this.seed = 0n
  }

  private next(bits: number): bigint {
    this.seed = (this.seed * JavaRandom.MULTIPLIER + JavaRandom.ADDEND) & JavaRandom.MASK
    return this.seed >> (48n - BigInt(bits))
  }

  nextInt(bound: number): number {
    if (bound <= 0)
      throw new Error('bound must be positive')
    if ((bound & -bound) === bound) {
      return Number((BigInt(bound) * this.next(31)) >> 31n)
    }
    let bits: number, val: number
    do {
      bits = Number(this.next(31))
      val = bits % bound
    } while (bits - val + (bound - 1) < 0)
    return val
  }
}

// ---------- 游戏逻辑（支持动态尺寸 + 初始局面） ----------
type Grid = number[][]

interface GameState {
  grid: Grid
  rngInternalState: bigint
  size: number
}

function cloneGrid(grid: Grid): Grid {
  return grid.map(row => [...row])
}

function getEmptyCells(grid: Grid): [number, number][] {
  const empty: [number, number][] = []
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]!
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 0)
        empty.push([r, c])
    }
  }
  return empty
}

/**
 * 棋盘尺寸对应的目标值（指数），对齐 Java TZFEUtil.b()
 * 3→8, 4→11(=2048), 5→14, 其它→99
 */
function targetMaxValue(size: number): number {
  if (size === 3)
    return 8
  if (size === 4)
    return 11
  if (size === 5)
    return 14
  return 99
}

/** 棋盘上的最大指数值，对齐 Java TZFEGame.a() */
function maxExponent(grid: Grid): number {
  let max = 0
  for (const row of grid) {
    for (const v of row) {
      if (v > max)
        max = v
    }
  }
  return max
}

/**
 * 生成一个新方块，完全对齐 Java TZFEView.k()：
 * - 按行优先顺序收集空格
 * - 用 q(空格数) 选位置
 * - 值 = q(n() ? 5 : 10) == 0 ? 2 : 1（指数；2 表示显示 4，1 表示显示 2）
 *   其中 n()（targetNumberArrived）等价于「当前最大指数 >= 目标值」，
 *   在生成前由 Java TZFEGame.E() 更新，因此用生成前棋盘的最大指数判定。
 */
function spawnTile(grid: Grid, rng: JavaRandom, target: number): void {
  const empty = getEmptyCells(grid)
  if (empty.length === 0)
    return
  const idx = rng.nextInt(empty.length)
  const [row, col] = empty[idx]!
  const bound = maxExponent(grid) >= target ? 5 : 10
  grid[row]![col] = rng.nextInt(bound) === 0 ? 2 : 1
}

function mergeLine(line: number[], len: number): { newLine: number[], changed: boolean } {
  const nonZero = line.filter(v => v !== 0)
  const result: number[] = []
  let changed = false
  for (let i = 0; i < nonZero.length; i++) {
    const current = nonZero[i]!
    if (i + 1 < nonZero.length && current === nonZero[i + 1]) {
      // 对齐 Java TZFEView.a(): 格值是指数，合并后指数 +1（而非显示值 *2）
      result.push(current + 1)
      i++
      changed = true
    }
    else {
      result.push(current)
    }
  }
  while (result.length < len) result.push(0)
  if (!changed)
    changed = line.join(',') !== result.join(',')
  return { newLine: result, changed }
}

function move(grid: Grid, direction: number): boolean {
  const size = grid.length
  let totalChanged = false

  if (direction === 0 || direction === 2) { // 左(0) 右(2)
    for (let r = 0; r < size; r++) {
      const row = grid[r]!
      const line = direction === 0 ? row : [...row].reverse()
      const { newLine, changed } = mergeLine(line, size)
      if (changed)
        totalChanged = true
      grid[r] = direction === 0 ? newLine : newLine.reverse()
    }
  }
  else { // 上(1) 下(3)
    for (let c = 0; c < size; c++) {
      const col = grid.map(row => row[c]!)
      const line = direction === 1 ? col : [...col].reverse()
      const { newLine, changed } = mergeLine(line, size)
      if (changed)
        totalChanged = true
      const finalCol = direction === 1 ? newLine : newLine.reverse()
      for (let r = 0; r < size; r++) grid[r]![c] = finalCol[r]!
    }
  }

  return totalChanged
}

/**
 * 创建游戏状态（支持可选初始局面）
 * @param seed          原始种子（Java long 值）
 * @param moves         第一次的方向序列
 * @param size          棋盘尺寸，默认 4
 * @param initialCount  初始化消耗的随机数次数（仅当不提供 initialGrid 时默认 2；提供棋盘时可能需要设为 0 或其他值）
 * @param initialGrid   可选，初始棋盘（二维数组，0 表示空格）。若提供，则不再自动生成两个初始方块。
 */
export function createState(
  seed: bigint | number,
  moves: number[],
  size: number = 4,
  initialCount: number = 2,
  initialGrid?: Grid,
): GameState {
  const rng = JavaRandom.fromInitialSeed(BigInt(seed))
  const target = targetMaxValue(size)

  // 按照 TZFEGame.m(seed, count) 的方式消耗 initialCount 次随机数
  for (let i = 0; i < initialCount; i++) rng.nextInt(1)

  // 确定棋盘
  let grid: Grid
  if (initialGrid) {
    // 使用传入的棋盘（深拷贝避免污染）
    grid = cloneGrid(initialGrid)
    // 校验尺寸一致性
    if (grid.length !== size || grid[0]?.length !== size) {
      throw new Error(`initialGrid size must be ${size}x${size}`)
    }
  }
  else {
    // 默认：空棋盘 + 两个随机初始方块
    grid = Array.from({ length: size }, () => Array.from<number>({ length: size }).fill(0))
    spawnTile(grid, rng, target)
    spawnTile(grid, rng, target)
  }

  let state: GameState = {
    grid: cloneGrid(grid),
    rngInternalState: rng.getInternalState(),
    size,
  }

  // 执行移动序列
  for (const dir of moves) state = applyMove(state, dir).state

  return state
}

/**
 * 单步移动的结果，对齐 Java TZFEView.a()：move → E() → k()
 */
export interface MoveResult {
  /** 移动并生成新方块后的状态（忠实于 Java 引擎） */
  state: GameState
  /** 本次移动是否改变了棋盘（决定是否生成新方块） */
  moved: boolean
  /** 合并之后、生成新方块之前的棋盘（指数）。达到目标值时录像即在此刻捕获 map */
  gridBeforeSpawn: Grid
  /** 本次移动是否「首次」达到目标值（Java E() 中 target==max 的时刻） */
  targetReached: boolean
}

/**
 * 执行单步移动，完全对齐 Java TZFEView.a(direct)：
 * 1. 滑动/合并（move）
 * 2. 计算新的最大指数（对应 E(maxVal)，决定 n() 与是否达成目标）
 * 3. 若发生移动则生成新方块（k()）
 */
export function applyMove(state: GameState, dir: number): MoveResult {
  const rng = JavaRandom.fromInternalState(state.rngInternalState)
  const grid = cloneGrid(state.grid)
  const target = targetMaxValue(state.size)

  const prevMax = maxExponent(grid)
  const moved = move(grid, dir)
  const gridBeforeSpawn = cloneGrid(grid)
  const targetReached = moved && prevMax < target && maxExponent(grid) >= target

  if (moved)
    spawnTile(grid, rng, target)

  return {
    state: {
      grid,
      rngInternalState: rng.getInternalState(),
      size: state.size,
    },
    moved,
    gridBeforeSpawn,
    targetReached,
  }
}

/**
 * 在已有状态上继续执行新方向序列（忠实于 Java 引擎，每次改变棋盘后都会生成新方块）
 */
export function applyMoves(state: GameState, moves: number[]): GameState {
  let next = state
  for (const dir of moves) next = applyMove(next, dir).state
  return next
}

/**
 * 将指数格值转换为显示值（2^指数）
 * 例如：0→0, 1→2, 2→4, 3→8, ...
 */
export function exponentGridToValues(expGrid: Grid): Grid {
  return expGrid.map(row =>
    row.map(exp => (exp === 0 ? 0 : 2 ** exp)),
  )
}

/**
 * 将显示值转换为指数格值
 * 例如：0→0, 2→1, 4→2, 8→3, ...
 */
export function valuesToExponentGrid(valueGrid: Grid): Grid {
  return valueGrid.map(row =>
    row.map(val => (val === 0 ? 0 : Math.log2(val))),
  )
}
