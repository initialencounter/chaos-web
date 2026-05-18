<script setup lang="ts">
import type { ImMessage, ImRecentUser } from '@tapsss/shared'
import { formatTime } from '@tapsss/shared/utils'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageStore } from '../stores/im'

defineOptions({ name: 'MessageView' })

const props = defineProps<{
  toUid?: string
  avatarUrl?: string
  nickName?: string
}>()

const router = useRouter()
const store = useMessageStore()

const inputText = ref('')
const sending = ref(false)
const chatScrollEl = ref<HTMLElement | null>(null)
const loadingMore = ref(false)
const toUid = ref(props.toUid || '')

function buildMinimalRecentUser(toUid: string): ImRecentUser {
  return {
    id: 0,
    uid: '',
    toUid,
    lastMessageId: 0,
    lastMessageTime: 0,
    unReadCount: 0,
    stick: false,
    user: {
      id: Number(toUid),
      uid: toUid,
      avatar: '',
      background: null,
      chaosInGame: false,
      chaosInView: false,
      country: null,
      mark: null,
      nickName: toUid,
      online: false,
      puzzleRank: 0,
      pvpInGame: false,
      pvpInWait: false,
      relation: 2,
      sex: 0,
      sign: null,
      timingLevel: 0,
      timingRank: 0,
      vip: false,
    },
    lastMessage: null,
  }
}

function goToUser(uid: string | number | undefined | null) {
  if (!uid)
    return
  router.push({ name: 'user', params: { uid: String(uid) } })
}

onMounted(async () => {
  if (!store.recentUsersLoaded) {
    await store.fetchRecentUsers()
  }
  await store.fetchTotalUnread()

  if (props.toUid) {
    const existing = store.recentUsers.find(u => String(u.toUid) === String(props.toUid))
    if (existing) {
      await handleSelectChat(existing)
    }
    else {
      const minimal = buildMinimalRecentUser(props.toUid)
      await store.selectChat(minimal)
      await nextTick()
      scrollToBottom()
    }
  }
})

function scrollToBottom() {
  const el = chatScrollEl.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

function onChatScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollTop <= 0) {
    handleLoadMore()
  }
}

async function handleSelectChat(user: ImRecentUser) {
  toUid.value = String(user.toUid)
  await store.selectChat(user)
  await nextTick()
  scrollToBottom()
}

async function handleLoadMore() {
  const oldestMsg = store.messages[0]
  const el = chatScrollEl.value
  if (loadingMore.value || !oldestMsg || !el) {
    return
  }

  loadingMore.value = true
  const prevScrollHeight = el.scrollHeight

  try {
    await store.fetchMessages(Number(store.currentChatUser?.toUid), 0, oldestMsg.id)
    await nextTick()
    el.scrollTop = el.scrollHeight - prevScrollHeight
  }
  finally {
    loadingMore.value = false
  }
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || sending.value || !store.currentChatUser) {
    return
  }
  sending.value = true
  const result = await store.sendMessage(Number(store.currentChatUser.toUid), 0, text)
  if (result) {
    inputText.value = ''
    await nextTick()
    scrollToBottom()
  }
  sending.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function getImageUrl(message: string): string {
  try {
    const parsed = JSON.parse(message)
    return parsed.url || ''
  }
  catch {
    return ''
  }
}

function isMyMessage(msg: ImMessage): boolean {
  return String(msg.fromId) !== String(store.currentChatUser?.toUid)
}

function formatMsgTime(timeMs: number): string {
  const date = new Date(timeMs)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  return formatTime(timeMs)
}

const TIME_GAP = 5 * 60 * 1000

