# Mines Client Lite

基于 Vite + Electron 的扫雷游戏桌面客户端，使用 [Doubleshot](https://github.com/Doubleshotjs/doubleshot) 构建，极速开发体验。

## 技术栈

- **渲染进程**: Vue 3 + Element Plus + Vue Router
- **主进程**: Electron + esbuild (vite-plugin-doubleshot)
- **打包**: electron-builder
- **语言**: TypeScript

## 快速开始

```bash
# 安装依赖 (需要 pnpm)
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build
```

## 环境变量

复制 `.env.example` 为 `.env`，填入对应配置：

| 变量 | 说明 |
|---|---|
| `ENCRYPT_KEY` | AES 加密密钥 |
| `ENCRYPT_SALT` | 加密盐值 |
| `ENCRYPT_SECRET_KEY` | 请求体加密密钥 |
| `DECRYPT_SECRET_KEY` | 响应体解密密钥 |

`.env` 已加入 `.gitignore`，不会被提交到仓库。

## 项目结构

```
src/
├── main/       # Electron 主进程
├── preload/    # 预加载脚本
├── render/     # Vue 渲染进程
└── common/     # 共享模块
```

## PNPM 配置

请在 `.npmrc` 中使用以下配置之一：

```
node-linker=hoisted
```

## 许可

基于 [fast-vite-electron](https://github.com/ArcherGu/fast-vite-electron) 模板构建。
