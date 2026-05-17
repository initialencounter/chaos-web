/// <reference types="vite/client" />

declare module 'markdown-it' {
  const MarkdownIt: any
  export default MarkdownIt
}

declare module 'pako' {
  export function inflate(data: Uint8Array, options?: { to?: 'string' }): string | Uint8Array
}
