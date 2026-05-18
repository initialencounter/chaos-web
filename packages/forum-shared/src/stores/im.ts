import type { ImMessage, ImRecentUser } from '@tapsss/shared'
import { cacheMessages, clearMessageCache, getCachedMessages } from '@tapsss/shared/utils'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useForumApi } from '../inject'

export const useMessageStore = defineStore('im-message', () => {
  const api = useForumApi()

  const recentUsers = ref<ImRecentUser[]>([])
  const messages = ref<ImMessage[]>([])
  const currentChatUser = ref<ImRecentUser | null>(null)
  const totalUnreadCount = ref(0)
  const isLoading = ref(false)
  const recentUsersLoaded = ref(false)

  async function fetchRecentUsers(messageTime = 0, count = 40) {
    isLoading.value = true
    try {
      const res = await api.imUserRecentList(messageTime, count)
      if (res.code === 200 && res.data) {
        if (messageTime === 0) {
          recentUsers.value = res.data
        }
        else {
          recentUsers.value.push(...res.data)
        }
      }
      recentUsersLoaded.value = true
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchMessages(toUid: number, maxId: number, minId: number, count = 20) {
    isLoading.value = true
    try {
      const res = await api.imMessageList(toUid, maxId, minId, count)
      if (res.code === 200 && res.data) {
        if (minId === 0) {
          messages.value = res.data.sort((a, b) => a.createTime - b.createTime)
        }
        else {
          const existingIds = new Set(messages.value.map(m => m.id))
          const newMessages = res.data.filter(m => !existingIds.has(m.id))
          messages.value = [...newMessages, ...messages.value].sort((a, b) => a.createTime - b.createTime)
        }
        cacheMessages(String(toUid), messages.value)
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function sendMessage(toUid: number, messageType: number, message: string): Promise<ImMessage | null> {
    try {
      const res = await api.imMessageSend(toUid, messageType, message)
      if (res.code === 200 && res.data) {
        const msg = res.data
        messages.value.push(msg)
        cacheMessages(String(toUid), messages.value)
        const idx = recentUsers.value.findIndex(u => String(u.toUid) === String(toUid))
        if (idx >= 0) {
          const user = recentUsers.value[idx]!
          recentUsers.value.splice(idx, 1)
          recentUsers.value.unshift({
            ...user,
            lastMessageId: msg.id,
            lastMessageTime: msg.createTime,
            lastMessage: msg,
          })
        }
        return msg
      }
      return null
    }
    catch (e) {
      console.error('发送消息失败:', e)
      return null
    }
  }

  async function fetchTotalUnread() {
    try {
      const res = await api.imUserGet()
      if (res.code === 200 && res.data) {
        totalUnreadCount.value = res.data.unReadMessageCount
      }
    }
    catch (e) {
      console.error('获取未读消息数失败:', e)
      // Silently fail - unread count is non-critical
    }
  }

  async function selectChat(user: ImRecentUser) {
    currentChatUser.value = user
    messages.value = []

    if (user.unReadCount > 0) {
      api.imUserRecentUnreadCount(Number(user.toUid), 0)
      totalUnreadCount.value = Math.max(0, totalUnreadCount.value - user.unReadCount)
      user.unReadCount = 0
    }

    const cached = await getCachedMessages(String(user.toUid))
    if (cached.length > 0) {
      messages.value = cached
    }

    return fetchMessages(Number(user.toUid), 0, 0, 20)
  }

  async function stickUser(toUid: number, stick: boolean) {
    const res = await api.imUserRecentStick(toUid, stick)
    if (res.code === 200) {
      const user = recentUsers.value.find(u => String(u.toUid) === String(toUid))
      if (user) {
        user.stick = stick
      }
    }
  }

  async function deleteRecentUser(toUid: number) {
    const res = await api.imUserRecentDelete(toUid)
    if (res.code === 200) {
      const idx = recentUsers.value.findIndex(u => String(u.toUid) === String(toUid))
      if (idx >= 0) {
        recentUsers.value.splice(idx, 1)
      }
      if (currentChatUser.value && String(currentChatUser.value.toUid) === String(toUid)) {
        currentChatUser.value = null
        messages.value = []
      }
      clearMessageCache(String(toUid))
    }
  }

  async function blockUser(toUid: number) {
    const res = await api.relationSet(toUid, 2)
    if (res.code === 200) {
      const user = recentUsers.value.find(u => String(u.toUid) === String(toUid))
      if (user && user.user) {
        user.user.relation = 3
      }
    }
  }

  return {
    recentUsers,
    messages,
    currentChatUser,
    totalUnreadCount,
    isLoading,
    recentUsersLoaded,
    fetchRecentUsers,
    fetchMessages,
    sendMessage,
    fetchTotalUnread,
    selectChat,
    stickUser,
    deleteRecentUser,
    blockUser,
  }
})
