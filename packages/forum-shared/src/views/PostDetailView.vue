<script setup lang="ts">
import type { BaseUser, CommentDatum, PostGetResponse } from '@tapsss/shared'
import { Star, StarFilled } from '@element-plus/icons-vue'
import {
  computeType,
  escapeHtml,
  extractImageLinksFromMarkdown,
  findHashWrappedStrings,
  formatTime,
  recordBgColor,
  recordTextColor,
  removeHashWrappedStrings,
  removeImagesAndLinksFromMarkdown,
  replaceEmojiStrings,
  replaceMentionAndReplayLinks,
  TIMING_LEVELS_COLOR,
  TIMING_LEVELS_MAP,
  TIMING_LEVELS_TEXT_COLOR,
} from '@tapsss/shared/utils'
import { ElIcon } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import UserAvatar from '../components/UserAvatar.vue'
import { resolveAsset } from '../inject'
import { usePostStore } from '../stores/post'

defineOptions({ name: 'PostDetailView' })

const props = defineProps<{
  id: string
  currentUid?: string
}>()

const router = useRouter()
const postStore = usePostStore()

const post = ref<PostGetResponse['data'] | null>(null)
const comments = ref<CommentDatum[]>([])
const likes = ref<BaseUser[]>([])
const loading = ref(false)
const commentLoading = ref(false)
const likeLoading = ref(false)
const currentPage = ref(0)
const currentLikePage = ref(0)
const commentsPerPage = 20
const likesPerPage = 20
const sortType = ref(0) // 0: 最新, 1: 热门
const showTab = ref<'comments' | 'likes'>('comments')

const commentText = ref('')
const submittingComment = ref(false)
const togglingPostLike = ref(false)

const showCommentInput = ref(false)
const commentInputRef = ref<HTMLTextAreaElement | null>(null)
const commentsRef = ref<HTMLElement | null>(null)

function scrollToComments() {
  commentsRef.value?.scrollIntoView({ behavior: 'smooth' })
}

watch(showCommentInput, (val) => {
  if (val) {
    setTimeout(() => {
      commentInputRef.value?.focus()
    }, 100)
  }
})

const postId = computed(() => Number.parseInt(props.id))

const tags = computed(() => {
  if (!post.value?.text)
    return []
  return findHashWrappedStrings(post.value.text)
})

const plainText = computed(() => {
  if (!post.value?.text)
    return ''
  return removeHashWrappedStrings(
    removeImagesAndLinksFromMarkdown(post.value.text),
  ).trim()
})

const md = new MarkdownIt({ breaks: true, linkify: true, html: true })
const renderedMarkdown = computed(() => {
  return replaceMentionAndReplayLinks(md.render(replaceEmojiStrings(plainText.value)))
})

const images = computed(() => {
  if (!post.value?.text)
    return []
  return extractImageLinksFromMarkdown(post.value.text)
})

const cachedImages = ref<string[]>([])
watch(images, async (urls) => {
  cachedImages.value = await Promise.all(urls.map(url => resolveAsset(url)))
}, { immediate: true })

const hasRecord = computed(() => !!post.value?.recordId)
const recordGameType = computed(() => post.value?.recordType ?? 0)

const recordBg = computed(() => recordBgColor[recordGameType.value])
const recordColor = computed(() => recordTextColor[recordGameType.value])

const levelIndex = computed(() =>
  post.value.user.timingLevel === -1 ? 0 : post.value.user.timingLevel,
)
const levelColor = computed(
  () => TIMING_LEVELS_COLOR[levelIndex.value] || '#000',
)
const textColor = computed(
  () => TIMING_LEVELS_TEXT_COLOR[levelIndex.value] || '#FFF',
)

const rankText = computed(() => {
  const r = post.value.user.timingRank
  if (!r)
    return ''
  return r === 1
    ? '雷帝'
    : `${TIMING_LEVELS_MAP[levelIndex.value]}${r <= 300 ? ` ${r}` : ''}`
})

async function loadPost() {
  loading.value = true
  try {
    await postStore.fetchPost(postId.value)
    if (postStore.currentPost?.code === 200 && postStore.currentPost.data) {
      post.value = postStore.currentPost.data
    }
    else {
      console.error('Failed to fetch post')
    }
  }
  catch (error) {
    console.error('Error fetching post:', error)
  }
  finally {
    loading.value = false
  }
}

