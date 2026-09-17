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

describe('S7: Image Upload, Replacement & R2 Compensation Cleanup', () => {
  const VALID_SECRET = 'a_very_secure_random_32_byte_secret_value_123456';

  it('1. POST /api/admin/beads/:id/image 上傳合法 WebP 圖片應成功寫入 R2 與 D1', async () => {
    const mockR2Put = vi.fn().mockResolvedValue({});
    const mockR2 = { put: mockR2Put, delete: vi.fn(), get: vi.fn() };

    let currentImageKey: string | null = null;
    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT id, image_key')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: 'bead-1', image_key: currentImageKey }),
            }),
          };
        }
        if (query.includes('UPDATE beads SET image_key')) {
          return {
            bind: vi.fn().mockImplementation((newKey: string, beadId: string) => ({
              run: vi.fn().mockImplementation(async () => {
                currentImageKey = newKey;
                return { success: true };
              }),
            })),
          };
        }
        return {};
      }),
    };

    const env: Env = {
      DB: mockDb,
      BEAD_IMAGES: mockR2,
      ADMIN_SECRET: VALID_SECRET,
    };

    // 模擬二進位圖片 (1024 bytes WebP)
    const fakeImageData = new Uint8Array(1024);
    const request = new Request('http://localhost:8787/api/admin/beads/bead-1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/webp',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: fakeImageData,
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.id).toBe('bead-1');
    expect(data.imageKey).toMatch(/^beads\/[0-9a-f-]+\.webp$/);

    // 驗證 R2.put 呼叫
    expect(mockR2Put).toHaveBeenCalledWith(
      data.imageKey,
      expect.any(ArrayBuffer),
      expect.objectContaining({ httpMetadata: { contentType: 'image/webp' } })
    );

    // 驗證 D1 UPDATE 呼叫
    expect(currentImageKey).toBe(data.imageKey);
  });

  it('2. POST /api/admin/beads/:id/image 替換圖片時應成功上傳新圖並清理刪除舊圖 (R2 GC)', async () => {
    const oldImageKey = 'beads/old-image-123.jpg';
    const mockR2Delete = vi.fn().mockResolvedValue({});
    const mockR2Put = vi.fn().mockResolvedValue({});
    const mockR2 = { put: mockR2Put, delete: mockR2Delete, get: vi.fn() };

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT id, image_key')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: 'bead-1', image_key: oldImageKey }),
            }),
          };
        }
        if (query.includes('UPDATE beads SET image_key')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          };
        }
        return {};
      }),
    };

    const env: Env = {
      DB: mockDb,
      BEAD_IMAGES: mockR2,
      ADMIN_SECRET: VALID_SECRET,
    };

    const fakeImageData = new Uint8Array(512);
    const request = new Request('http://localhost:8787/api/admin/beads/bead-1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: fakeImageData,
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.imageKey).toMatch(/^beads\/[0-9a-f-]+\.png$/);

    // 驗證新圖寫入
    expect(mockR2Put).toHaveBeenCalledWith(
      data.imageKey,
      expect.any(ArrayBuffer),
      expect.objectContaining({ httpMetadata: { contentType: 'image/png' } })
    );

    // 關鍵：驗證舊圖被主動刪除以防 R2 孤立垃圾檔案
    expect(mockR2Delete).toHaveBeenCalledWith(oldImageKey);
  });

  it('3. [跨資源補償清理 Compensation Cleanup]: 當 R2 上傳成功但 D1 更新失敗時，應自動刪除新上傳的 R2 物件並回傳 500', async () => {
    const mockR2Put = vi.fn().mockResolvedValue({});
    const mockR2Delete = vi.fn().mockResolvedValue({});
    const mockR2 = { put: mockR2Put, delete: mockR2Delete, get: vi.fn() };

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT id, image_key')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: 'bead-1', image_key: null }),
            }),
          };
        }
        if (query.includes('UPDATE beads SET image_key')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockRejectedValue(new Error('D1 Disk Full or Constraint Violation')),
            }),
          };
        }
        return {};
      }),
    };

    const env: Env = {
      DB: mockDb,
      BEAD_IMAGES: mockR2,
      ADMIN_SECRET: VALID_SECRET,
    };

    const fakeImageData = new Uint8Array(256);
    const request = new Request('http://localhost:8787/api/admin/beads/bead-1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: fakeImageData,
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('Database update failed; newly uploaded image was rolled back');

    // 驗證新上傳到 R2 的 key 被觸發補償清理 (delete)
    expect(mockR2Put).toHaveBeenCalled();
    const uploadedKey = mockR2Put.mock.calls[0][0];
    expect(mockR2Delete).toHaveBeenCalledWith(uploadedKey);
  });

  it('4. 上傳不支援之 MIME (如 SVG, GIF, EXE) 應回傳 415 Unsupported Media Type 且不觸發 R2/D1', async () => {
    const mockR2Put = vi.fn();
    const mockR2 = { put: mockR2Put, delete: vi.fn(), get: vi.fn() };
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 'bead-1', image_key: null }),
        }),
      }),
    };

    const env: Env = {
      DB: mockDb,
      BEAD_IMAGES: mockR2,
      ADMIN_SECRET: VALID_SECRET,
    };

    const request = new Request('http://localhost:8787/api/admin/beads/bead-1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/svg+xml',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: '<svg></svg>',
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(415);
    expect(mockR2Put).not.toHaveBeenCalled();
  });

  it('5. 上傳超過 5MB 之檔案應回傳 400 Payload size invalid 且不觸發 R2/D1', async () => {
    const mockR2Put = vi.fn();
    const mockR2 = { put: mockR2Put, delete: vi.fn(), get: vi.fn() };
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 'bead-1', image_key: null }),
        }),
      }),
    };

    const env: Env = {
      DB: mockDb,
      BEAD_IMAGES: mockR2,
      ADMIN_SECRET: VALID_SECRET,
    };

    // 5MB + 1 byte
    const oversizedBuffer = new Uint8Array(5 * 1024 * 1024 + 1);
    const request = new Request('http://localhost:8787/api/admin/beads/bead-1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: oversizedBuffer,
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Payload size invalid');
    expect(mockR2Put).not.toHaveBeenCalled();
  });

  it('6. 上傳目標珠子不存在 (404) 時應直接終止不觸發 R2', async () => {
    const mockR2Put = vi.fn();
    const mockR2 = { put: mockR2Put, delete: vi.fn(), get: vi.fn() };
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null), // 珠子不存在
        }),
      }),
    };

    const env: Env = {
      DB: mockDb,
      BEAD_IMAGES: mockR2,
      ADMIN_SECRET: VALID_SECRET,
    };

    const request = new Request('http://localhost:8787/api/admin/beads/non-existent/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${VALID_SECRET}`,
      },
      body: new Uint8Array(100),
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(404);
    expect(mockR2Put).not.toHaveBeenCalled();
  });

  it('7. Public GET /api/images/* 串流端點應自 R2 讀取並附帶快取標頭回傳', async () => {
    const fakeStream = 'image-stream-content';
    const mockR2Get = vi.fn().mockResolvedValue({
      body: fakeStream,
      httpMetadata: { contentType: 'image/webp' },
    });
    const mockR2 = { get: mockR2Get, put: vi.fn(), delete: vi.fn() };

    const env: Env = { DB: {}, BEAD_IMAGES: mockR2 };

    const request = new Request('http://localhost:8787/api/images/beads/sample.webp', {
      method: 'GET',
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toContain('public, max-age=86400');
    expect(mockR2Get).toHaveBeenCalledWith('beads/sample.webp');
  });

  it('8. Public GET /api/images/* 找不到物件時應回傳 404 Not Found', async () => {
    const mockR2Get = vi.fn().mockResolvedValue(null);
    const mockR2 = { get: mockR2Get, put: vi.fn(), delete: vi.fn() };

    const env: Env = { DB: {}, BEAD_IMAGES: mockR2 };

    const request = new Request('http://localhost:8787/api/images/beads/missing.webp', {
      method: 'GET',
    });

    const response = await worker.fetch(request, env, {});
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Image not found');
  });
});

