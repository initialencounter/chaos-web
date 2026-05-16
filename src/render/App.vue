<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import Board from '@/components/Board.vue'
import CareerDialog from '@/components/CareerDialog.vue'
import Footer from '@/components/Footer.vue'
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import RankBoard from '@/components/RankBoard.vue'
import RegisterDialog from '@/components/RegisterDialog.vue'

const showLogin = ref(false)
const showRegister = ref(false)
const showForgotPassword = ref(false)
const showRankBoard = ref(false)
const showCareer = ref(false)
const gameStarted = ref(false)
const loginInitialError = ref('')
const prefillId = ref('')
const currentUid = ref('')

onMounted(async () => {
  try {
    const status = await window.electronAPI.getLoginStatus()
    if (status.loggedIn) {
      currentUid.value = status.uid || ''
      gameStarted.value = true
    }
    else {
      if (status.msg) {
        loginInitialError.value = status.msg
      }
      showLogin.value = true
    }
  }
  catch {
    showLogin.value = true
  }
})

function onLoginSuccess() {
  showLogin.value = false
  loginInitialError.value = ''
  gameStarted.value = true
}

function onRegisterSuccess(uid: string) {
  showRegister.value = false
  prefillId.value = uid
  showLogin.value = true
}

function onForgotPasswordSuccess(email: string) {
  showForgotPassword.value = false
  prefillId.value = email
  showLogin.value = true
}

function navigateToRegister() {
  showLogin.value = false
  showRegister.value = true
}

function navigateToForgotPassword() {
  showLogin.value = false
  showForgotPassword.value = true
}

function navigateToLogin() {
  showRegister.value = false
  showForgotPassword.value = false
  showLogin.value = true
}

async function handleLogout() {
  await window.electronAPI.logout()
  gameStarted.value = false
  showLogin.value = true
}
</script>

<template>
  <LoginDialog
    v-model="showLogin"
    :initial-error="loginInitialError"
    :prefill-id="prefillId"
    @success="onLoginSuccess"
    @navigate-to-register="navigateToRegister"
    @navigate-to-forgot-password="navigateToForgotPassword"
  />

  <RegisterDialog
    v-model="showRegister"
    @success="onRegisterSuccess"
    @navigate-to-login="navigateToLogin"
  />

  <ForgotPasswordDialog
    v-model="showForgotPassword"
    @success="onForgotPasswordSuccess"
    @navigate-to-login="navigateToLogin"
  />

  <RankBoard
    v-model="showRankBoard"
    :current-uid="currentUid"
  />

  <CareerDialog
    v-model="showCareer"
    :uid="currentUid"
  />

  <!-- Game shell -->
  <div v-if="gameStarted" class="app-shell">
    <div class="app-header">
      <span class="app-title">Mines Client Lite</span>
      <div class="header-actions">
        <el-button size="small" plain @click="showRankBoard = true">
          排行榜
        </el-button>
        <el-button size="small" plain @click="showCareer = true">
          生涯
        </el-button>
        <el-button type="danger" size="small" plain @click="handleLogout">
          退出登录
        </el-button>
      </div>
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
  background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 50%, #bcccdc 100%);
  background-attachment: fixed;
  color: #334155;
  transition:
    background 0.3s,
    color 0.3s;
}
html.dark body {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e0e0e0;
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
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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
}
.el-button:active {
  transform: translateY(0);
}

html.dark .el-button {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}
html.dark .el-button:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.el-dialog {
  border-radius: 16px;
  backdrop-filter: blur(20px);
}
html.dark .el-dialog {
  background: rgba(30, 30, 50, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.el-dialog__header {
  display: none;
}
html.dark .el-dialog__body {
  color: #d0d0d0;
}
html.dark .el-divider {
  border-color: rgba(255, 255, 255, 0.08);
}
.el-message {
  border-radius: 10px;
  backdrop-filter: blur(12px);
}
.el-scrollbar__wrap {
  overflow: auto;
}
</style>
