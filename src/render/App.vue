<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import Board from '@/components/Board.vue'
import Footer from '@/components/Footer.vue'

const showLogin = ref(false)
const gameStarted = ref(false)
const loginLoading = ref(false)
const loginForm = ref({ id: '', password: '' })
const loginError = ref('')

onMounted(async () => {
  try {
    const status = await window.electronAPI.getLoginStatus()
    if (status.loggedIn) {
      gameStarted.value = true
    }
    else {
      showLogin.value = true
      if (status.msg) {
        loginError.value = status.msg
      }
    }
  }
  catch {
    showLogin.value = true
  }
})

async function handleLogin() {
  loginLoading.value = true
  loginError.value = ''
  try {
    const result = await window.electronAPI.login(loginForm.value.id, loginForm.value.password)
    if (result.success) {
      showLogin.value = false
      gameStarted.value = true
    }
    else {
      loginError.value = result.code === 10316 ? 'uid或密码错误' : (result.msg || '登录失败')
      ElMessage.error(loginError.value)
    }
  }
  catch (e: any) {
    loginError.value = e.message
  }
  finally {
    loginLoading.value = false
  }
}

async function handleLogout() {
  await window.electronAPI.logout()
  gameStarted.value = false
  showLogin.value = true
  loginForm.value = { id: '', password: '' }
  loginError.value = ''
}
</script>

<template>
  <!-- Login dialog -->
  <el-dialog
    v-model="showLogin"
    title="登录"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
  >
    <el-form @submit.prevent="handleLogin">
      <el-form-item label="UID">
        <el-input v-model="loginForm.id" placeholder="UID" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="loginForm.password" type="password" placeholder="密码" show-password />
      </el-form-item>
      <div v-if="loginError" style="color: #e44; margin-bottom: 12px; font-size: 13px">
        {{ loginError }}
      </div>
      <el-button type="primary" :loading="loginLoading" style="width: 100%" @click="handleLogin">
        登录
      </el-button>
    </el-form>
  </el-dialog>

  <!-- Game shell -->
  <div v-if="gameStarted" class="app-shell">
    <div class="app-header">
      <span class="app-title">Mines Client Lite</span>
      <el-button type="danger" size="small" plain @click="handleLogout">
        退出登录
      </el-button>
    </div>
    <el-container>
      <el-main>
        <Board />
      </el-main>
      <el-footer>
        <Footer />
      </el-footer>
    </el-container>
  </div>
</template>

<style>
/* ===== 全局 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html,
body,
#app {
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
body {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  background-attachment: fixed;
}

/* ===== 外壳 ===== */
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}
.app-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.5px;
}
.el-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.el-main {
  flex: 1;
  overflow: hidden;
  padding: 0;
}
.el-footer {
  height: 40px !important;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* ===== Element Plus 全局覆盖 ===== */
.el-button {
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}
.el-button:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.el-button:active {
  transform: translateY(0);
}
.el-dialog {
  border-radius: 16px;
  background: rgba(30, 30, 50, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.el-dialog__header {
  display: none;
}
.el-dialog__body {
  color: #d0d0d0;
}
.el-divider {
  border-color: rgba(255, 255, 255, 0.08);
}
.el-message {
  border-radius: 10px;
  backdrop-filter: blur(12px);
}
.el-scrollbar__wrap {
  display: flex;
  justify-content: center;
}
</style>
