<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useForumApi } from '../inject'

defineOptions({ name: 'PostEditorView' })

const DRAFT_KEY = 'forum_post_draft'

const TOPICS: { value: string, label: string, desc: string }[] = [
  { value: '提问', label: '提问', desc: '提问之前为什么不问问神奇海螺呢?' },
  { value: '技术', label: '技术', desc: '游戏教学、攻略（教练，我想学这个！' },
  { value: '历程', label: '历程', desc: '游戏记录' },
  { value: '文章', label: '文章', desc: '扫雷联萌文学城(嗑！' },
  { value: '赛事', label: '赛事', desc: '比赛相关' },
  { value: '其他', label: '其他', desc: '其他' },
]

const router = useRouter()

const title = ref('')
const text = ref('')
const topics = ref('')
const anonymous = ref(false)
const showPreview = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const showTopicDropdown = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const titleInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const md = new MarkdownIt({ breaks: true, linkify: true })

const selectedTopic = computed(() => TOPICS.find(t => t.value === topics.value))
const renderedHtml = computed(() => md.render(text.value || ''))

// ========== 草稿 ==========
function saveDraft() {
  const draft = { title: title.value, text: text.value, topics: topics.value, anonymous: anonymous.value }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw)
    return
  try {
    const draft = JSON.parse(raw)
    title.value = draft.title || ''
    text.value = draft.text || ''
    topics.value = draft.topics || ''
    anonymous.value = draft.anonymous || false
    return true
  }
  catch { return false }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

let draftTimer: ReturnType<typeof setTimeout> | null = null
let messageTimer: ReturnType<typeof setTimeout> | null = null
function scheduleDraft() {
  if (draftTimer)
    clearTimeout(draftTimer)
  draftTimer = setTimeout(saveDraft, 800)
}

// 监听变化自动保存
watch([title, text, topics, anonymous], () => {
  if (title.value || text.value)
    scheduleDraft()
}, { deep: true })

onBeforeUnmount(() => {
  if (draftTimer)
    clearTimeout(draftTimer)
  if (messageTimer)
    clearTimeout(messageTimer)
})

// ========== 板块下拉 ==========
function toggleTopicDropdown() {
  showTopicDropdown.value = !showTopicDropdown.value
}

function selectTopic(topic: typeof TOPICS[number]) {
  topics.value = topic.value
  showTopicDropdown.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showTopicDropdown.value = false
  }
}

// ========== 图片上传 ==========
function triggerImageUpload() {
  fileInputRef.value?.click()
}

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    showMessage('请选择图片文件', 'error')
    return
  }

  uploading.value = true
  try {
    const url = await uploadToOss(file)
    // 插入 Markdown 图片语法
    const mdImage = `\n![${file.name}](${url})\n`
    insertAtCursor(mdImage)
    showMessage('图片上传成功', 'success')
  }
  catch (err) {
    console.error('图片上传失败:', err)
    showMessage('图片上传失败', 'error')
  }
  finally {
    uploading.value = false
    input.value = ''
  }
}

