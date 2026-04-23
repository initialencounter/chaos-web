<template>
  <div class="topPositionFixed">
    <div class="header-content">
      <el-button class="logout-button" style="width: 5rem" @click="logout">退出桌面</el-button>
      <el-button
        :style="{ background: flagMode ? '#5282b8' : '#5c8f4b', width: '5rem'}"
        class="flag-switch-button"
        @click="flagMode = !flagMode"
      >{{ flagMode ? "标记" : "挖开" }}模式
      </el-button>
      <el-button class="logout-button" style="width: 5rem" @click="reset">刷新</el-button>
      <div class="timeWatcher">{{ timeWatcher }}</div>
    </div>
    <ScoreTip ref="scoreTip" class="scoreTipParent"></ScoreTip>
  </div>
  
  <div class="main-layout">
    <div class="left-panel">
      <ScoreBoard :scoreBoard="scoreBoard" class="scoreBoard" v-if="Object.keys(scoreBoard).length > 0"></ScoreBoard>
    </div>
    
    <div class="center-panel">
      <el-scrollbar>
        <div
          v-if="minefield.Width > 0"
          :style="{
            gridTemplateColumns: `repeat(${minefield.Width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${minefield.Height}, ${cellSize}px)`,
          }"
          class="board"
        >
          <div
            v-for="(cell, index) in minefield.Cell"
            :key="index"
            :style="{ backgroundImage: `url(${getImageSrc(cell)})` }"
            class="cell"
            @mousedown="(event) => handleClick(event, index)"
          >
            <div v-if="isBlocked" class="blocked-overlay"></div>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { Cell, Minefield, RequestType, Response, ScoreBoard as ScoreBoardType } from "@/types";
import ScoreBoard from "@/components/ScoreBoard.vue";
import ScoreTip from "@/components/ScoreTip.vue";
import { Howl } from "howler";
import { wsClient } from "@/api/websocket";

const cellSize = 24;
const minefield = ref<Minefield>({
  Width: 0,
  Height: 0,
  Cells: 0,
  Mines: 0,
  Cell: [],
  First: false,
  StartTimeStamp: 0,
});

const timeWatcher = ref("00:000");
const scoreBoard = ref<ScoreBoardType>({});
const scoreTip = ref<InstanceType<typeof ScoreTip>>();
const isBlocked = ref(false);
const blockTimeout = ref<number | null>(null);

const openSound = new Howl({ src: ["/src/assets/audio/open.mp3"], volume: 0.5 });
const flagSound = new Howl({ src: ["/src/assets/audio/flag.mp3"], volume: 0.5 });
const boomSound = new Howl({ src: ["/src/assets/audio/boom.mp3"], volume: 0.5 });
const flagMode = ref(false);
let startTimeStamp = 0;
let timer = false;
let intervalFlag: number;
const userName = ref("");

document.oncontextmenu = () => false;

onMounted(() => {
  initGame();
});

onUnmounted(() => {
  wsClient.close();
  if (timer) {
    clearInterval(intervalFlag);
  }
  if (blockTimeout.value) {
    clearTimeout(blockTimeout.value);
  }
});

const initGame = async () => {
  // 路由到独立的 Node.js 代理 (proxy.js) 来强行注入 header 解决跨域限制
  const url = `ws://localhost:8080/ws`;
  
  // Register handlers
  wsClient.on("chaos/enter", onEnter);
  wsClient.on("chaos/action", onAction);
  wsClient.on("chaos/refresh/users", onRefreshUsers);
  wsClient.on("chaos/finish", onFinish);
  wsClient.on("message", (data: any) => {
    console.log("Received message:", data);
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (parsed["url"] == "ready") {
      wsClient.send({ url: "enter" });
    }
  });

  wsClient.connect(url);
};

