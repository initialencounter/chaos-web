import type {
  MinesweeperCareerResponse,
  NonoCareerResponse,
  PuzzleCareerResponse,
  SchulteCareerResponse,
  SudokuCareerResponse,
  TzfeCareerResponse,
} from '@tapsss/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { forumApi } from '@/api'

export const useCareerStore = defineStore('career', () => {
  const minesweeper = ref<MinesweeperCareerResponse | null>(null)
  const sudoku = ref<SudokuCareerResponse | null>(null)
  const puzzle = ref<PuzzleCareerResponse | null>(null)
  const nono = ref<NonoCareerResponse | null>(null)
  const tzfe = ref<TzfeCareerResponse | null>(null)
  const schulte = ref<SchulteCareerResponse | null>(null)
  const isLoading = ref(false)

  async function fetchMinesweeperCareer(uid: number) {
    isLoading.value = true
    try {
      minesweeper.value = await forumApi.minesweeperCareer(uid)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchSudokuCareer(targetUid: number) {
    isLoading.value = true
    try {
      sudoku.value = await forumApi.sudokuCareer(targetUid)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchPuzzleCareer(uid: number) {
    isLoading.value = true
    try {
      puzzle.value = await forumApi.puzzleCareer(uid)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchNonoCareer(uid: number) {
    isLoading.value = true
    try {
      nono.value = await forumApi.nonoCareer(uid)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchTzfeCareer(targetUid: number) {
    isLoading.value = true
    try {
      tzfe.value = await forumApi.tzfeCareer(targetUid)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchSchulteCareer(targetUid: number) {
    isLoading.value = true
    try {
      schulte.value = await forumApi.schulteCareer(targetUid)
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    minesweeper,
    sudoku,
    puzzle,
    nono,
    tzfe,
    schulte,
    isLoading,
    fetchMinesweeperCareer,
    fetchSudokuCareer,
    fetchPuzzleCareer,
    fetchNonoCareer,
    fetchTzfeCareer,
    fetchSchulteCareer,
  }
})
