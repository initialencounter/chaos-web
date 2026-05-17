import type { BaseUser } from './common'

// ========== IM 消息体 ==========
export interface ImMessageBody {
  id: number
  messageType: number // 0=文本, 1=图片
  message: string
  createTime: number
}

// ========== IM 消息（发送者包装） ==========
export interface ImMessage {
  id: number
  preId: number
  fromId: string
  toId: string
  conversationType: number
  messageId: number
  hasRead: boolean
  createTime: number
  sender: BaseUser
  messageBody: ImMessageBody
}

// ========== 最近会话用户 ==========
export interface ImRecentUser {
  id: number
  uid: string
  toUid: string
  lastMessageId: number
  lastMessageTime: number
  unReadCount: number
  stick: boolean
  user: BaseUser
  lastMessage: ImMessage | null
}

// ========== IM 用户信息 ==========
export interface ImUserGetData {
  uid: string
  messageCount: number
  unReadMessageCount: number
}

// ========== 消息计数 ==========
export interface ImMessageCountData {
  commentCount: number
  mentionCount: number
  goodCount: number
  appCount: number
  vipCount: number
}
