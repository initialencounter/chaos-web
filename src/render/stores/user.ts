import type { UserConfigGetResponse, UserHomeResponse, UserSearchResponse } from '@tapsss/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { forumApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const userHome = ref<UserHomeResponse | null>(null)
  const searchResults = ref<UserSearchResponse | null>(null)
  const currentConfig = ref<UserConfigGetResponse | null>(null)
  const isLoading = ref(false)

  async function fetchUserHome(targetUid?: number, targetName?: string) {
    isLoading.value = true
    try {
      userHome.value = await forumApi.userHome(targetUid, targetName)
    }
    finally {
      isLoading.value = false
    }
  }

  async function searchUser(name: string, page: number, count: number) {
    isLoading.value = true
    try {
      searchResults.value = await forumApi.userSearch(name, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchUserConfig(uid: number) {
    isLoading.value = true
    try {
      currentConfig.value = await forumApi.userConfigGet(uid)
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    userHome,
    searchResults,
    currentConfig,
    isLoading,
    fetchUserHome,
    searchUser,
    fetchUserConfig,
  }
})