async function loadComments(type = 0, page = 0) {
  commentLoading.value = true
  try {
    await postStore.fetchComments(postId.value, type, page, commentsPerPage)
    if (postStore.currentComments?.code === 200 && postStore.currentComments.data) {
      if (page === 0) {
        comments.value = postStore.currentComments.data
      }
      else {
        comments.value.push(...postStore.currentComments.data)
      }
    }
    else {
      console.error('Failed to fetch comments')
    }
  }
  catch (error) {
    console.error('Error fetching comments:', error)
  }
  finally {
    commentLoading.value = false
  }
}

async function loadLikes(page = 0) {
  likeLoading.value = true
  try {
    await postStore.fetchGoodUsers(postId.value, page, likesPerPage)
    if (postStore.goodUsers?.code === 200 && postStore.goodUsers.data) {
      if (page === 0) {
        likes.value = postStore.goodUsers.data
      }
      else {
        likes.value.push(...postStore.goodUsers.data)
      }
    }
    else {
      console.error('Failed to fetch likes')
    }
  }
  catch (error) {
    console.error('Error fetching likes:', error)
  }
  finally {
    likeLoading.value = false
  }
}

function switchTab(tab: 'comments' | 'likes') {
  showTab.value = tab
  if (tab === 'likes' && likes.value.length === 0) {
    loadLikes(0)
  }
}

function changeSort(type: number) {
  sortType.value = type
  currentPage.value = 0
  loadComments(type, 0)
}

function loadMoreComments() {
  currentPage.value++
  loadComments(sortType.value, currentPage.value)
}

function loadMoreLikes() {
  currentLikePage.value++
  loadLikes(currentLikePage.value)
}

async function togglePostLike() {
  if (!post.value || togglingPostLike.value)
    return
  togglingPostLike.value = true
  try {
    const newHasGood = !post.value.hasGood
    const res = await postStore.togglePostGood(postId.value, newHasGood)
    if (res.code === 200) {
      post.value.hasGood = newHasGood
      post.value.goodCount += newHasGood ? 1 : -1
    }
  }
  catch (e) {
    console.error('点赞操作失败:', e)
  }
  finally {
    togglingPostLike.value = false
  }
}

async function toggleCommentLike(comment: { id: number, hasGood: boolean, goodCount: number }) {
  try {
    const newHasGood = !comment.hasGood
    const res = await postStore.toggleCommentGood(comment.id, newHasGood)
    if (res.code === 200) {
      comment.hasGood = newHasGood
      comment.goodCount += newHasGood ? 1 : -1
    }
  }
  catch (e) {
    console.error('评论点赞失败:', e)
  }
}

async function submitComment() {
  const text = commentText.value.trim()
  if (!text || submittingComment.value)
    return
  submittingComment.value = true
  try {
    const res = await postStore.addComment(postId.value, 0, 0, text)
    if (res.code === 200) {
      commentText.value = ''
      await loadComments(sortType.value, 0)
      if (post.value) {
        post.value.commentCount++
      }
    }
  }
  catch (e) {
    console.error('评论发送失败:', e)
  }
  finally {
    submittingComment.value = false
  }
}

async function handleDeleteComment(commentId: number) {
  try {
    const res = await postStore.deleteComment(commentId)
    if (res.code === 200) {
      comments.value = comments.value.filter(c => c.id !== commentId)
      if (post.value && post.value.commentCount > 0) {
        post.value.commentCount--
      }
    }
  }
  catch (e) {
    console.error('删除评论失败:', e)
  }
}

function openReplies(commentId: number) {
  router.push({
    name: 'reply',
    params: { commentId: commentId.toString() },
  })
}

function openImage(url: string) {
  window.open(url, '_blank')
}

function openReplay(recordId?: number) {
  if (!recordId)
    return
  router.push({
    name: 'replay',
    params: {
      recordId: recordId.toString(),
      recordType: String(recordGameType.value),
    },
  })
}

function goBack() {
  if (window.history.state && window.history.state.back) {
    router.back()
  }
  else {
    router.push({ name: 'forum-home' })
  }
}

function handleContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.classList.contains('mention-link')) {
    event.preventDefault()
    event.stopPropagation()
    const uid = target.getAttribute('data-uid')
    if (uid) {
      router.push({ name: 'user', params: { uid } })
    }
  }
  else if (target.classList.contains('replay-link')) {
    event.preventDefault()
    event.stopPropagation()
    const recordId = target.getAttribute('data-record-id')
    const recordType = target.getAttribute('data-record-type')
    if (recordId && recordType) {
      router.push({ name: 'replay', params: { recordId, recordType } })
    }
  }
}

function renderCommentHtml(comment: string): string {
  return replaceEmojiStrings(replaceMentionAndReplayLinks(escapeHtml(comment)))
}

const postHeaderRef = ref<HTMLElement | null>(null)
const isHeaderSticky = ref(false)

function handleScroll() {
  if (postHeaderRef.value) {
    const rect = postHeaderRef.value.getBoundingClientRect()
    isHeaderSticky.value = rect.bottom < 0
  }
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  await loadPost()
  await loadComments()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, { capture: true } as any)
})
</script>

<template>
  <div class="post-detail">
    <!-- 顶部常驻悬浮栏 -->
    <div v-if="post" class="sticky-top-bar" :class="{ 'is-visible': isHeaderSticky }">
      <a href="#" class="sticky-back-btn" @click.prevent="goBack">
        <svg viewBox="0 0 24 24" fill="none" style="width: 24px; height: 24px;">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
      <UserAvatar
        class-name="avatar-small"
        :user="post.user"
        :size="32"
      />
      <span class="nickname-small">{{ post.user.nickName }}</span>
    </div>

    <div v-if="loading" class="loading">
      加载帖子中...
    </div>

    <div v-else-if="post" class="post-content">
      <!-- 返回按钮 -->
      <a href="#" class="back-btn" @click.prevent="goBack">
        ← 返回
      </a>

      <!-- 帖子内容 -->
      <div ref="postHeaderRef" class="post-header">
        <div class="user-info">
          <UserAvatar
            class-name="avatar"
            :user="post.user"
            :size="60"
          />
          <div class="user-meta">
            <div class="name-row">
              <span class="nickname">{{ post.user.nickName }}</span>
              <span
                v-if="rankText"
                class="rank-badge"
                :style="{ backgroundColor: levelColor, color: textColor }"
              >
                {{ rankText }}
              </span>
            </div>
            <div class="time-device">
              {{ formatTime(post.createTime) }}
              <span v-if="post.device">📱{{ post.device }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 标签 -->
      <div v-if="tags.length > 0" class="post-tags">
        <span v-for="tag in tags" :key="tag" class="tag">#{{ tag }}#</span>
      </div>

      <!-- 标题 -->
      <h1 class="post-title">
        {{ replaceEmojiStrings(post.title) }}
      </h1>

      <!-- 内容 -->
      <div class="post-body">
        <div class="post-text" @click="handleContentClick" v-html="renderedMarkdown" />

        <!-- 图片 -->
        <div v-if="cachedImages.length > 0" class="post-images">
          <img
            v-for="(img, idx) in cachedImages"
            :key="idx"
            :src="img"
            class="post-img"
            @click="openImage(images[idx]!)"
          >
        </div>

        <!-- 当前游戏记录模块渲染 -->
        <div
          v-if="hasRecord"
          class="record-box"
          :style="{ backgroundColor: recordBg, color: recordColor, cursor: 'pointer' }"
          @click="openReplay(post.recordId)"
        >
          <div class="record-icon">
            <img
              :src="`./icon/${recordGameType}.png`"
              style="width: 48px; height: 48px; object-fit: contain"
              alt="icon"
            >
          </div>
          <div class="record-details">
            <template v-if="recordGameType === 0 && post.record">
              <div class="r-col">
                <div class="r-val">
                  {{
                    computeType(
                      post.record.row,
                      post.record.column,
                      post.record.mine,
                    )
                  }}
                </div>
                <div class="r-lbl">
                  难度
                </div>
              </div>
              <div class="r-col">
                <div class="r-val">
                  {{ post.record.time / 1000 }}
                </div>
                <div class="r-lbl">
                  时间
                </div>
              </div>
              <div class="r-col">
                <div class="r-val">
                  {{ post.record.bvs }}
                </div>
                <div class="r-lbl">
                  3BV/s
                </div>
              </div>
            </template>
            <template v-if="recordGameType === 1 && post.puzzleRecord">
              <div class="r-col">
                <div class="r-val">
                  {{ post.puzzleRecord.row }}x{{ post.puzzleRecord.column }}
                </div>
                <div class="r-lbl">
                  难度
                </div>
              </div>
              <div class="r-col">
                <div class="r-val">
                  {{ post.puzzleRecord.time / 1000 }}
                </div>
                <div class="r-lbl">
                  时间
                </div>
              </div>
              <div class="r-col">
                <div class="r-val">
                  {{ post.puzzleRecord.step }}
                </div>
                <div class="r-lbl">
                  步数
                </div>
              </div>
            </template>
          </div>
        </div>
        <div v-if="post.viewCount" class="view-count">
          浏览数 {{ post.viewCount }}
        </div>
      </div>
    </div>

    <!-- 评论和点赞区域 -->
    <div ref="commentsRef" class="comments-section">
      <div class="comments-header">
        <div class="tab-buttons">
          <button
            class="header-tab-btn" :class="[{ active: showTab === 'comments' }]"
            @click="switchTab('comments')"
          >
            评论 {{ post?.commentCount || 0 }}
          </button>
          <button
            class="header-tab-btn" :class="[{ active: showTab === 'likes' }]"
            @click="switchTab('likes')"
          >
            赞 {{ post?.goodCount || 0 }}
          </button>
        </div>

        <div v-if="showTab === 'comments'" class="sort-tabs-text">
          <span class="sort-text" :class="{ active: sortType === 0 }" @click="changeSort(0)">最新</span>
          <span class="sort-text" :class="{ active: sortType === 1 }" @click="changeSort(1)">热门</span>
        </div>
      </div>

      <template v-if="showTab === 'comments'">
        <div v-if="commentLoading && comments.length === 0" class="loading">
          加载评论中...
        </div>

        <div v-else-if="comments.length === 0" class="empty-comments">
          暂无评论
        </div>

        <div v-else class="comments-list">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="comment-item"
          >
            <div class="comment-header">
              <UserAvatar
                class-name="comment-avatar"
                :user="comment.user"
                :size="40"
              />
              <div class="comment-meta">
                <div class="comment-name">
                  {{ comment.user.nickName }}
                </div>
                <div class="comment-time">
                  {{ formatTime(comment.createTime) }}
                </div>
              </div>
              <div class="comment-stats">
                <button
                  class="comment-like-btn"
                  :class="{ liked: comment.hasGood }"
                  @click="toggleCommentLike(comment)"
                >
                  <ElIcon>
                    <component :is="comment.hasGood ? StarFilled : Star" />
                  </ElIcon>
                  {{ comment.goodCount }}
                </button>
                <button
                  v-if="currentUid && comment.uid === currentUid"
                  class="comment-delete-btn"
                  @click="handleDeleteComment(comment.id)"
                >
                  删除
                </button>
              </div>
            </div>
            <div class="comment-content" @click="handleContentClick" v-html="renderCommentHtml(comment.comment)" />

            <!-- 回复 -->
            <div v-if="comment.replyCount > 0" class="replies">
              <div
                v-if="comment.replyList && comment.replyList.length > 0"
                class="reply-list"
              >
                <div
                  v-for="reply in comment.replyList"
                  :key="reply.id"
                  class="reply-item"
                >
                  <div class="reply-header">
                    <UserAvatar
                      class-name="reply-avatar"
                      :user="reply.user"
                      :size="24"
                    />
                    <div class="reply-meta">
                      <span class="reply-name">{{ reply.user.nickName }}</span>
                      <span class="reply-time">{{
                        formatTime(reply.createTime)
                      }}</span>
                    </div>
                  </div>
                  <div class="reply-content" @click="handleContentClick" v-html="renderCommentHtml(reply.comment)" />
                </div>
              </div>

              <div v-if="comment.replyCount > 4" class="view-more-replies">
                <a href="#" @click.prevent="openReplies(comment.id)">查看更多回复 (共 {{ comment.replyCount }} 条)</a>
              </div>
            </div>
          </div>

          <div class="load-more-comments">
            <button
              :disabled="commentLoading"
              class="load-more-btn"
              @click="loadMoreComments"
            >
              {{ commentLoading ? "加载中..." : "加载更多评论" }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="showTab === 'likes'">
        <div v-if="likeLoading && likes.length === 0" class="loading">
          加载点赞列表中...
        </div>

        <div v-else-if="likes.length === 0" class="empty-comments">
          暂无点赞
        </div>

        <div v-else class="likes-list">
          <div v-for="like in likes" :key="like.id" class="like-item">
            <UserAvatar
              class-name="like-avatar"
              :user="like"
              :size="40"
            />
            <div class="like-meta">
              <div class="like-name">
                {{ like.nickName }}
              </div>
              <div
                v-if="like.timingRank && like.timingRank > 0"
                class="like-badge"
              >
                <span v-if="like.timingRank === 1" class="rank-badge rank-1">雷帝</span>
                <span v-else-if="like.timingRank <= 300" class="rank-badge">
                  {{
                    like.timingLevel === -1
                      ? "萌新"
                      : ["萌新", "入门", "熟练", "高手", "大神"][
                        like.timingLevel
                      ]
                  }}
                  {{ like.timingRank }}
                </span>
              </div>
            </div>
          </div>

          <div class="load-more-comments">
            <button
              :disabled="likeLoading"
              class="load-more-btn"
              @click="loadMoreLikes"
            >
              {{ likeLoading ? "加载中..." : "加载更多点赞" }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部固定操作栏 -->
    <div v-if="post" class="bottom-action-bar">
      <div class="fake-input-wrapper">
        <div class="fake-input" @click="showCommentInput = true">
          写评论...
        </div>
      </div>
      <div class="action-icons">
        <div class="action-icon" @click="scrollToComments">
          <svg viewBox="0 0 24 24" fill="none" class="svg-icon">
            <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H16L22 24V6C22 4.9 21.1 4 20 4ZM20 18.2L18.8 17H4V6H20V18.2ZM6 9H18V11H6V9ZM6 13H15V15H6V13Z" fill="currentColor" />
          </svg>
        </div>
        <div class="action-icon">
          <svg viewBox="0 0 24 24" fill="none" class="svg-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" stroke="currentColor" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <div class="action-icon" :class="{ 'liked-icon': post.hasGood }" @click="togglePostLike">
          <svg v-if="!post.hasGood" viewBox="0 0 24 24" fill="none" class="svg-icon">
            <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" fill="currentColor" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="svg-icon">
            <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 评论输入弹窗 -->
    <div v-if="showCommentInput" class="comment-modal-overlay" @click.self="showCommentInput = false">
      <div class="comment-modal-content">
        <div class="comment-modal-header">
          <span class="modal-title">评论</span>
          <button
            class="submit-comment-btn"
            :disabled="!commentText.trim() || submittingComment"
            @click="submitComment; showCommentInput = false"
          >
            发布
          </button>
        </div>
        <textarea
          ref="commentInputRef"
          v-model="commentText"
          class="comment-modal-input"
          placeholder="写评论..."
          rows="4"
          maxlength="500"
        />
        <div class="comment-modal-toolbar">
          <div class="toolbar-icons">
            <span class="t-icon">😀</span>
            <span class="t-icon">🖼️</span>
            <span class="t-icon">@</span>
            <span class="t-icon">🎥</span>
          </div>
          <span class="char-count">{{ commentText.length }}/500</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  padding-bottom: 80px; /* Leave space for bottom bar */
}

/* 顶部常驻悬浮栏 */
.sticky-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 73px;
  background-color: rgba(27, 27, 27, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  padding: 0 15px;
  z-index: 100;
  border-bottom: 1px solid #333;
  transform: translateY(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
  max-width: 800px;
  margin: 0 auto;
}

.sticky-top-bar.is-visible {
  transform: translateY(0);
}

.sticky-back-btn {
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  padding: 5px;
}

.avatar-small {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-right: 10px;
  object-fit: cover;
}

.nickname-small {
  font-weight: bold;
  font-size: 0.95rem;
  color: #ffffff;
}

.back-btn {
  display: inline-block;
  margin-bottom: 20px;
  color: #fa7299;
  text-decoration: none;
  font-size: 1rem;
  padding: 8px 16px;
  border: 1px solid #444;
  border-radius: 20px;
  transition: all 0.3s;
}

.back-btn:hover {
  background-color: #2a2a2a;
  border-color: #fa7299;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 1.2rem;
}

.post-content {
  background-color: #1b1b1b;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
}

.post-header {
  margin-bottom: 20px;
}

.user-info {
  display: flex;
  align-items: center;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-right: 15px;
  object-fit: cover;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nickname {
  font-weight: bold;
  font-size: 1.2rem;
}

.rank-badge {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.time-device {
  font-size: 0.9rem;
  color: #999;
  margin-top: 5px;
}

.post-title {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 15px 0;
  color: #ffffff;
}

.post-tags {
  margin: 15px 0;
}

.tag {
  color: #fa7299;
  margin-right: 10px;
  font-size: 1.1rem;
}

.post-body {
  margin: 25px 0;
}

.post-text {
  color: #e0e0e0;
  line-height: 1.6;
  font-size: 1.1rem;
  margin-bottom: 20px;
}

.post-text :deep(p) {
  margin-bottom: 10px;
}

.post-text :deep(a) {
  color: #fa7299;
  text-decoration: none;
}

.post-text :deep(a:hover) {
  text-decoration: underline;
}

.post-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
}

.post-img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s;
}

.post-img:hover {
  transform: scale(1.05);
}

.record-box {
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}

.record-icon {
  font-size: 2rem;
  margin-right: 20px;
}

.record-details {
  display: flex;
  gap: 40px;
  text-align: center;
}

.r-val {
  font-size: 1.2rem;
  font-weight: bold;
}

.r-lbl {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-top: 4px;
}

.view-count {
  margin-top: 15px;
  font-size: 0.9rem;
  color: #999;
}

.post-stats {
  display: flex;
  gap: 30px;
  padding-top: 20px;
  border-top: 1px solid #333;
  margin-top: 20px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ea1a6;
}

.stat-icon {
  font-size: 1.2rem;
}

.stat-count {
  font-weight: bold;
  font-size: 1.1rem;
}

.stat-label {
  font-size: 0.9rem;
}

.comments-section {
  background-color: #1b1b1b;
  border-radius: 12px;
  padding-right: 30px;
  padding-left: 30px;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid #333;
  /* 评论区导航栏吸顶 */
  position: sticky;
  top: 50px; /* offset by sticky-top-bar height */
  background-color: #1b1b1b;
  z-index: 90;
  padding-top: 40px;
  margin-top: -15px;
}

.comments-header h2 {
  color: #ffffff;
  font-size: 1.5rem;
}

.tab-buttons {
  display: flex;
  gap: 20px;
}

.header-tab-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.1rem;
  font-weight: normal;
  cursor: pointer;
  padding: 0;
  transition: color 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-right: 1rem;
}

.header-tab-btn .tab-text {
  position: relative;
  padding-bottom: 6px;
}

.header-tab-btn .tab-count {
  font-size: 0.8rem;
  margin-left: 4px;
}

.header-tab-btn.active {
  color: #ffffff;
  font-weight: bold;
}

.header-tab-btn.active .tab-text::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  width: 60%;
  height: 3px;
  background-color: #fff;
  border-radius: 2px;
}

.sort-tabs-text {
  display: flex;
  gap: 15px;
  font-size: 0.95rem;
  color: #999;
}

.sort-text {
  cursor: pointer;
}

.sort-text.active {
  color: #fff;
}

.empty-comments {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 1.1rem;
}

.comments-list {
  margin-top: 20px;
}

.comment-item {
  padding: 20px;
  border-bottom: 1px solid #2a2a2a;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 12px;
  object-fit: cover;
}

.comment-meta {
  flex: 1;
}

.comment-name {
  font-weight: bold;
  font-size: 1rem;
  color: #ffffff;
}

.comment-time {
  font-size: 0.8rem;
  color: #999;
  margin-top: 3px;
}

.comment-stats {
  color: #9ea1a6;
}

.comment-good {
  font-size: 0.9rem;
}

.comment-content {
  color: #e0e0e0;
  line-height: 1.5;
  font-size: 1rem;
}

.replies {
  margin-top: 15px;
  padding-left: 20px;
  border-left: 2px solid #444;
}

.reply-count {
  color: #999;
  font-size: 0.9rem;
  padding: 8px 0;
}

.load-more-comments {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #333;
}

.load-more-btn {
  padding: 12px 30px;
  background-color: #2a2a2a;
  color: #ffffff;
  border: 1px solid #444;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s;
}

.load-more-btn:hover:not(:disabled) {
  background-color: #3a3a3a;
  border-color: #fa7299;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reply-list {
  margin-top: 10px;
}

.reply-item {
  padding: 10px 0;
  border-bottom: 1px dashed #333;
}

.reply-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.reply-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.reply-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 10px;
  object-fit: cover;
}