const displayItems = computed(() => {
  const items: Array<{ type: 'time', time: string } | { type: 'message', msg: ImMessage }> = []
  for (let i = 0; i < store.messages.length; i++) {
    const msg = store.messages[i]
    const prevMsg = i > 0 ? store.messages[i - 1] : null
    const currentTime = msg.messageBody.createTime || msg.createTime
    const prevTime = prevMsg ? (prevMsg.messageBody.createTime || prevMsg.createTime) : 0

    if (!prevTime || (currentTime - prevTime) > TIME_GAP) {
      items.push({ type: 'time', time: formatMsgTime(currentTime) })
    }
    items.push({ type: 'message', msg })
  }
  return items
})
</script>

<template>
  <div class="message-page">
    <!-- 左侧：会话列表 -->
    <div class="conversation-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">消息</span>
        <span v-if="store.totalUnreadCount > 0" class="unread-total-badge">
          {{ store.totalUnreadCount }}
        </span>
      </div>

      <div class="conversation-list">
        <div v-if="!store.recentUsersLoaded" class="list-loading">
          加载中...
        </div>

        <div v-else-if="store.recentUsers.length === 0" class="list-empty">
          暂无消息
        </div>

        <div
          v-for="user in store.recentUsers"
          :key="user.id"
          class="conversation-item"
          :class="{ active: store.currentChatUser?.toUid === user.toUid }"
          @click="handleSelectChat(user)"
        >
          <img
            :src="user.user?.avatar"
            class="conv-avatar"
            alt="avatar"
            @click.stop="goToUser(user.toUid)"
          >

          <div class="conv-content">
            <div class="conv-top">
              <span class="conv-name">{{ user.user?.nickName || user.toUid }}</span>
              <span class="conv-time">{{ formatMsgTime(user.lastMessageTime) }}</span>
            </div>
            <div class="conv-bottom">
              <span class="conv-preview">
                {{ user.lastMessage?.messageBody?.message || '' }}
              </span>
              <span v-if="user.unReadCount > 0" class="unread-badge">
                {{ user.unReadCount > 99 ? '99+' : user.unReadCount }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：聊天区域 -->
    <div class="chat-area">
      <!-- 未选中会话 -->
      <div v-if="!store.currentChatUser" class="chat-empty">
        <div class="empty-icon">
          💬
        </div>
        <p>选择一个会话开始聊天</p>
      </div>

      <!-- 聊天头部 -->
      <template v-else>
        <div class="chat-header">
          <img
            :src="store.currentChatUser.user?.avatar || props.avatarUrl || './assets/Z7.png'"
            class="chat-header-avatar"
            alt="avatar"
            @click.stop="goToUser(store.currentChatUser?.toUid)"
          >
          <span class="chat-header-name">
            {{ props.nickName || store.currentChatUser.user?.nickName || store.currentChatUser.toUid }}
          </span>
        </div>

        <!-- 消息列表 -->
        <div
          ref="chatScrollEl" class="chat-messages" @scroll="onChatScroll"
        >
          <div v-if="loadingMore" class="loading-more">
            加载更早的消息...
          </div>

          <template
            v-for="item in displayItems"
            :key="item.type === 'time' ? `t-${item.time}` : item.msg.id"
          >
            <div v-if="item.type === 'time'" class="time-separator">
              {{ item.time }}
            </div>

            <div
              v-else
              class="message-row"
              :class="isMyMessage(item.msg) ? 'msg-mine' : 'msg-other'"
            >
              <img
                v-if="!isMyMessage(item.msg)"
                :src="item.msg.sender?.avatar"
                class="msg-avatar"
                alt="avatar"
                @click.stop="goToUser(item.msg.fromId)"
              >

              <div class="msg-bubble-wrapper">
                <!-- 文字消息 -->
                <div
                  v-if="item.msg.messageBody.messageType === 0"
                  class="msg-bubble"
                  :class="isMyMessage(item.msg) ? 'bubble-mine' : 'bubble-other'"
                >
                  {{ item.msg.messageBody.message }}
                </div>

                <!-- 图片消息 -->
                <div
                  v-else-if="item.msg.messageBody.messageType === 1"
                  class="msg-bubble msg-image-bubble"
                  :class="isMyMessage(item.msg) ? 'bubble-mine' : 'bubble-other'"
                >
                  <img
                    :src="getImageUrl(item.msg.messageBody.message)"
                    class="msg-image"
                    alt="shared image"
                    loading="lazy"
                  >
                </div>
              </div>

              <img
                v-if="isMyMessage(item.msg)"
                :src="item.msg.sender?.avatar"
                class="msg-avatar"
                alt="avatar"
                @click.stop="goToUser(item.msg.fromId)"
              >
            </div>
          </template>
        </div>

        <!-- 输入区域 -->
        <div class="chat-input-area">
          <input
            v-model="inputText"
            type="text"
            class="chat-input"
            placeholder="输入消息..."
            :disabled="sending"
            @keydown="handleKeydown"
          >
          <button
            class="send-btn"
            :disabled="!inputText.trim() || sending"
            @click="handleSend"
          >
            {{ sending ? '发送中...' : '发送' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-page {
  display: flex;
  height: calc(100vh - 48px); /* 48px is NavBar height */
  background: #1a1a2e;
  color: #e0e0e0;
}

/* ===== 左侧会话列表 ===== */
.conversation-sidebar {
  width: 320px;
  min-width: 280px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.15);
}

.sidebar-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.unread-total-badge {
  background: #fa7299;
  color: #fff;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.list-loading,
.list-empty {
  padding: 40px 20px;
  text-align: center;
  color: #9ea1a6;
  font-size: 0.9rem;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s;
}

.conversation-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.conversation-item.active {
  background: rgba(250, 114, 153, 0.12);
}

.conv-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  cursor: pointer;
}

.conv-content {
  flex: 1;
  min-width: 0;
}

.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.conv-name {
  font-size: 0.9rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.conv-time {
  font-size: 0.7rem;
  color: #6b7280;
  flex-shrink: 0;
}

.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conv-preview {
  font-size: 0.8rem;
  color: #9ea1a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.unread-badge {
  background: #fa7299;
  color: #fff;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}

/* ===== 右侧聊天区域 ===== */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 0.95rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.1);
}

.chat-header-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
}

.chat-header-name {
  font-size: 0.95rem;
  font-weight: 500;
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-anchor: none;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.loading-more {
  text-align: center;
  color: #6b7280;
  font-size: 0.8rem;
  padding: 8px 0;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 70%;
}

.message-row.msg-mine {
  align-self: flex-end;
}

.message-row.msg-other {
  align-self: flex-start;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  cursor: pointer;
}

.msg-bubble-wrapper {
  display: flex;
  flex-direction: column;
}

.msg-mine .msg-bubble-wrapper {
  align-items: flex-end;
}

.msg-other .msg-bubble-wrapper {
  align-items: flex-start;
}

.msg-bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble-other {
  background: #2a2a3e;
  border-bottom-left-radius: 4px;
}

.bubble-mine {
  background: #fa7299;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.msg-image-bubble {
  padding: 4px;
  background: transparent !important;
}

.msg-image {
  max-width: 240px;
  max-height: 320px;
  border-radius: 12px;
  object-fit: cover;
  cursor: pointer;
}

.time-separator {
  text-align: center;
  font-size: 0.75rem;
  color: #6b7280;
  padding: 12px 0;
  user-select: none;
}

/* 输入区域 */
.chat-input-area {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.15);
}

.chat-input {
  flex: 1;
  padding: 10px 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e0e0e0;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #fa7299;
}

.chat-input::placeholder {
  color: #6b7280;
}

.send-btn {
  padding: 10px 20px;
  border-radius: 20px;
  border: none;
  background: #fa7299;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: #e8638a;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .conversation-sidebar {
    width: 100%;
    min-width: unset;
  }

  .chat-area {
    display: none;
  }

  .message-page.chat-open .conversation-sidebar {
    display: none;
  }

  .message-page.chat-open .chat-area {
    display: flex;
  }
}
</style>
