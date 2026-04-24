<template>
  <div v-if="showResultDialog">
    <el-dialog
      v-model="showResultDialog"
      width="420px"
      :show-close="false"
      center
    >
      <div style="text-align: center; padding: 0 0 10px 0">
        <div v-if="resultList.length > 0" style="margin-bottom: 18px">
          <div
            style="display: flex; flex-direction: column; align-items: center"
          >
            <div style="position: relative">
              <img
                :src="resultList[0].user.avatar"
                style="
                  width: 90px;
                  height: 90px;
                  border-radius: 50%;
                  border: 4px solid gold;
                  object-fit: cover;
                "
              />
              <span
                style="
                  position: absolute;
                  right: -10px;
                  top: -10px;
                  font-size: 2.2rem;
                "
                >⚡</span
              >
            </div>
            <div style="font-size: 1.3rem; font-weight: bold; margin-top: 8px">
              {{ resultList[0].user.nickName }}
            </div>
            <div style="color: #888; font-size: 1rem; margin: 2px 0 6px 0">
              正確 {{ resultList[0].countCorrect }} 错误
              {{
                resultList[0].countIncorrect ?? resultList[0].countError
              }}
              分数 {{ resultList[0].score }}
            </div>
          </div>
        </div>
        <el-divider style="margin: 10px 0" />
        <div>
          <div
            v-for="(item, idx) in resultList"
            :key="item.user.uid"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin: 8px 0;
            "
          >
            <div style="display: flex; align-items: center">
              <span
                v-if="idx < 3"
                style="font-size: 1.3rem; width: 2.2em; text-align: center"
                >{{ getRankIcon(idx + 1) }}</span
              >
              <img
                :src="item.user.avatar"
                :style="{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: getRankBorder(idx + 1),
                  objectFit: 'cover',
                  marginRight: '8px',
                }"
              />
              <span style="font-weight: 600">{{ item.user.nickName }}</span>
              <span
                v-if="lastHitUid && item.user.uid === lastHitUid"
                style="color: #e44; font-size: 0.95em; margin-left: 6px"
                >最后一击</span
              >
            </div>
            <div style="font-size: 0.98em">
              <span style="color: #0a0">{{ item.countCorrect }}</span> /
              <span style="color: #e44">{{
                item.countIncorrect ?? item.countError
              }}</span>
              / <span style="color: #09c">{{ item.score }}</span>
            </div>
          </div>
        </div>
        <div
          style="
            display: flex;
            justify-content: space-between;
            margin-top: 18px;
          "
        >
          <el-button type="default" @click="showResultDialog = false"
            >返回</el-button
          >
          <el-button
            type="primary"
            @click="
              () => {
                showResultDialog = false;
                reset();
              }
            "
            >再来一局</el-button
          >
        </div>
      </div>
    </el-dialog>
  </div>

  <div class="topPositionFixed">
    <div class="header-content">
      <el-button class="logout-button" style="width: 5rem" @click="exitRoom"
        >退出房间</el-button
      >
      <el-button class="logout-button" style="width: 5rem" @click="doHint"
        >提示</el-button
      >
      <el-button
        :style="{ background: flagMode ? '#5282b8' : '#5c8f4b', width: '5rem' }"
        class="flag-switch-button"
        @click="flagMode = !flagMode"
        >{{ flagMode ? '标记' : '挖开' }}模式
      </el-button>
      <el-button class="logout-button" style="width: 5rem" @click="reset"
        >重新进入房间</el-button
      >
      <div class="timeWatcher">{{ timeWatcher }}</div>
    </div>
    <ScoreTip ref="scoreTip" class="scoreTipParent"></ScoreTip>
  </div>

  <div class="main-layout">
    <div class="left-panel">
      <ScoreBoard
        :scoreBoard="scoreBoard"
        class="scoreBoard"
        v-if="Object.keys(scoreBoard).length > 0"
      ></ScoreBoard>
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
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed } from 'vue';
import type { Cell, Minefield, ScoreBoard as ScoreBoardType } from '@/types';
import ScoreBoard from '@/components/ScoreBoard.vue';
import ScoreTip from '@/components/ScoreTip.vue';
import { Howl } from 'howler';
import { wsClient } from '@/api/websocket';

interface Action {
  a: number; // action type: 0 for open, 1 for flag
  r: number; // row
  c: number; // column
}

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

const timeWatcher = ref('00:000');
const scoreBoard = ref<ScoreBoardType>({});
const isBlocked = ref(false);
const blockTimeout = ref<number | null>(null);

// 结算弹窗相关
const showResultDialog = ref(false);
const resultList = ref<any[]>([]);
const lastHitUid = ref<string | null>(null);
const myUid = ref<string | null>(null); // 可根据实际登录信息赋值

