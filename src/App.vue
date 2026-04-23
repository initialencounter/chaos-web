<script lang="ts" setup>
import Board from '@/components/Board.vue';
import Footer from "@/components/Footer.vue";

</script>
<template>
  <div class="common-layout">
    <el-container>
      <el-header></el-header>
      <el-main>
        <Board></Board>
      </el-main>
      <el-footer>
        <Footer></Footer>
      </el-footer>
    </el-container>
  </div>

</template>

<style>
  .common-layout {
    height: 100vh;
    justify-content: center;
    display: block;
    margin:auto;
  }
</style>