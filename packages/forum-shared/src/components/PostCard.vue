<script setup lang="ts">
import type { PostListDatum } from '@tapsss/shared'
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
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAssetBase, useResolveAsset } from '../inject'
import { usePostStore } from '../stores/post'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{ post: PostListDatum }>()
const router = useRouter()
const resolveAsset = useResolveAsset()
const postStore = usePostStore()
const togglingLike = ref(false)

async function togglePostLike(e: MouseEvent) {
  e.stopPropagation()
  if (togglingLike.value)
    return
  togglingLike.value = true
  try {
    const newHasGood = !props.post.hasGood
    const res = await postStore.togglePostGood(props.post.id, newHasGood)
    if (res.code === 200 && postStore.postList?.data) {
      const item = postStore.postList.data.find(p => p.id === props.post.id)
      if (item) {
        item.hasGood = newHasGood
        item.goodCount += newHasGood ? 1 : -1
      }
    }
  }
  catch (err) {
    console.error('点赞失败:', err)
  }
  finally {
    togglingLike.value = false
  }
}

function goToPostDetail() {
  router.push({ name: 'post', params: { id: props.post.id } })
}

function openReplay(recordId?: number) {
  if (!recordId)
    return
  router.push({
    name: 'replay',
    params: {
      recordId: recordId.toString(),
      recordType: props.post.recordType.toString(),
    },
  })
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

const assetBase = useAssetBase()

function renderCommentHtml(comment: string): string {
  return replaceEmojiStrings(replaceMentionAndReplayLinks(escapeHtml(comment), assetBase))
}

const levelIndex = computed(() =>
  props.post.user.timingLevel === -1 ? 0 : props.post.user.timingLevel,
)
const levelColor = computed(
  () => TIMING_LEVELS_COLOR[levelIndex.value] || '#000',
)
const textColor = computed(
  () => TIMING_LEVELS_TEXT_COLOR[levelIndex.value] || '#FFF',
)
const rankText = computed(() => {
  const r = props.post.user.timingRank
  if (!r)
    return ''
  return r === 1
    ? '雷帝'
    : `${TIMING_LEVELS_MAP[levelIndex.value]}${r <= 300 ? ` ${r}` : ''}`
})

const tags = computed(() => findHashWrappedStrings(props.post.text || ''))
const plainText = computed(() => {
  const t = props.post.text || ''
  return removeHashWrappedStrings(removeImagesAndLinksFromMarkdown(t)).trim()
})
const images = computed(() =>
  extractImageLinksFromMarkdown(props.post.text || '').map(
    url => url || './assets/Z7.png',
  ),
)

const cachedImages = ref<string[]>([])
watch(images, async (urls) => {
  cachedImages.value = await Promise.all(urls.map(url => resolveAsset(url)))
}, { immediate: true })

const hasRecord = computed(() => !!props.post.recordId)
const recordGameType = computed(() => props.post.recordType)

const recordBg = computed(() => recordBgColor[recordGameType.value])
const recordColor = computed(() => recordTextColor[recordGameType.value])
</script>

<template>
  <div class="post-card" @click="goToPostDetail">
    <div class="user-info">
      <UserAvatar :user="post.user" :size="50" class-name="avatar" />
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
          <span v-if="post.device">{{ post.device }}</span>
        </div>
      </div>
    </div>

    <h2 v-if="post.title" class="post-title">
      <span v-if="post.stick === 1" class="stick-badge">置顶</span>
      {{ replaceEmojiStrings(post.title) }}
    </h2>

    <template v-if="post.stick !== 1">
      <div v-if="tags.length > 0" class="post-tags">
        <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
      </div>

      <p v-if="plainText" class="post-content" @click="handleContentClick" v-html="renderCommentHtml(plainText.slice(0, 100) + (plainText.length > 100 ? '...' : ''))" />

      <div v-if="cachedImages.length > 0" class="post-images">
        <img
          v-for="(img, idx) in cachedImages.slice(0, 3)"
          :key="idx"
          :src="img"
          class="post-img"
        >
      </div>

      <div
        v-if="hasRecord"
        class="record-box"
        :style="{ backgroundColor: recordBg, color: recordColor }"
        @click.stop="openReplay(post.recordId)"
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
    </template>

    <div v-if="post.lastComment" class="last-comment">
      <div class="lc-title">
        最新评论
      </div>
      <div class="lc-header">
        <UserAvatar
          :user="post.lastComment.user"
          :size="30"
          class-name="lc-avatar"
        />
        <div class="lc-meta">
          <div class="lc-name">
            {{ post.lastComment.user.nickName }}
          </div>
          <div class="lc-time">
            {{ formatTime(post.lastComment.createTime) }}
          </div>
        </div>
      </div>
      <div class="lc-content" @click="handleContentClick" v-html="renderCommentHtml(post.lastComment.comment.slice(0, 100) + (post.lastComment.comment.length > 100 ? '...' : ''))" />
    </div>

    <div class="post-footer">
      <div class="interaction">
        <span class="icon">💬</span>
        {{
          post.commentCount > 1000
            ? `${(post.commentCount / 1000).toFixed(1)}k`
            : post.commentCount
        }}
      </div>
      <button class="like-btn" :class="{ liked: post.hasGood }" :disabled="togglingLike" @click="togglePostLike">
        <ElIcon class="like-icon">
          <component :is="post.hasGood ? StarFilled : Star" />
        </ElIcon>
        {{
          post.goodCount > 1000
            ? `${(post.goodCount / 1000).toFixed(1)}k`
            : post.goodCount
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.stick-badge {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #fa7299;
  color: white;
  margin-right: 8px;
  vertical-align: middle;
}
.post-card {
  background-color: #1b1b1b;
  color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  font-family: Arial, sans-serif;
  max-width: 800px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.post-card:hover {
  background-color: #2a2a2a;
  border-color: #444;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 12px;
  object-fit: cover;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nickname {
  font-weight: bold;
  font-size: 1.1rem;
}
.rank-badge {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.time-device {
  font-size: 0.85rem;
  color: #999;
  margin-top: 4px;
}
.post-title {
  font-size: 1.3rem;
  font-weight: bold;
  margin: 10px 0;
}
.post-tags {
  margin: 10px 0;
}
.tag {
  color: #fa7299;
  margin-right: 10px;
  font-size: 1.1rem;
}
.post-content {
  color: #e0e0e0;
  line-height: 1.5;
  margin-bottom: 10px;
  font-size: 1.1rem;
  word-wrap: break-word;
}
.post-images {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.post-img {
  width: 150px;
  height: 150px;
  border-radius: 8px;
  object-fit: cover;
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
.last-comment {
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}
.lc-title {
  color: #8d9e4b;
  font-size: 1rem;
  margin-bottom: 10px;
}
.lc-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.lc-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-right: 10px;
}
.lc-name {
  font-size: 0.9rem;
}
.lc-time {
  font-size: 0.8rem;
  color: #999;
}
.lc-content {
  font-size: 1rem;
}
.post-footer {
  display: flex;
  gap: 20px;
  color: #9ea1a6;
  font-size: 1.1rem;
}
.like-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #9ea1a6;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.like-btn:hover:not(:disabled) {
  background-color: rgba(250, 114, 153, 0.1);
}

.like-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.like-btn.liked {
  color: #fa7299;
}

.like-btn .like-icon {
  font-size: 1.1rem;
}

.interaction {
  display: flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 768px) {
  .post-card {
    padding: 14px;
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
