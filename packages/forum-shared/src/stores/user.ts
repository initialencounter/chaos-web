import type { UserConfigGetResponse, UserHomeResponse, UserSearchResponse } from '@tapsss/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useForumApi } from '../inject'

export const useUserStore = defineStore('forum-user', () => {
  const api = useForumApi()

  const userHome = ref<UserHomeResponse | null>(null)
  const searchResults = ref<UserSearchResponse | null>(null)
  const currentConfig = ref<UserConfigGetResponse | null>(null)
  const isLoading = ref(false)

  async function fetchUserHome(targetUid?: number, targetName?: string) {
    isLoading.value = true
    try {
      userHome.value = await api.userHome(targetUid, targetName)
    }
    finally {
      isLoading.value = false
    }
  }

  async function searchUser(name: string, page: number, count: number) {
    isLoading.value = true
    try {
      searchResults.value = await api.userSearch(name, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchUserConfig(uid: number) {
    isLoading.value = true
    try {
      currentConfig.value = await api.userConfigGet(uid)
    }
    finally {
      isLoading.value = false
    }
  }

  async function setRelation(targetUid: number, relation: number) {
    return api.relationSet(targetUid, relation)
  }

  return {
    userHome,
    searchResults,
    currentConfig,
    isLoading,
    fetchUserHome,
    searchUser,
    fetchUserConfig,
    setRelation,
  }
})
