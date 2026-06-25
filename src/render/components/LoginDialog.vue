<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  initialError?: string
  prefillId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
  'navigateToRegister': []
  'navigateToForgotPassword': []
}>()

const loading = ref(false)
const form = ref({ id: '', password: '' })
const error = ref(props.initialError || '')

watch(() => props.prefillId, (val) => {
  if (val) {
    form.value.id = val
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    const result = await window.electronAPI.login(form.value.id, form.value.password)
    if (result.success) {
      emit('success')
    }
    else {
      error.value = result.code === 10316 ? 'ID或密码错误' : (result.msg || '登录失败')
      ElMessage.error(error.value)
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
    title="登录"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form @submit.prevent="handleSubmit">
      <el-form-item label="ID">
        <el-input v-model="form.id" placeholder="ID" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" placeholder="密码" show-password />
      </el-form-item>
      <div v-if="error" style="color: #e44; margin-bottom: 12px; font-size: 13px">
        {{ error }}
      </div>
      <el-button type="primary" :loading="loading" style="width: 100%" @click="handleSubmit">
        登录
      </el-button>
      <div style="display: flex; justify-content: space-between; margin-top: 12px">
        <el-button link type="primary" @click="emit('navigateToRegister')">
          注册账号
        </el-button>
        <el-button link type="primary" @click="emit('navigateToForgotPassword')">
          忘记密码
        </el-button>
      </div>
    </el-form>
  </el-dialog>
</template>
