import type { CompositeRankConfig } from './rank/types'
import type { TcupConfig } from './tcup/types'
import type { CompetitionConfig } from './types'
import fs from 'node:fs'
import path from 'node:path'
import * as yaml from 'yaml'

/**
 * 从 YAML 读取原始数据
 */
function readYamlFile(filePath: string): Record<string, any> {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return yaml.parse(raw)
}

/**
 * 解析 ISO 日期字符串为 epoch ms 时间戳
 */
function parseTime(dateStr: string): number {
  return new Date(dateStr).getTime()
}

// ─── 全标速效配置加载 ───

interface SpeedRawConfig {
  enabled: boolean
  name: string
  description: string
  postId: number
  startTime: string
  endTime: string
  replayPrefix: string
  requiredArea: number
  requiredMine: number
  requiredType: number
  scoreFormula: 'ioe_minus_time_penalty'
  timePenaltyCoefficient: number
  pollIntervalMs: number
  commentsPerPage: number
  repliesPerPage: number
  blacklist: string[]
}

function loadSpeedConfig(filePath: string): CompetitionConfig {
  const raw = readYamlFile(filePath) as SpeedRawConfig
  return {
    enabled: raw.enabled !== false,
    name: raw.name,
    description: raw.description,
    postId: raw.postId,
    startTime: parseTime(raw.startTime),
    endTime: parseTime(raw.endTime),
    replayPrefix: raw.replayPrefix,
    requiredArea: raw.requiredArea,
    requiredMine: raw.requiredMine,
    requiredType: raw.requiredType,
    scoreFormula: raw.scoreFormula,
    timePenaltyCoefficient: raw.timePenaltyCoefficient,
    pollIntervalMs: raw.pollIntervalMs,
    commentsPerPage: raw.commentsPerPage,
    repliesPerPage: raw.repliesPerPage,
    blacklist: raw.blacklist,
  }
}

// ─── 超越杯配置加载 ───

interface TcupDifficultyRaw {
  key: string
  name: string
  area: number
  mine: number
  timeMaxPoints: number
  bvsMaxPoints: number
  minBvMaxPoints: number
  maxBvMaxPoints: number
}

interface TcupRawConfig {
  enabled: boolean
  name: string
  description: string
  postId: number
  startTime: string
  endTime: string
  replayPrefix: string
  requiredType: number
  pollIntervalMs: number
  commentsPerPage: number
  repliesPerPage: number
  blacklist: string[]
  difficulties: TcupDifficultyRaw[]
  totalTimeMaxPoints: number
  totalBvsMaxPoints: number
}

function loadTcupConfig(filePath: string): TcupConfig {
  const raw = readYamlFile(filePath) as TcupRawConfig
  return {
    enabled: raw.enabled !== false,
    name: raw.name,
    description: raw.description,
    postId: raw.postId,
    startTime: parseTime(raw.startTime),
    endTime: parseTime(raw.endTime),
    replayPrefix: raw.replayPrefix,
    requiredType: raw.requiredType,
    pollIntervalMs: raw.pollIntervalMs,
    commentsPerPage: raw.commentsPerPage,
    repliesPerPage: raw.repliesPerPage,
    blacklist: raw.blacklist,
    difficulties: raw.difficulties,
    totalTimeMaxPoints: raw.totalTimeMaxPoints,
    totalBvsMaxPoints: raw.totalBvsMaxPoints,
  }
}

// ─── 默认路径 ───

/**
 * 根据 configDir 加载全标速效比赛配置
 */
export function loadSpeedCompetitionConfig(configDir: string): CompetitionConfig {
  return loadSpeedConfig(path.join(configDir, 'speed-competition.yaml'))
}

/**
 * 根据 configDir 加载超越杯比赛配置
 */
export function loadTranscendenceCupConfig(configDir: string): TcupConfig {
  return loadTcupConfig(path.join(configDir, 'tcup.yaml'))
}

// ─── 综合排行榜配置加载 ───

interface CompositeRankRawConfig {
  enabled: boolean
  name: string
  updateHour: number
  pageSize: number
}

function loadCompRankConfig(filePath: string): CompositeRankConfig {
  const raw = readYamlFile(filePath) as CompositeRankRawConfig
  return {
    enabled: raw.enabled !== false,
    name: raw.name,
    updateHour: raw.updateHour ?? 0,
    pageSize: raw.pageSize,
  }
}

/**
 * 根据 configDir 加载综合游戏排行榜配置
 */
export function loadCompositeRankConfig(configDir: string): CompositeRankConfig {
  return loadCompRankConfig(path.join(configDir, 'composite-rank.yaml'))
}
