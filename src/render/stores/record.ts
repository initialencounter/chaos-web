import type {
  MinesweeperRecordListResponse,
  NonoRecordListFilterResponse,
  PuzzleRecordGetResponse,
  PuzzleRecordListFilterResponse,
  RecordGetResponse,
  SchulteRecordGetResponse,
  SchulteRecordListFilterResponse,
  TzfeRecordListFilterResponse,
} from '@tapsss/shared'
import { cacheRecord, getCachedRecord } from '@tapsss/shared/utils'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { forumApi } from '@/api'

export const useRecordStore = defineStore('record', () => {
  const currentRecord = ref<RecordGetResponse | PuzzleRecordGetResponse | SchulteRecordGetResponse | null>(null)

  const minesweeperRecordList = ref<MinesweeperRecordListResponse | null>(null)
  const schulteRecordList = ref<SchulteRecordListFilterResponse | null>(null)
  const puzzleRecordList = ref<PuzzleRecordListFilterResponse | null>(null)
  const tzfeRecordList = ref<TzfeRecordListFilterResponse | null>(null)
  const nonoRecordList = ref<NonoRecordListFilterResponse | null>(null)
  const isLoading = ref(false)

  async function fetchMinesweeperRecord(recordId: number) {
    isLoading.value = true
    try {
      const cached = await getCachedRecord<RecordGetResponse>('minesweeper', recordId)
      if (cached) {
        currentRecord.value = cached
        return
      }
      const data = await forumApi.minesweeperRecordGet(recordId)
      currentRecord.value = data
      if (data.code === 200) {
        cacheRecord('minesweeper', recordId, data)
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchPuzzleRecord(recordId: number) {
    isLoading.value = true
    try {
      const cached = await getCachedRecord<PuzzleRecordGetResponse>('puzzle', recordId)
      if (cached) {
        currentRecord.value = cached
        return
      }
      const data = await forumApi.puzzleRecordGetResponse(recordId)
      currentRecord.value = data
      if (data.code === 200) {
        cacheRecord('puzzle', recordId, data)
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchSchulteRecord(recordId: number) {
    isLoading.value = true
    try {
      const cached = await getCachedRecord<SchulteRecordGetResponse>('schulte', recordId)
      if (cached) {
        currentRecord.value = cached
        return
      }
      const data = await forumApi.schulteRecordGet(recordId)
      currentRecord.value = data
      if (data.code === 200) {
        cacheRecord('schulte', recordId, data)
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchMinesweeperRecordList(userId: string, page: number, count: number) {
    isLoading.value = true
    try {
      minesweeperRecordList.value = await forumApi.minesweeperRecordList(userId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchSchulteRecordList(userId: string, page: number, count: number) {
    isLoading.value = true
    try {
      schulteRecordList.value = await forumApi.schulteRecordListFilter(userId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchPuzzleRecordList(userId: string, page: number, count: number) {
    isLoading.value = true
    try {
      puzzleRecordList.value = await forumApi.puzzleRecordListFilter(userId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchTzfeRecordList(userId: string, page: number, count: number) {
    isLoading.value = true
    try {
      tzfeRecordList.value = await forumApi.tzfeRecordListFilter(userId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchNonoRecordList(userId: string, page: number, count: number) {
    isLoading.value = true
    try {
      nonoRecordList.value = await forumApi.nonoRecordListFilter(userId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    currentRecord,
    minesweeperRecordList,
    schulteRecordList,
    puzzleRecordList,
    tzfeRecordList,
    nonoRecordList,
    isLoading,
    fetchMinesweeperRecord,
    fetchPuzzleRecord,
    fetchSchulteRecord,
    fetchMinesweeperRecordList,
    fetchSchulteRecordList,
    fetchPuzzleRecordList,
    fetchTzfeRecordList,
    fetchNonoRecordList,
  }
})
