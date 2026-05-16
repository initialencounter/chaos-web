<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [email: string]
  'navigateToLogin': []
}>()

const loading = ref(false)
const form = ref({ mail: '', password: '', code: '' })
const error = ref('')
const codeLoading = ref(false)
const codeCountdown = ref(0)

function startCountdown(countdown: { value: number }) {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

async function handleSendCode() {
  codeLoading.value = true
  try {
    const result = await window.electronAPI.apiRequest('/Minesweeper/code/password/reset/mail', 'POST', { mail: form.value.mail })
    if (result.success) {
      ElMessage.success('验证码已发送')
      startCountdown(codeCountdown)
    }
    else {
      const msg = result.code === 10323 ? '邮箱未注册' : (result.msg || '发送失败')
      ElMessage.error(msg)
    }
  }
  catch (e: any) {
    ElMessage.error(e.message)
  }
  finally {
    codeLoading.value = false
  }
}

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    const result = await window.electronAPI.apiRequest('/Minesweeper/user/password/reset/mail', 'POST', { mail: form.value.mail, code: form.value.code, password: form.value.password })
    if (result.success) {
      ElMessage.success('密码重置成功，请登录')
      emit('success', form.value.mail)
    }
    else {
      const msg = result.code === 10307 ? '验证码错误' : (result.msg || '重置失败')
      error.value = msg
      ElMessage.error(msg)
    }
  }
  catch (e: any) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="忘记密码"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form @submit.prevent="handleSubmit">
      <el-form-item label="邮箱">
        <el-input v-model="form.mail" placeholder="请输入注册邮箱" />
      </el-form-item>
      <el-form-item label="验证码">
        <div style="display: flex; gap: 8px; width: 100%">
          <el-input v-model="form.code" placeholder="验证码" style="flex: 1" />
          <el-button
            type="primary"
            :loading="codeLoading"
            :disabled="codeCountdown > 0"
            @click="handleSendCode"
          >
            {{ codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码' }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="form.password" type="password" placeholder="请输入新密码" show-password />
      </el-form-item>
      <div v-if="error" style="color: #e44; margin-bottom: 12px; font-size: 13px">
        {{ error }}
      </div>
      <el-button type="primary" :loading="loading" style="width: 100%" @click="handleSubmit">
        重置密码
      </el-button>
      <div style="text-align: center; margin-top: 12px">
        <el-button link type="primary" @click="emit('navigateToLogin')">
          返回登录
        </el-button>
      </div>
    </el-form>
  </el-dialog>
</template>
