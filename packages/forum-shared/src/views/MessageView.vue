<script setup lang="ts">
import type { ImMessage, ImRecentUser } from '@tapsss/shared'
import { computeNonoType, computeType, formatTime, recordBgColor, recordTextColor, replaceEmojiStrings } from '@tapsss/shared/utils'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
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

// 右键菜单状态
const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  user: ImRecentUser | null
}>({
  visible: false,
  x: 0,
  y: 0,
  user: null,
})

const sortedRecentUsers = computed(() => {
  return [...store.recentUsers].sort((a, b) => {
    if (a.stick && !b.stick)
      return -1
    if (!a.stick && b.stick)
      return 1
    return 0
  })
})

const recordTypeConvertMap: Record<number, number> = {
  2: 0,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
}

function showContextMenu(e: MouseEvent, user: ImRecentUser) {
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    user,
  }
}

const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`,
}))

function hideContextMenu() {
  contextMenu.value.visible = false
}

function onDocumentClick() {
  if (contextMenu.value.visible) {
    hideContextMenu()
  }
}

async function handleStickUser() {
  const user = contextMenu.value.user
  if (!user)
    return
  await store.stickUser(Number(user.toUid), !user.stick)
  hideContextMenu()
}

async function handleBlockUser() {
  const user = contextMenu.value.user
  if (!user)
    return
  await store.blockUser(Number(user.toUid))
  hideContextMenu()
}

async function handleDeleteUser() {
  const user = contextMenu.value.user
  if (!user)
    return
  await store.deleteRecentUser(Number(user.toUid))
  hideContextMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

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

interface RecordData {
  type: number
  mode: number
  row: number
  column: number
  time: number
  id: number
  mine?: number
  bvs?: number
  bv?: number
  tap?: number
  effectiveTap?: number
  solvedBv?: number
  step?: number
  score?: number
  reactionTime?: number
  user: {
    avatar: string
    nickName: string
    uid: string
  }
}

const recordCache = new Map<string, RecordData | null>()

function getRecordData(message: string): RecordData | null {
  const cached = recordCache.get(message)
  if (cached !== undefined)
    return cached
  try {
    const data = JSON.parse(message) as RecordData
    recordCache.set(message, data)
    return data
  }
  catch {
    recordCache.set(message, null)
    return null
  }
}

function getRecordStats(data: RecordData, messageType: number): Array<{ value: string, label: string }> {
  switch (messageType) {
    case 2:
      return [
        { value: computeType(data.row, data.column, data.mine ?? 0), label: '难度' },
        { value: (data.time / 1000).toFixed(3), label: '时间' },
        { value: String(data.bvs ?? ''), label: '3BV/s' },
      ]
    case 3:
      return [
        { value: `${data.row}x${data.column}`, label: '难度' },
        { value: (data.time / 1000).toFixed(3), label: '时间' },
        { value: String(data.step ?? ''), label: '步数' },
      ]
    case 4:
      return [
        { value: String(data.score ?? ''), label: '分数' },
        { value: (data.time / 1000).toFixed(3), label: '时间' },
      ]
    case 5:
      return [
        { value: `${data.row}x${data.column}`, label: '难度' },
        { value: (data.time / 1000).toFixed(3), label: '时间' },
        { value: String(data.tap ?? ''), label: '点击' },
      ]
    case 6:
      return [
        { value: computeNonoType(data.mine ?? 0), label: '难度' },
        { value: (data.time / 1000).toFixed(3), label: '时间' },
      ]
    default:
      return []
  }
}

function openReplay(recordId: number, recordType: number) {
  router.push({
    name: 'replay',
    params: {
      recordId: recordId.toString(),
      recordType: recordType.toString(),
    },
  })
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

const OSS_BASE = 'https://minesweeper.oss-cn-hongkong.aliyuncs.com'

function resolveImageUrl(url: string | undefined | null): string {
  if (!url)
    return './assets/Z7.png'
  if (url.startsWith('@/assets/'))
    return url.replace('@/assets/', './assets/')
  if (url.startsWith('http://') || url.startsWith('https://'))
    return url
  if (url.startsWith('/'))
    return OSS_BASE + url
  return `${OSS_BASE}/${url}`
}

const imageCache = reactive(new Map<string, string>())

function getCachedImage(url: string | undefined | null): string {
  const raw = resolveImageUrl(url)
  if (!raw.startsWith('https://'))
    return raw
  if (!imageCache.has(raw)) {
    imageCache.set(raw, raw)
    ;(window as any).electronAPI.cacheImage(raw).then((cached: string) => {
      imageCache.set(raw, cached)
    })
  }
  return imageCache.get(raw) || raw
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
          v-for="user in sortedRecentUsers"
          :key="user.id"
          class="conversation-item"
          :class="{ active: store.currentChatUser?.toUid === user.toUid, sticked: user.stick }"
          @click="handleSelectChat(user)"
          @contextmenu.prevent="showContextMenu($event, user)"
        >
          <img
            :src="getCachedImage(user.user?.avatar)"
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
                {{ replaceEmojiStrings(user.lastMessage?.messageBody?.message || '') }}
              </span>
              <span v-if="user.unReadCount > 0" class="unread-badge">
                {{ user.unReadCount > 99 ? '99+' : user.unReadCount }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右键菜单 -->
      <Teleport to="body">
        <div
          v-if="contextMenu.visible"
          class="context-menu"
          :style="contextMenuStyle"
        >
          <div class="context-menu-item" @click="handleStickUser">
            {{ contextMenu.user?.stick ? '取消置顶' : '置顶' }}
          </div>
          <div class="context-menu-item" @click="handleBlockUser">
            拉黑用户
          </div>
          <div class="context-menu-item context-menu-item--danger" @click="handleDeleteUser">
            移除用户
          </div>
        </div>
      </Teleport>
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
            :src="getCachedImage(store.currentChatUser.user?.avatar || props.avatarUrl)"
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
                :src="getCachedImage(item.msg.sender?.avatar)"
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
                  {{ replaceEmojiStrings(item.msg.messageBody.message) }}
                </div>

                <!-- 图片消息 -->
                <div
                  v-else-if="item.msg.messageBody.messageType === 1"
                  class="msg-bubble msg-image-bubble"
                  :class="isMyMessage(item.msg) ? 'bubble-mine' : 'bubble-other'"
                >
                  <img
                    :src="getCachedImage(getImageUrl(item.msg.messageBody.message))"
                    class="msg-image"
                    alt="shared image"
                    loading="lazy"
                  >
                </div>

                <!-- 纪录消息 -->
                <div
                  v-else-if="item.msg.messageBody.messageType >= 2 && getRecordData(item.msg.messageBody.message)"
                  class="msg-record-wrapper"
                >
                  <div class="record-player-header">
                    <img
                      :src="getCachedImage(getRecordData(item.msg.messageBody.message)!.user.avatar)"
                      class="record-player-avatar"
                      alt="avatar"
                      @click.stop="goToUser(getRecordData(item.msg.messageBody.message)!.user.uid)"
                    >
                    <span class="record-player-name">{{ getRecordData(item.msg.messageBody.message)!.user.nickName }}</span>
                  </div>
                  <div
                    class="record-card"
                    :style="{
                      backgroundColor: recordBgColor[recordTypeConvertMap[item.msg.messageBody.messageType]] || '#252525',
                      color: recordTextColor[recordTypeConvertMap[item.msg.messageBody.messageType]] || '#FFF',
                    }"
                    @click.stop="openReplay(getRecordData(item.msg.messageBody.message)!.id, recordTypeConvertMap[item.msg.messageBody.messageType])"
                  >
                    <img
                      :src="`./icon/${recordTypeConvertMap[item.msg.messageBody.messageType]}.png`"
                      class="record-card-icon"
                      alt="icon"
                    >
                    <div class="record-card-details">
                      <div
                        v-for="stat in getRecordStats(getRecordData(item.msg.messageBody.message)!, item.msg.messageBody.messageType)"
                        :key="stat.label"
                        class="rc-col"
                      >
                        <div class="rc-val">
                          {{ stat.value }}
                        </div>
                        <div class="rc-lbl">
                          {{ stat.label }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <img
                v-if="isMyMessage(item.msg)"
                :src="getCachedImage(item.msg.sender?.avatar)"
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

/* 纪录消息 */
.msg-record-wrapper {
  max-width: 280px;
}

.record-player-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 0 4px;
}

.record-player-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
}

.record-player-name {
  font-size: 0.8rem;
  color: #e0e0e0;
  font-weight: 500;
}

.record-card {
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.record-card:hover {
  opacity: 0.85;
}

.record-card-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
}

.record-card-details {
  display: flex;
  gap: 24px;
  text-align: center;
}

.rc-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rc-val {
  font-size: 1rem;
  font-weight: bold;
}

.rc-lbl {
  font-size: 0.7rem;
  opacity: 0.75;
  margin-top: 2px;
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

/* 置顶标记 */
.conversation-item.sticked {
  background: rgba(250, 114, 153, 0.06);
}

.conversation-item.sticked:hover {
  background: rgba(250, 114, 153, 0.1);
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

<style>
/* 右键菜单（Teleport 到 body，不能用 scoped） */
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 140px;
  background: #2a2a3e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.context-menu-item {
  padding: 10px 16px;
  font-size: 0.85rem;
  color: #e0e0e0;
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: rgba(250, 114, 153, 0.15);
}

.context-menu-item--danger {
  color: #f87171;
}

.context-menu-item--danger:hover {
  background: rgba(248, 113, 113, 0.15);
}
</style>