const openSound = new Howl({
  src: ['/src/assets/audio/open.mp3'],
  volume: 0.5,
});
const flagSound = new Howl({
  src: ['/src/assets/audio/flag.mp3'],
  volume: 0.5,
});
const boomSound = new Howl({
  src: ['/src/assets/audio/boom.mp3'],
  volume: 0.5,
});
const flagMode = ref(false);
let startTimeStamp = 0;
let timer = false;
let intervalFlag: number;

document.oncontextmenu = () => false;

onMounted(() => {
  initGame();
});

onUnmounted(() => {
  wsClient.off('chaos/enter', onEnter);
  wsClient.off('chaos/action', onAction);
  wsClient.off('chaos/refresh/users', onRefreshUsers);
  wsClient.off('chaos/finish', onFinish);
  wsClient.off('ready', onReady);
  wsClient.off('disconnect', onDisconnect);
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
  wsClient.on('chaos/enter', onEnter);
  wsClient.on('chaos/action', onAction);
  wsClient.on('chaos/refresh/users', onRefreshUsers);
  wsClient.on('chaos/finish', onFinish);
  wsClient.on('ready', onReady);
  wsClient.on('disconnect', onDisconnect);
  wsClient.connect(url);
};

const onDisconnect = () => {
  ElMessageBox.confirm('与服务器断开连接，是否重新入房间？', '连接断开', {
    confirmButtonText: '重连',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      reset();
    })
    .catch(() => {});
};

const onReady = () => {
  console.log('WebSocket connection established, entering room...');
  wsClient.send({ url: 'enter' });
};

const onEnter = (data: any) => {
  console.log('Entered room, initializing game state...');
  // Parse map
  if (data.map) {
    const mapData = data.map.map as string; // like "19932...-129..."
    const mapStatus = data.map.mapStatus as string; // like "10010..."

    const rows = mapData.split('-').filter((row) => row.length > 0);
    const statuses = mapStatus.split('-').filter((row) => row.length > 0);

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
          IsFlagged: status === '8',
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
  wsClient.send({ channel: 'App', version: 30610, url: 'join' });
};

const updateScoreboard = (users: any[]) => {
  const newScores: Record<string, number> = {};
  users.forEach((u) => {
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
  // 排序，找出最后一击
  if (data && data.users) {
    // 找到最后一击
    let last = data.users.find((u: any) => u.lastOpen);
    lastHitUid.value = last ? last.user.uid : null;
    // 排序，分数高在前
    let sorted = [...data.users].sort((a, b) => b.score - a.score);
    resultList.value = sorted;
    showResultDialog.value = true;
  }
};
// 头像边框颜色
const getRankBorder = (rank: number) => {
  if (rank === 1) return '3px solid gold';
  if (rank === 2) return '3px solid #aaa';
  if (rank === 3) return '3px solid #c96';
  return '2px solid #eee';
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
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

  flagSound.stop();
  openSound.stop();

  const isRightClick = event.button === 2;
  const shouldFlag = isRightClick !== flagMode.value;

  const cell = minefield.value.Cell[index];
  const r = Math.floor(index / minefield.value.Width);
  const c = index % minefield.value.Width;
  if (shouldFlag) {
    flagSound.play();
    if (!cell.IsOpen) {
      // Only flag un-opened ones
      if (!cell.IsMine) {
        boomSound.play();
        // isBlocked.value = true;
        ElMessage.error('标记错了！1秒后恢复');
        // if (blockTimeout.value) {
        //   clearTimeout(blockTimeout.value);
        // }
        // blockTimeout.value = window.setTimeout(() => {
        //   isBlocked.value = false;
        // }, 3000);
      }
      doFlag({ a: 1, c, r });
    } else {
      // 展开周围 (双击/点击已开)
      doExpand(index);
    }
  } else {
    // 挖开
    openSound.play();
    if (!cell.IsOpen && !cell.IsFlagged) {
      if (cell.IsMine) {
        boomSound.play();
        cell.IsFlagged = true;
        // isBlocked.value = true;
        ElMessage.error('踩到雷了！1秒后恢复');
        // if (blockTimeout.value) {
        //   clearTimeout(blockTimeout.value);
        // }
        // blockTimeout.value = window.setTimeout(() => {
        //   isBlocked.value = false;
        // }, 3000);
      }
      console.log('Opening cell:', r, c, cell);
      doOpen({ a: 0, c, r });
    } else if (cell.IsOpen) {
      doExpand(index);
    }
  }
};

function doOpen(action: Action) {
  let actions: Action[] = [];
  const cell =
    minefield.value.Cell[action.r * minefield.value.Width + action.c];
  if (cell.Mines === 0) {
    actions.push(...reveal(action.a, action.c, action.r));
  }
  actions.push(action);
  sendActions(actions);
}

function doFlag(action: Action) {
  sendActions([action]);
}

const doExpand = (index: number) => {
  const cell = minefield.value.Cell[index];
  if (!cell.IsOpen) return;

  const nearby = getNearbyCells(index);
  const flagCount = nearby.filter(
    (n) =>
      minefield.value.Cell[n].IsFlagged ||
      (minefield.value.Cell[n].IsOpen && minefield.value.Cell[n].IsMine),
  ).length;

  if (flagCount === cell.Mines) {
    openSound.play();
    let actions: Action[] = [];
    nearby.forEach((i) => {
      const nCell = minefield.value.Cell[i];
      if (!nCell.IsOpen && !nCell.IsFlagged) {
        actions.push({
          a: 0,
          c: i % minefield.value.Width,
          r: Math.floor(i / minefield.value.Width),
        });
        if (nCell.Mines === 0) {
          actions.push(
            ...reveal(
              0,
              i % minefield.value.Width,
              Math.floor(i / minefield.value.Width),
            ),
          );
        }
      }
    });
    sendActions(actions);
  }
};

const reveal = (a: number, c: number, r: number) => {
  if (a !== 0) return [];
  let actions: Action[] = [];
  console.log(r * minefield.value.Width + c, 'reveal called');
  const cell = minefield.value.Cell[r * minefield.value.Width + c];
  if (cell.Mines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        // 去除自己
        if (dr === 0 && dc === 0) continue;
        // 边界检测
        if (
          r + dr < 0 ||
          r + dr >= minefield.value.Height ||
          c + dc < 0 ||
          c + dc >= minefield.value.Width
        )
          continue;
        const nCell =
          minefield.value.Cell[(r + dr) * minefield.value.Width + (c + dc)];
        if (nCell.IsOpen || nCell.IsFlagged) continue; // 已经打开或标记的格子不处理
        nCell.IsOpen = true; // 本地先标记为打开，避免重复递归
        actions.push({ a: 0, r: r + dr, c: c + dc });
        // 递归展开
        if (nCell.Mines === 0) {
          actions.push(...reveal(0, c + dc, r + dr));
        }
      }
    }
  }
  return actions;
};

const sendActions = (actions: Action[]) => {
  if (actions.length === 0) return;
  // 本地立即更新地图
  actions.forEach((act) => {
    const idx = act.r * minefield.value.Width + act.c;
    const cell = minefield.value.Cell[idx];
    if (cell) {
      if (act.a === 0) {
        cell.IsOpen = true;
        cell.IsFlagged = false;
      } else if (act.a === 1) {
        cell.IsFlagged = true;
      }
    }
  });
  wsClient.send({
    url: 'action',
    actions,
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
  const milliseconds = duration % 10;
  const seconds = Math.floor(duration / 1000);
  const secondsStr = seconds < 10 ? '0' + seconds : seconds;
  return `${secondsStr}:${milliseconds}`;
}

function doHint() {
  // 简单提示：找一个未打开的格子，挖开它，如果是空格则继续挖开周围
  for (let i = 0; i < minefield.value.Cell.length; i++) {
    const cell = minefield.value.Cell[i];
    if (!cell.IsOpen && !cell.IsFlagged && !cell.IsMine) {
      const r = Math.floor(i / minefield.value.Width);
      const c = i % minefield.value.Width;
      doOpen({ a: 0, c, r });
      break;
    }
  }
}

function exitRoom() {
  wsClient.send({ url: 'leave' });
  ElMessageBox.confirm('确定要退出房间吗？', '退出确认', {
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      // Optionally we can also clear local state here
      minefield.value = {
        Width: 0,
        Height: 0,
        Cells: 0,
        Mines: 0,
        Cell: [],
        First: false,
        StartTimeStamp: 0,
      };
      scoreBoard.value = {};
      timeWatcher.value = '00:000';
      wsClient.off('chaos/enter', onEnter);
      wsClient.off('chaos/action', onAction);
      wsClient.off('chaos/refresh/users', onRefreshUsers);
      wsClient.off('chaos/finish', onFinish);
      wsClient.off('ready', onReady);
      wsClient.off('disconnect', onDisconnect);
      wsClient.close();
    })
    .catch(() => {});
}

function reset() {
  wsClient.off('chaos/enter', onEnter);
  wsClient.off('chaos/action', onAction);
  wsClient.off('chaos/refresh/users', onRefreshUsers);
  wsClient.off('chaos/finish', onFinish);
  wsClient.off('ready', onReady);
  wsClient.off('disconnect', onDisconnect);
  wsClient.close();
  initGame();
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
  width: 150px;
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
