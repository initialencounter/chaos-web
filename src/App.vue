<script lang="ts" setup>
import Board from '@/components/Board.vue'
import Footer from '@/components/Footer.vue'
</script>
<template>
  <div class="app-shell">
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
html, body, #app {
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