const onEnter = (data: any) => {
  // Parse map
  if (data.map) {
    const mapData = data.map.map as string; // like "19932...-129..."
    const mapStatus = data.map.mapStatus as string; // like "10010..."

    const rows = mapData.split("-").filter(row => row.length > 0);
    const statuses = mapStatus.split("-").filter(row => row.length > 0);

    minefield.value.Height = rows.length;
    minefield.value.Width = rows[0]?.length || 0;
    
    const cells: Cell[] = [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const val = rows[r][c];
        const status = statuses[r][c];
        
        cells.push({
          Id: r * minefield.value.Width + c,
          Mines: val === '9' ? 9 : parseInt(val),
          IsMine: val === '9',
          IsOpen: status === '1',
          IsFlagged: status === '8'
        });
      }
    }
    minefield.value.Cell = cells;
    minefield.value.StartTimeStamp = data.map.createTime || Date.now();
    startTimeStamp = minefield.value.StartTimeStamp;
    
    if (data.users) {
      updateScoreboard(data.users);
    }

    startTimer();
  }
  wsClient.send({ channel: "App", version: 30610, url: "join" });
};

const updateScoreboard = (users: any[]) => {
  const newScores: Record<string, number> = {};
  users.forEach(u => {
    newScores[u.user.nickName || u.user.uid] = u.score;
  });
  scoreBoard.value = newScores;
};

const onRefreshUsers = (data: any) => {
  if (data.users) {
    updateScoreboard(data.users);
  }
};

const onAction = (data: any) => {
  if (data.actions) {
    for (const action of data.actions) {
      const idx = action.r * minefield.value.Width + action.c;
      const cell = minefield.value.Cell[idx];
      if (cell) {
        if (action.a === 0) {
          cell.IsOpen = true;
          cell.IsFlagged = false;
        } else if (action.a === 1) {
          cell.IsFlagged = true;
        }
      }
    }
  }

  if (data.user) {
    // Optionally update user score if we knew their name accurately
    // For now we rely on refresh users or just update this exact user
    const name = data.user.user.nickName || data.user.user.uid;
    if (scoreBoard.value[name] !== undefined || data.user.score > 0) {
        scoreBoard.value[name] = data.user.score;
    }
    
    // Earn Score logic could be extrapolated from before/after diff or we can rely on existing code structure
  }
};

const onFinish = (data: any) => {
   ElMessageBox.confirm("游戏已结束，是否刷新？", "游戏结束", {
        confirmButtonText: "刷新",
        cancelButtonText: "取消",
        type: "success",
   }).then(() => {
     reset();
   }).catch(() => {});
};

const startTimer = () => {
  if (!timer) {
    timer = true;
    intervalFlag = window.setInterval(() => {
      let now = new Date().getTime();
      timeWatcher.value = msToTime(now - startTimeStamp);
    }, 1);
  }
};

const handleClick = (event: MouseEvent, index: number) => {
  if (isBlocked.value) return; // 踩雷惩罚判断

  if (event.button === 1) { // Middle click reset
    reset();
    return;
  }
  
  flagSound.stop();
  openSound.stop();

  const isRightClick = event.button === 2;
  const shouldFlag = isRightClick !== flagMode.value;
  
  const cell = minefield.value.Cell[index];
  const r = Math.floor(index / minefield.value.Width);
  const c = index % minefield.value.Width;

  if (shouldFlag) {
    if (!cell.IsOpen) { // Only flag un-opened ones
      const isAlreadyObj = cell.IsFlagged; 
      // If we supported unflag it'd be here, but spec said only 0/1, no unflag
      sendAction(1, c, r);
      flagSound.play();
    } else {
      // 展开周围 (双击/点击已开)
      doExpand(index);
    }
  } else { // 挖开
    if (!cell.IsOpen && !cell.IsFlagged) {
      if (cell.IsMine) {
        // 踩雷惩罚
        isBlocked.value = true;
        boomSound.play();
        ElMessage.error("踩雷啦！操作被锁定5秒...");
        blockTimeout.value = window.setTimeout(() => {
          isBlocked.value = false;
          ElMessage.success("锁定解除，可继续操作！");
        }, 5000);
      } else {
        openSound.play();
      }
      sendAction(0, c, r);
    } else if (cell.IsOpen) {
      doExpand(index);
    }
  }
};

