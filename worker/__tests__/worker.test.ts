import { describe, it, expect, vi } from 'vitest';
import worker, { Env } from '../index';

describe('S5: Cloudflare Worker API & Shared-Secret Authorization Boundary', () => {
  const VALID_SECRET = 'a_very_secure_random_32_byte_secret_value_123456';

  it('1. GET /api/beads 應為 Public 端點，無 Secret 時正常回傳 200', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'amethyst-8',
              name: '紫水晶 8mm',
              category: '紫水晶',
              diameter_mm: 8,
              image_key: null,
              fallback_color: '#8a62a7',
            },
          ],
        }),
      }),
    };

    const env: Env = { DB: mockDb, ADMIN_SECRET: VALID_SECRET };
    const request = new Request('http://localhost:8787/api/beads', { method: 'GET' });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveLength(1);
  });

  it('2. GET /api/beads 帶有任意 Authorization Header 依然只作為 Public GET 正常回傳 200', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    };

    const env: Env = { DB: mockDb, ADMIN_SECRET: VALID_SECRET };
    const request = new Request('http://localhost:8787/api/beads', {
      method: 'GET',
      headers: { Authorization: 'Bearer some_unrelated_token' },
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);
  });

  it('3. POST /api/admin/beads 未提供 Authorization 時應拒絕存取並回傳 401', async () => {
    const env: Env = { DB: {}, ADMIN_SECRET: VALID_SECRET };
    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '測試' }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('4. POST /api/admin/beads 帶有錯誤 Bearer Token 時應回傳 401', async () => {
    const env: Env = { DB: {}, ADMIN_SECRET: VALID_SECRET };
    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong_secret_token',
      },
      body: JSON.stringify({ name: '測試' }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(401);
  });

  it('5. POST /api/admin/beads 帶有正確 Bearer Token 時應通過鑑權並進入 stub 回傳 200', async () => {
    const env: Env = { DB: {}, ADMIN_SECRET: VALID_SECRET };
    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: JSON.stringify({ name: '測試' }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.message).toContain('Authorized');
  });

  it('6. POST /api/admin/verify 驗證端點在正確 Token 下應回傳 200', async () => {
    const env: Env = { DB: {}, ADMIN_SECRET: VALID_SECRET };
    const request = new Request('http://localhost:8787/api/admin/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VALID_SECRET}`,
      },
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('7. OPTIONS Preflight 請求在白名單 Origin 下應正確回傳 CORS Headers', async () => {
    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://crystal-bracelet-studio.pages.dev',
      },
    });

    const env: Env = { DB: {}, ADMIN_SECRET: VALID_SECRET };
    const response = await worker.fetch(request, env, {});

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://crystal-bracelet-studio.pages.dev'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('8. 非白名單 Origin 不應獲得放行之 Access-Control-Allow-Origin Header', async () => {
    const request = new Request('http://localhost:8787/api/beads', {
      method: 'GET',
      headers: {
        Origin: 'https://malicious-site.com',
      },
    });

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    };

    const env: Env = { DB: mockDb, ADMIN_SECRET: VALID_SECRET };
    const response = await worker.fetch(request, env, {});

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('9. 關鍵防禦 Fail-Closed：若伺服器未設置 ADMIN_SECRET，必須回傳 500 且拒絕所有 mutation', async () => {
    // 模擬 ADMIN_SECRET 為 undefined 或空字串的情境
    const env: Env = { DB: {}, ADMIN_SECRET: undefined };
    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer undefined',
      },
      body: JSON.stringify({ name: '測試' }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('ADMIN_SECRET is not configured');
  });
});
