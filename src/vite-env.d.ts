/// <reference types="vite/client" />
// 构建时注入：自建后端同源部署时传 VITE_API_BASE=/v1，页面就走相对路径，不需要 CORS
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
