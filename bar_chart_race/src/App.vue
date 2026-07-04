<script setup lang="ts">
import BarChartRace from '@/components/BarChartRace.vue'
</script>

<template>
  <div id="app">
    <BarChartRace />
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #1a1a2e;
  color: #eaeaea;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Helvetica Neue', sans-serif;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding: 20px;
}

#app {
  width: 100%;
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 768px) {
  body {
    padding: 10px;
  }
}
</style>