async function uploadToOss(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const filename = `forum/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const contentType = file.type || 'application/octet-stream'

  const electronAPI = (window as any).electronAPI

  // Electron 环境：通过主进程上传，避免 CORS
  const buffer = await file.arrayBuffer()
  const result = await electronAPI.ossUpload(buffer, filename, contentType)
  if (!result.success)
    throw new Error(result.msg || 'OSS upload failed')
  return result.url!
}

function insertAtCursor(textToInsert: string) {
  const ta = textareaRef.value
  if (!ta) {
    text.value += textToInsert
    return
  }
  const start = ta.selectionStart
  const end = ta.selectionEnd
  text.value = text.value.slice(0, start) + textToInsert + text.value.slice(end)
  // 恢复光标位置
  requestAnimationFrame(() => {
    ta.selectionStart = ta.selectionEnd = start + textToInsert.length
    ta.focus()
  })
}

// ========== 消息提示 ==========
function showMessage(msg: string, type: 'success' | 'error') {
  if (messageTimer)
    clearTimeout(messageTimer)
  message.value = msg
  messageType.value = type
  messageTimer = setTimeout(() => {
    message.value = ''
    messageTimer = null
  }, 3000)
}

// ========== 发布 ==========
async function handlePublish() {
  if (!title.value.trim()) {
    showMessage('请输入标题', 'error')
    titleInputRef.value?.focus()
    return
  }
  if (!topics.value) {
    showMessage('请选择板块', 'error')
    return
  }
  if (!text.value.trim()) {
    showMessage('请输入内容', 'error')
    textareaRef.value?.focus()
    return
  }

  submitting.value = true
  try {
    const api = useForumApi()
    const res = await api.postAdd(anonymous.value, title.value.trim(), text.value, topics.value)
    if (res.code === 200) {
      clearDraft()
      showMessage('发布成功！', 'success')
      setTimeout(() => {
        router.back()
      }, 800)
    }
    else {
      showMessage(res.msg || '发布失败', 'error')
    }
  }
  catch (e) {
    console.error('发布失败:', e)
    showMessage('发布失败，请重试', 'error')
  }
  finally {
    submitting.value = false
  }
}

function goBack() {
  if (title.value || text.value) {
    saveDraft()
  }
  router.back()
}

// ========== Tab 控制 ==========
function onEditorTab() {
  showPreview.value = false
  requestAnimationFrame(() => textareaRef.value?.focus())
}

// ========== 快捷键 ==========
function handleKeydown(e: KeyboardEvent) {
  // Ctrl+Enter / Cmd+Enter 发布
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handlePublish()
  }
}

onMounted(() => {
  const hasDraft = loadDraft()
  document.addEventListener('click', handleClickOutside)
  if (!hasDraft) {
    requestAnimationFrame(() => titleInputRef.value?.focus())
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="post-editor" @keydown="handleKeydown">
    <!-- 顶部栏 -->
    <div class="editor-top-bar">
      <a href="#" class="back-btn" @click.prevent="goBack">← 返回</a>
      <h2 class="editor-title-text">
        发布帖子
      </h2>
      <button
        class="publish-btn"
        :disabled="submitting || uploading"
        @click="handlePublish"
      >
        {{ submitting ? "发布中..." : "发布" }}
      </button>
    </div>

    <div class="editor-container">
      <!-- 消息提示 -->
      <div v-if="message" class="editor-message" :class="messageType">
        {{ message }}
      </div>

      <!-- 标题 -->
      <input
        ref="titleInputRef"
        v-model="title"
        type="text"
        class="title-input"
        placeholder="请输入标题..."
        maxlength="100"
      >

      <!-- 板块选择 + 匿名 -->
      <div class="editor-options">
        <div ref="dropdownRef" class="topic-selector">
          <button class="topic-btn" @click="toggleTopicDropdown">
            {{ selectedTopic ? `📌 ${selectedTopic.label}` : "选择板块" }}
            <span class="dropdown-arrow">▾</span>
          </button>
          <div v-if="showTopicDropdown" class="topic-dropdown">
            <div
              v-for="topic in TOPICS"
              :key="topic.value"
              class="topic-option"
              :class="{ selected: topics === topic.value }"
              @click="selectTopic(topic)"
            >
              <span class="topic-label">{{ topic.label }}</span>
              <span class="topic-desc">{{ topic.desc }}</span>
            </div>
          </div>
        </div>

        <label class="anonymous-option">
          <input v-model="anonymous" type="checkbox">
          <span>匿名发布</span>
        </label>
      </div>

      <!-- 编辑/预览切换 -->
      <div class="editor-tabs">
        <button
          class="tab-btn"
          :class="{ active: !showPreview }"
          @click="onEditorTab"
        >
          编辑
        </button>
        <button
          class="tab-btn"
          :class="{ active: showPreview }"
          @click="showPreview = true"
        >
          预览
        </button>
        <div class="tab-actions">
          <button class="image-upload-btn" :disabled="uploading" title="上传图片" @click="triggerImageUpload">
            {{ uploading ? "⏳ 上传中..." : "嵌入图片" }}
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleImageUpload"
          >
        </div>
      </div>

      <!-- 编辑器 / 预览区 -->
      <div class="editor-body">
        <textarea
          v-show="!showPreview"
          ref="textareaRef"
          v-model="text"
          class="text-editor"
          placeholder="请输入内容... 支持 Markdown 语法&#10;Ctrl+Enter 快速发布"
        />
        <div
          v-show="showPreview"
          class="preview-area markdown-body"
          v-html="renderedHtml"
        />
      </div>

      <!-- 草稿提示 -->
      <div v-if="title || text" class="draft-hint">
        💾 草稿已自动保存
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px 100px;
}

/* 顶部栏 */
.editor-top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  margin-bottom: 20px;
  border-bottom: 1px solid #2a2a2a;
}

.back-btn {
  color: #9ea1a6;
  text-decoration: none;
  font-size: 1rem;
  white-space: nowrap;
  transition: color 0.2s;
}
.back-btn:hover {
  color: #ffffff;
}

.editor-title-text {
  flex: 1;
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffffff;
  margin: 0;
}

.publish-btn {
  padding: 8px 28px;
  background-color: #fa7299;
  color: #ffffff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: bold;
  white-space: nowrap;
  transition:
    background-color 0.3s,
    opacity 0.3s;
}
.publish-btn:hover:not(:disabled) {
  background-color: #e65c87;
}
.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 消息提示 */
.editor-message {
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.95rem;
  animation: fadeIn 0.2s ease-out;
}
.editor-message.success {
  background-color: #1a3a1a;
  color: #7ddf90;
  border: 1px solid #2d5a2d;
}
.editor-message.error {
  background-color: #3a1a1a;
  color: #f48771;
  border: 1px solid #5a2d2d;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 标题输入 */
.title-input {
  width: 100%;
  padding: 14px 16px;
  background-color: #1e1e1e;
  color: #ffffff;
  border: 1px solid #333;
  border-radius: 8px;
  font-size: 1.2rem;
  outline: none;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}
.title-input:focus {
  border-color: #fa7299;
}
.title-input::placeholder {
  color: #666;
}

/* 选项行 */
.editor-options {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}

.topic-selector {
  position: relative;
}

.topic-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #2a2a2a;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}
.topic-btn:hover {
  border-color: #fa7299;
}
.dropdown-arrow {
  font-size: 0.75rem;
  color: #999;
}

.topic-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 320px;
  background-color: #1e1e1e;
  border: 1px solid #444;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 200;
  overflow: hidden;
  animation: fadeIn 0.15s ease-out;
}

.topic-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}
.topic-option:hover {
  background-color: #2a2a2a;
}
.topic-option.selected {
  background-color: #3a2030;
}

.topic-label {
  font-size: 0.95rem;
  font-weight: bold;
  color: #ffffff;
  white-space: nowrap;
  min-width: 40px;
}

.topic-desc {
  font-size: 0.85rem;
  color: #9ea1a6;
}

.anonymous-option {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9ea1a6;
  font-size: 0.9rem;
  cursor: pointer;
  user-select: none;
}
.anonymous-option input {
  accent-color: #fa7299;
}

/* Tab 切换 */
.editor-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 0;
  border-bottom: 1px solid #2a2a2a;
  padding-bottom: 0;
}

.tab-btn {
  padding: 10px 20px;
  background: none;
  color: #9ea1a6;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
  margin-bottom: -1px;
}
.tab-btn:hover {
  color: #ffffff;
}
.tab-btn.active {
  color: #fa7299;
  border-bottom-color: #fa7299;
}

.tab-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.image-upload-btn {
  padding: 6px 14px;
  background-color: #2a2a2a;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 16px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.image-upload-btn:hover:not(:disabled) {
  border-color: #fa7299;
  color: #ffffff;
}
.image-upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 编辑器主体 */
.editor-body {
  border: 1px solid #333;
  border-top: none;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  min-height: 400px;
}

.text-editor {
  width: 100%;
  min-height: 400px;
  padding: 16px;
  background-color: #1e1e1e;
  color: #e0e0e0;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 1rem;
  line-height: 1.7;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
}
.text-editor::placeholder {
  color: #555;
}

.preview-area {
  min-height: 400px;
  padding: 16px;
  background-color: #1e1e1e;
}

/* Markdown 预览样式 */
.markdown-body {
  color: #e0e0e0;
  line-height: 1.8;
  font-size: 1rem;
  word-break: break-word;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: #ffffff;
  margin: 1em 0 0.5em;
}
.markdown-body :deep(h1) {
  font-size: 1.6rem;
  border-bottom: 1px solid #333;
  padding-bottom: 0.3em;
}
.markdown-body :deep(h2) {
  font-size: 1.35rem;
}
.markdown-body :deep(h3) {
  font-size: 1.15rem;
}
.markdown-body :deep(p) {
  margin: 0.6em 0;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.markdown-body :deep(li) {
  margin: 0.25em 0;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid #fa7299;
  padding: 4px 0 4px 16px;
  margin: 0.8em 0;
  color: #9ea1a6;
}
.markdown-body :deep(code) {
  background-color: #2a2a2a;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.9em;
}
.markdown-body :deep(pre) {
  background-color: #2a2a2a;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.8em 0;
}
.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 8px 0;
}
.markdown-body :deep(a) {
  color: #fa7299;
  text-decoration: none;
}
.markdown-body :deep(a:hover) {
  text-decoration: underline;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #444;
  padding: 8px 12px;
  text-align: left;
}
.markdown-body :deep(th) {
  background-color: #2a2a2a;
  font-weight: bold;
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #333;
  margin: 1em 0;
}

/* 草稿提示 */
.draft-hint {
  text-align: right;
  color: #666;
  font-size: 0.8rem;
  margin-top: 8px;
}

/* 响应式 */
@media (max-width: 768px) {
  .post-editor {
    padding: 0 12px 80px;
  }
  .editor-options {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .topic-dropdown {
    min-width: 260px;
  }
  .tab-btn {
    padding: 8px 14px;
    font-size: 0.9rem;
  }
}
</style>
