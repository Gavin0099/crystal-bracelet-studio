import { describe, it, expect, vi } from 'vitest';
import worker, { Env } from '../index';

describe('S6: Add Bead & Worker Mutation Protection', () => {
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

  it('2. POST /api/admin/beads 正確 secret + valid data 應寫入 D1 並回傳 201 Created', async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const env: Env = {
      DB: { prepare: mockPrepare },
      ADMIN_SECRET: VALID_SECRET,
    };

    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: JSON.stringify({
        name: '藍月光石',
        category: '月光石',
        diameterMm: 8,
      }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(201);

    const created = await response.json();
    expect(created.name).toBe('藍月光石');
    expect(created.category).toBe('月光石');
    expect(created.diameterMm).toBe(8);
    expect(created.imageKey).toBeNull();
    expect(created.fallbackColor).toBe('#D1D5DB');
    expect(created.id).toMatch(/^bead-[0-9a-f-]+$/);

    // 驗證 D1 確實被呼叫寫入
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO beads')
    );
    expect(mockBind).toHaveBeenCalledWith(
      created.id,
      '藍月光石',
      '月光石',
      8,
      '#D1D5DB'
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it('2b. [S6 E2E Integration Closed Loop]: POST 新增 -> D1 寫入 -> Public GET 讀取 -> 前台手串幾何引擎連動計算', async () => {
    // 模擬記憶體內 D1 資料庫
    const inMemoryTable: any[] = [];
    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO beads')) {
          return {
            bind: vi.fn().mockImplementation((id, name, category, diameter_mm, fallback_color) => ({
              run: vi.fn().mockImplementation(async () => {
                inMemoryTable.push({
                  id,
                  name,
                  category,
                  diameter_mm,
                  image_key: null,
                  fallback_color,
                });
                return { success: true };
              }),
            })),
          };
        }
        if (query.includes('SELECT')) {
          return {
            all: vi.fn().mockResolvedValue({ results: inMemoryTable }),
          };
        }
        return {};
      }),
    };

    const env: Env = { DB: mockDb, ADMIN_SECRET: VALID_SECRET };

    // Step 1: Admin POST 新增「藍月光石」(不含尺寸)
    const postReq = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: JSON.stringify({
        name: '藍月光石',
        category: '月光石',
        diameterMm: 8,
      }),
    });
    const postRes = await worker.fetch(postReq, env, {});
    expect(postRes.status).toBe(201);
    const createdBead = await postRes.json();

    // Step 2: Public GET /api/beads 取得新珠子 (無圖，fallbackColor 預設)
    const getReq = new Request('http://localhost:8787/api/beads', { method: 'GET' });
    const getRes = await worker.fetch(getReq, env, {});
    expect(getRes.status).toBe(200);
    const catalog = await getRes.json();

    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe(createdBead.id);
    expect(catalog[0].name).toBe('藍月光石');
    expect(catalog[0].diameterMm).toBe(8);
    expect(catalog[0].imageKey).toBeNull();
    expect(catalog[0].fallbackColor).toBe('#D1D5DB');

    // Step 3: 前台手串幾何計算引擎連動 (加入手串 -> 珠數+1，總直徑+8mm，尚差長度 152mm)
    const { calculateLengthSummary } = await import('../../src/domain/layout');
    const summary = calculateLengthSummary([catalog[0]], 160);
    expect(summary.count).toBe(1);
    expect(summary.totalDiameterMm).toBe(8);
    expect(summary.deltaMm).toBe(152);
  });

  it('3. POST /api/admin/beads 沒有 Authorization 時應回傳 401 且 D1 不執行', async () => {
    const mockPrepare = vi.fn();
    const env: Env = { DB: { prepare: mockPrepare }, ADMIN_SECRET: VALID_SECRET };

    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '測試', category: '測試', diameterMm: 10 }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(401);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('4. POST /api/admin/beads 錯誤 Bearer Token 時應回傳 401', async () => {
    const mockPrepare = vi.fn();
    const env: Env = { DB: { prepare: mockPrepare }, ADMIN_SECRET: VALID_SECRET };

    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong_token',
      },
      body: JSON.stringify({ name: '測試', category: '測試', diameterMm: 10 }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(401);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('5. POST /api/admin/beads 當 diameterMm <= 0 時應回傳 400 Bad Request 且 D1 不變', async () => {
    const mockPrepare = vi.fn();
    const env: Env = { DB: { prepare: mockPrepare }, ADMIN_SECRET: VALID_SECRET };

    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: JSON.stringify({ name: '非法尺寸', category: '水晶', diameterMm: -5 }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('diameterMm must be a positive number');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('6. POST /api/admin/beads 當 name 或 category 為空白時應回傳 400 Bad Request', async () => {
    const mockPrepare = vi.fn();
    const env: Env = { DB: { prepare: mockPrepare }, ADMIN_SECRET: VALID_SECRET };

    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: JSON.stringify({ name: '   ', category: '', diameterMm: 8 }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('name and category are required');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('7. S7/S8 未實作之 mutation 端點在正確 Token 下應回傳 501 Not Implemented (不回假 200)', async () => {
    const env: Env = { DB: {}, ADMIN_SECRET: VALID_SECRET };

    const request = new Request('http://localhost:8787/api/admin/beads/bead-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: JSON.stringify({ diameterMm: 12 }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(501);

    const body = await response.json();
    expect(body.error).toBe('Not Implemented');
  });

  it('8. 伺服器未設置 ADMIN_SECRET 時採 Fail-Closed 回傳 500', async () => {
    const env: Env = { DB: {}, ADMIN_SECRET: undefined };

    const request = new Request('http://localhost:8787/api/admin/beads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer undefined',
      },
      body: JSON.stringify({ name: '測試', category: '測試', diameterMm: 8 }),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('ADMIN_SECRET is not configured');
  });
});
