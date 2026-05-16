// 传输函数类型 —— 由消费方提供实现
// Electron 渲染器: 通过 IPC window.electronAPI.apiRequest 实现
// 论坛 Web: 通过 fetch + Vite 代理实现
export type FetchFn = <T>(path: string, params: Record<string, any>) => Promise<T>
