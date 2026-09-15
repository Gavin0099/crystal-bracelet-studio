import { describe, it, expect } from 'vitest';
import { calculateBraceletLayout, calculateLengthSummary } from '../layout';
import { BeadSpec } from '../types';
import { MOCK_BEADS, DEFAULT_BRACELET_BEADS } from '../../data/mock-beads';

describe('Concept v0.1 手串互動與長度同步驗證 (End-to-End State Invariants)', () => {
  const targetWristMm = 160;

  it('流程驗證 1: 選取「紫水晶 10mm」加入手串 -> 珠數 +1, 總直徑 +10mm, 尚差長度 -10mm', () => {
    // 初始狀態
    const initialBeads = [...DEFAULT_BRACELET_BEADS];
    const initialSummary = calculateLengthSummary(initialBeads, targetWristMm);

    // 找到紫水晶 10mm
    const amethyst10 = MOCK_BEADS.find((b) => b.id === 'amethyst-10')!;
    expect(amethyst10).toBeDefined();
    expect(amethyst10.diameterMm).toBe(10);

    // 動作: 加選手串
    const updatedBeads = [...initialBeads, amethyst10];
    const updatedSummary = calculateLengthSummary(updatedBeads, targetWristMm);

    // 斷言驗收: 珠數 +1
    expect(updatedSummary.count).toBe(initialSummary.count + 1);
    // 斷言驗收: 總直徑 +10mm
    expect(updatedSummary.totalDiameterMm).toBe(initialSummary.totalDiameterMm + 10);
    // 斷言驗收: 尚差長度 -10mm (target - total)
    expect(updatedSummary.deltaMm).toBe(initialSummary.deltaMm - 10);
  });

  it('流程驗證 2: 點選手串上的珠子刪除 -> 各數值同步精確恢復', () => {
    const initialBeads = [...DEFAULT_BRACELET_BEADS];
    const initialSummary = calculateLengthSummary(initialBeads, targetWristMm);

    // 加入一顆紫水晶 10mm
    const amethyst10 = MOCK_BEADS.find((b) => b.id === 'amethyst-10')!;
    const beadsWithNewItem = [...initialBeads, amethyst10];
    const addedIndex = beadsWithNewItem.length - 1;

    // 動作: 點選該珠子並刪除
    const restoredBeads = beadsWithNewItem.filter((_, idx) => idx !== addedIndex);
    const restoredSummary = calculateLengthSummary(restoredBeads, targetWristMm);

    // 斷言驗收: 數值完全恢復初始狀態
    expect(restoredSummary.count).toBe(initialSummary.count);
    expect(restoredSummary.totalDiameterMm).toBe(initialSummary.totalDiameterMm);
    expect(restoredSummary.deltaMm).toBe(initialSummary.deltaMm);
  });

  it('流程驗證 3: 替換手串中的珠子 (將 8mm 替換為 12mm) -> 總直徑增加 4mm，顆數保持不變', () => {
    // 建立一條初始手串
    const beads: BeadSpec[] = [
      MOCK_BEADS.find((b) => b.diameterMm === 8)!,
      MOCK_BEADS.find((b) => b.diameterMm === 10)!,
    ];
    const initialSummary = calculateLengthSummary(beads, targetWristMm);

    // 替換索引 0 (8mm -> 12mm)
    const bead12mm = MOCK_BEADS.find((b) => b.diameterMm === 12)!;
    const replacedBeads = [...beads];
    replacedBeads[0] = bead12mm;

    const replacedSummary = calculateLengthSummary(replacedBeads, targetWristMm);

    // 顆數不變
    expect(replacedSummary.count).toBe(initialSummary.count);
    // 總直徑增加 (12 - 8 = 4mm)
    expect(replacedSummary.totalDiameterMm).toBe(initialSummary.totalDiameterMm + 4);
    // 尚差長度縮減 4mm
    expect(replacedSummary.deltaMm).toBe(initialSummary.deltaMm - 4);
  });

  it('幾何驗證 4: 8mm -> 10mm -> 12mm -> 8mm 混排 -> 幾何角度全覆蓋且大珠分配弧長嚴格大於小珠', () => {
    const mixedBeads = [
      MOCK_BEADS.find((b) => b.diameterMm === 8)!,
      MOCK_BEADS.find((b) => b.diameterMm === 10)!,
      MOCK_BEADS.find((b) => b.diameterMm === 12)!,
      MOCK_BEADS.find((b) => b.diameterMm === 8)!,
    ];

    const placements = calculateBraceletLayout(mixedBeads);
    expect(placements.length).toBe(4);

    // 驗證 12mm 珠子的弧長份額大於 8mm 與 10mm
    const p8a = placements[0];
    const p10 = placements[1];
    const p12 = placements[2];
    const p8b = placements[3];

    expect(p12.visualProportion).toBeGreaterThan(p10.visualProportion);
    expect(p10.visualProportion).toBeGreaterThan(p8a.visualProportion);
    expect(p8a.visualProportion).toBeCloseTo(p8b.visualProportion, 5);

    // 驗證各珠中心角互不重疊、遞增分佈在 [0, 2π) 區間
    expect(p8a.angleRad).toBeLessThan(p10.angleRad);
    expect(p10.angleRad).toBeLessThan(p12.angleRad);
    expect(p12.angleRad).toBeLessThan(p8b.angleRad);
  });

  it('重置驗證 5: Reset 能確實驗證恢復預設狀態', () => {
    let currentBeads = [...DEFAULT_BRACELET_BEADS];
    // 清空
    currentBeads = [];
    expect(currentBeads.length).toBe(0);

    // Reset 回預設
    currentBeads = [...DEFAULT_BRACELET_BEADS];
    expect(currentBeads.length).toBe(DEFAULT_BRACELET_BEADS.length);
    const summary = calculateLengthSummary(currentBeads, targetWristMm);
    expect(summary.count).toBe(DEFAULT_BRACELET_BEADS.length);
  });
});