.reply-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.likes-list {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.like-item {
  display: flex;
  align-items: center;
  padding: 15px;
  background-color: #2a2a2a;
  border-radius: 8px;
  transition: transform 0.2s;
}

.like-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.like-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 12px;
  object-fit: cover;
}

.like-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.like-name {
  font-weight: bold;
  font-size: 0.95rem;
  color: #ffffff;
}

.like-badge {
  display: flex;
  align-items: center;
}

/* 覆盖默认的 grid 布局对于 load-more-comments 的影响 */
.likes-list .load-more-comments {
  grid-column: 1 / -1;
}

.reply-name {
  font-weight: bold;
  font-size: 0.9rem;
  color: #ddd;
}

.reply-time {
  font-size: 0.75rem;
  color: #888;
}

.reply-content {
  color: #ccc;
  font-size: 0.9rem;
  line-height: 1.4;
  padding-left: 34px;
}

.view-more-replies {
  margin-top: 10px;
  font-size: 0.9rem;
}

.view-more-replies a {
  color: #fa7299;
  text-decoration: none;
}

.view-more-replies a:hover {
  text-decoration: underline;
}

.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background-color: #1e1e1e;
  display: flex;
  align-items: center;
  padding: 0 15px;
  border-top: 1px solid #333;
  z-index: 100;
  margin: 0 auto;
}