const doExpand = (index: number) => {
  const cell = minefield.value.Cell[index];
  if (!cell.IsOpen) return;
  
  const nearby = getNearbyCells(index);
  const flagCount = nearby.filter(n => minefield.value.Cell[n].IsFlagged).length;
  
  if (flagCount === cell.Mines) {
    openSound.play();
    nearby.forEach(i => {
      const nCell = minefield.value.Cell[i];
      if (!nCell.IsOpen && !nCell.IsFlagged) {
        if (nCell.IsMine) {
          isBlocked.value = true;
          boomSound.play();
          ElMessage.error("周围排错踩雷啦！操作被锁定5秒...");
          if (blockTimeout.value) clearTimeout(blockTimeout.value);
          blockTimeout.value = window.setTimeout(() => {
            isBlocked.value = false;
            ElMessage.success("锁定解除，可继续操作！");
          }, 5000);
        }
        sendAction(0, i % minefield.value.Width, Math.floor(i / minefield.value.Width));
      }
    });
  }
};

const sendAction = (a: number, c: number, r: number) => {
  wsClient.send({
    url: "action",
    actions: [{ a, c, r }]
  });
};

const getNearbyCells = (cell: number) => {
  let nearbyCells = [];
  let width = minefield.value.Width;
  let height = minefield.value.Height;
  let x = cell % width;
  let y = Math.floor(cell / width);

  let isNotFirstRow = y > 0;
  let isNotLastRow = y < height - 1;

  if (isNotFirstRow) nearbyCells.push(cell - width); //up
  if (isNotLastRow) nearbyCells.push(cell + width); //down

  if (x > 0) {
    nearbyCells.push(cell - 1); //left
    if (isNotFirstRow) nearbyCells.push(cell - width - 1); //up left
    if (isNotLastRow) nearbyCells.push(cell + width - 1); //down left
  }

  if (x < width - 1) {
    nearbyCells.push(cell + 1); //right
    if (isNotFirstRow) nearbyCells.push(cell - width + 1); //up right
    if (isNotLastRow) nearbyCells.push(cell + width + 1); //down right
  }

  return nearbyCells;
};

const getImageSrc = (cell: Cell) => {
  let mines = cell.Mines;
  if (cell.IsOpen) {
    if (cell.IsMine) {
      return `/src/assets/themes/wom/flag.png`;
    }
    if (cell.Mines === 9) {
      return `/src/assets/themes/wom/closed.png`;
    }
    return `/src/assets/themes/wom/type${mines}.png`;
  }
  if (cell.IsFlagged) {
    return `/src/assets/themes/wom/flag.png`;
  }
  return `/src/assets/themes/wom/closed.png`;
};

function msToTime(duration: number): string {
  const milliseconds = duration % 1000;
  const seconds = Math.floor(duration / 1000);
  const secondsStr = seconds < 10 ? "0" + seconds : seconds;
  return `${secondsStr}:${milliseconds}`;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("uid");
}

function reset() {
  wsClient.send({ url: "enter" });
}

</script>

<style scoped>
.topPositionFixed {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  gap: 10px;
  align-items: center;
}

.timeWatcher {
  font-size: 26px;
  font-weight: bold;
  color: #00bd7e;
  margin-left: 20px;
}

.main-layout {
  display: flex;
  justify-content: center;
  gap: 20px;
  height: calc(100vh - 150px);
  max-width: 100vw;
}

.left-panel {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
}

.center-panel {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  max-width: calc(100% - 220px);
}

.board {
  display: grid;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 8px;
}

.cell {
  background-size: cover;
  position: relative;
  box-sizing: border-box;
}

.blocked-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 0, 0, 0.2);
  z-index: 10;
  cursor: not-allowed;
}
</style>
