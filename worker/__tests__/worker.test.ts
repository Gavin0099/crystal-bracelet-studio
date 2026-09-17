import { describe, it, expect, vi } from 'vitest';
import worker, { Env } from '../index';

describe('S4: Cloudflare Worker API (GET /api/beads & CORS)', () => {
  it('處理 OPTIONS preflight 請求應回傳 204 與 CORS headers', async () => {
    const request = new Request('http://localhost:8787/api/beads', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://crystal-bracelet-studio.pages.dev',
      },
    });

    const env: Env = { DB: {} };
    const response = await worker.fetch(request, env, {});

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://crystal-bracelet-studio.pages.dev'
    );
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('GET /api/beads 應自 D1 讀取並轉換為 BeadSpec 格式回傳 200', async () => {
    const mockDbResults = [
      {
        id: 'amethyst-8',
        name: '烏拉圭紫水晶 8mm',
        category: '紫水晶',
        diameter_mm: 8,
        image_key: 'beads/test.webp',
        fallback_color: '#8a62a7',
      },
      {
        id: 'clear-quartz-10',
        name: '白水晶 10mm',
        category: '白水晶',
        diameter_mm: 10,
        image_key: null,
        fallback_color: '#ffffff',
      },
    ];

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockDbResults }),
      }),
    };

    const env: Env = { DB: mockDb };
    const request = new Request('http://localhost:8787/api/beads', { method: 'GET' });

    const response = await worker.fetch(request, env, {});

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({
      id: 'amethyst-8',
      name: '烏拉圭紫水晶 8mm',
      category: '紫水晶',
      diameterMm: 8,
      imageKey: 'beads/test.webp',
      fallbackColor: '#8a62a7',
    });
    expect(data[1].imageKey).toBeNull();
  });

  it('GET /api/beads 若缺失 DB binding 應回傳 500', async () => {
    const env: Env = { DB: null };
    const request = new Request('http://localhost:8787/api/beads', { method: 'GET' });

    const response = await worker.fetch(request, env, {});

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Database binding DB is missing');
  });

  it('存取未知路徑應回傳 404 Not Found', async () => {
    const env: Env = { DB: {} };
    const request = new Request('http://localhost:8787/api/unknown', { method: 'GET' });

    const response = await worker.fetch(request, env, {});

    expect(response.status).toBe(404);
  });
});
