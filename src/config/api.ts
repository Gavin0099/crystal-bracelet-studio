/**
 * API 與後端服務環境設定
 */

// 取得 Worker API 的基礎網址 (若為同網域或反向代理則為空字串，本地或跨網域時可由環境變數注入)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8787' : '');