.fake-input-wrapper {
  flex: 1;
  margin-right: 20px;
}

.fake-input {
  background-color: #2a2a2a;
  color: #777;
  padding: 10px 15px;
  border-radius: 20px;
  font-size: 0.95rem;
  cursor: pointer;
}

.action-icons {
  display: flex;
  gap: 20px;
  align-items: center;
}

.action-icon {
  cursor: pointer;
  color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon.liked-icon {
  color: #fa7299;
}

.svg-icon {
  width: 26px;
  height: 26px;
}

.comment-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.comment-modal-content {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background-color: #1e1e1e;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  padding: 15px 20px;
  display: flex;
  flex-direction: column;
}

.comment-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.modal-title {
  color: #fff;
  font-weight: bold;
  font-size: 1.1rem;
}

.comment-modal-input {
  width: 100%;
  background-color: transparent;
  color: #fff;
  border: none;
  font-size: 1rem;
  resize: none;
  margin-bottom: 10px;
}

.comment-modal-input:focus {
  outline: none;
}

.comment-modal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #333;
  padding-top: 10px;
}

.toolbar-icons {
  display: flex;
  gap: 15px;
  font-size: 1.3rem;
  cursor: pointer;
}

.submit-comment-btn {
  padding: 6px 16px;
  background-color: transparent;
  color: #fa7299;
  border: none;
  cursor: pointer;
  font-size: 1.05rem;
  font-weight: bold;
  transition: all 0.3s;
}

.submit-comment-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.comment-like-btn {
  background: none;
  border: none;
  color: #9ea1a6;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.comment-like-btn:hover {
  background-color: #333;
}

.comment-like-btn.liked {
  color: #fa7299;
}

.comment-delete-btn {
  background: none;
  border: 1px solid #555;
  color: #999;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
  transition: all 0.2s;
}

.comment-delete-btn:hover {
  color: #ff4444;
  border-color: #ff4444;
}

.comment-stats {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .post-detail {
    padding: 12px;
  }
  .post-content,
  .comments-section {
    padding: 16px;
  }
}

:deep(.mention-link) {
  color: #fa7299;
  cursor: pointer;
  text-decoration: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  outline: none;
}

:deep(.mention-link:hover) {
  text-decoration: underline;
}

:deep(.replay-link) {
  color: #5d9cec;
  cursor: pointer;
  text-decoration: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  outline: none;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

:deep(.replay-icon) {
  width: 1.1em;
  height: 1.1em;
  vertical-align: middle;
  margin-right: 2px;
}

:deep(.replay-link:hover) {
  text-decoration: underline;
}
</style>
