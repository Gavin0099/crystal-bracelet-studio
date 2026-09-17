import { BeadSpec } from '../domain/types';
import { MOCK_BEADS } from '../data/mock-beads';
import { API_BASE_URL } from '../config/api';

export class CatalogLoadError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'CatalogLoadError';
  }
}

/**
 * 載入珠子目錄
 * 規則 (Fail-Closed 原則)：
 * 1. 優先由 Worker D1 API 讀取。
 * 2. 僅在開發環境 (NODE_ENV !== 'production') 允許 fallback 到 MOCK_BEADS。
 * 3. 在 Production 環境中：API 失敗時直接拋出 CatalogLoadError，
 *    絕不偷偷顯示舊 mock，防止前後台資料幽靈不一致。
 */
export async function getBeadCatalog(): Promise<BeadSpec[]> {
  const isProd = process.env.NODE_ENV === 'production';
  const isRelative = !API_BASE_URL.startsWith('http');
  const base = isRelative
    ? typeof window !== 'undefined'
      ? ''
      : 'http://localhost:8787'
    : API_BASE_URL;

  const url = `${base}/api/beads`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (isProd) {
        throw new CatalogLoadError(`API returned status ${res.status}`, res.status);
      }
      console.warn(`[getBeadCatalog] (DEV only) API returned ${res.status}, falling back to mock.`);
      return MOCK_BEADS;
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      return data as BeadSpec[];
    }

    if (isProd) {
      throw new CatalogLoadError('API response is not an array');
    }
    return MOCK_BEADS;
  } catch (err) {
    if (err instanceof CatalogLoadError) {
      throw err;
    }

    if (isProd) {
      throw new CatalogLoadError(
        `Network or fetch error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    console.warn('[getBeadCatalog] (DEV only) Network error, falling back to mock:', err);
    return MOCK_BEADS;
  }
}

/**
 * 取得珠子實拍圖片的公開讀取 URL (Worker R2 交付串流)
 * 若 imageKey 為空則回傳 null，UI 應退回 fallbackColor 呈現
 */
export function getBeadImageUrl(imageKey?: string | null): string | null {
  if (!imageKey || !imageKey.trim()) {
    return null;
  }
  const isRelative = !API_BASE_URL.startsWith('http');
  const base = isRelative
    ? typeof window !== 'undefined'
      ? ''
      : 'http://localhost:8787'
    : API_BASE_URL;
  return `${base}/api/images/${imageKey.trim()}`;
}

