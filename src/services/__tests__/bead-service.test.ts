import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBeadCatalog, CatalogLoadError } from '../bead-service';
import { MOCK_BEADS } from '../../data/mock-beads';

describe('S4: BeadService & Catalog Storage API Integration', () => {
  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('應在 API 回傳 200 時正確解析並回傳珠子目錄', async () => {
    const mockApiResponse = [
      {
        id: 'amethyst-8',
        name: '烏拉圭紫水晶 8mm',
        category: '紫水晶',
        diameterMm: 8,
        imageKey: 'beads/amethyst-8.webp',
        fallbackColor: '#8a62a7',
      },
      {
        id: 'moonstone-10',
        name: '藍月光石 10mm',
        category: '月光石',
        diameterMm: 10,
        imageKey: null,
        fallbackColor: '#e0e7ff',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const result = await getBeadCatalog();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('amethyst-8');
    expect(result[0].imageKey).toBe('beads/amethyst-8.webp');
    expect(result[1].id).toBe('moonstone-10');
    expect(result[1].imageKey).toBeNull();
  });

  it('在 DEV 環境下：應在 API 回傳 500 或 404 時優雅降級回傳 MOCK_BEADS', async () => {
    process.env.NODE_ENV = 'development';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database unavailable' }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getBeadCatalog();

    expect(result).toEqual(MOCK_BEADS);
    expect(result.length).toBeGreaterThan(0);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('在 Production 環境下：API 失敗時必須 Fail-Closed 拋出 CatalogLoadError，絕不偷退回 MOCK_BEADS', async () => {
    process.env.NODE_ENV = 'production';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    await expect(getBeadCatalog()).rejects.toThrow(CatalogLoadError);
  });

  it('在 Production 環境下：網路斷線/連線失敗時必須拋出 CatalogLoadError，絕不顯示舊 mock', async () => {
    process.env.NODE_ENV = 'production';
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(getBeadCatalog()).rejects.toThrow(CatalogLoadError);
  });

  it('回傳之所有珠子物件必須滿足 BeadSpec Invariants (包含合理的 diameterMm 與無價格欄位)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_BEADS,
    });

    const beads = await getBeadCatalog();

    expect(beads.length).toBeGreaterThan(0);
    for (const bead of beads) {
      expect(typeof bead.id).toBe('string');
      expect(typeof bead.name).toBe('string');
      expect(typeof bead.category).toBe('string');
      expect(typeof bead.diameterMm).toBe('number');
      expect(bead.diameterMm).toBeGreaterThan(0);
      expect((bead as any).priceMinor).toBeUndefined();
      expect((bead as any).price).toBeUndefined();
      expect((bead as any).currency).toBeUndefined();
    }
  });
});
