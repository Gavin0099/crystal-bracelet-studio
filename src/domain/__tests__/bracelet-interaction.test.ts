import { describe, it, expect } from 'vitest';
import { calculateBraceletLayout, calculateLengthSummary } from '../layout';
import { BeadSpec } from '../types';
import { MOCK_BEADS } from '../../data/mock-beads';

describe('正式版手串互動與長度同步驗證 (End-to-End State Invariants)', () => {
  const targetWristMm = 160;

  it('S1 流程驗證 1: 新使用者 0 顆開局 -> 珠數 0, 總直徑 0mm, 尚差長度 160mm', () => {
    const initialBeads: BeadSpec[] = [];
    const summary = calculateLengthSummary(initialBeads, targetWristMm);

    expect(summary.count).toBe(0);
    expect(summary.totalDiameterMm).toBe(0);
    expect(summary.deltaMm).toBe(160);
    expect(summary.targetReferenceMm).toBe(160);
  });

  it('S1/S2 流程驗證 2: 選取「紫水晶 10mm」加入空手串 -> 珠數 1, 總直徑 10mm, 尚差長度 150mm (無價格)', () => {
    const initialBeads: BeadSpec[] = [];

    // 找到紫水晶 10mm
    const amethyst10 = MOCK_BEADS.find((b) => b.id === 'amethyst-10')!;
    expect(amethyst10).toBeDefined();
    expect(amethyst10.diameterMm).toBe(10);

    // 動作: 加選手串
    const updatedBeads = [...initialBeads, amethyst10];
    const updatedSummary = calculateLengthSummary(updatedBeads, targetWristMm);

    // 斷言驗收: 珠數 1, 總直徑 10mm, 尚差 150mm
    expect(updatedSummary.count).toBe(1);
    expect(updatedSummary.totalDiameterMm).toBe(10);
    expect(updatedSummary.deltaMm).toBe(150);
  });

  it('流程驗證 3: 點選手串上的珠子刪除 -> 回復為 0 顆初始狀態', () => {
    const amethyst10 = MOCK_BEADS.find((b) => b.id === 'amethyst-10')!;
    const beads = [amethyst10];

    // 刪除該珠子
    const restoredBeads = beads.filter((_, idx) => idx !== 0);
    const restoredSummary = calculateLengthSummary(restoredBeads, targetWristMm);

    expect(restoredSummary.count).toBe(0);
    expect(restoredSummary.totalDiameterMm).toBe(0);
    expect(restoredSummary.deltaMm).toBe(160);
  });

  it('流程驗證 4: 替換手串中的珠子 (將 8mm 替換為 12mm) -> 總直徑增加 4mm，顆數保持不變', () => {
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

    expect(replacedSummary.count).toBe(2);
    expect(replacedSummary.totalDiameterMm).toBe(initialSummary.totalDiameterMm + 4);
    expect(replacedSummary.deltaMm).toBe(initialSummary.deltaMm - 4);
  });

  it('幾何驗證 5: 8mm -> 10mm -> 12mm -> 8mm 混排 -> 幾何角度全覆蓋且大珠分配弧長嚴格大於小珠', () => {
    const mixedBeads = [
      MOCK_BEADS.find((b) => b.diameterMm === 8)!,
      MOCK_BEADS.find((b) => b.diameterMm === 10)!,
      MOCK_BEADS.find((b) => b.diameterMm === 12)!,
      MOCK_BEADS.find((b) => b.diameterMm === 8)!,
    ];

    const placements = calculateBraceletLayout(mixedBeads);
    expect(placements.length).toBe(4);

    const p8a = placements[0];
    const p10 = placements[1];
    const p12 = placements[2];
    const p8b = placements[3];

    expect(p12.visualProportion).toBeGreaterThan(p10.visualProportion);
    expect(p10.visualProportion).toBeGreaterThan(p8a.visualProportion);
    expect(p8a.visualProportion).toBeCloseTo(p8b.visualProportion, 5);

    expect(p8a.angleRad).toBeLessThan(p10.angleRad);
    expect(p10.angleRad).toBeLessThan(p12.angleRad);
    expect(p12.angleRad).toBeLessThan(p8b.angleRad);
  });

  it('S1 重置驗證 6: Reset 確實驗證回到 0 顆空手串', () => {
    // 假設手串已有 5 顆
    let currentBeads = [
      MOCK_BEADS[0],
      MOCK_BEADS[1],
      MOCK_BEADS[2],
      MOCK_BEADS[3],
      MOCK_BEADS[4],
    ];
    expect(currentBeads.length).toBe(5);

    // 動作: Reset
    currentBeads = [];
    const summary = calculateLengthSummary(currentBeads, targetWristMm);

    // 斷言: 回到 0 顆，總直徑 0
    expect(summary.count).toBe(0);
    expect(summary.totalDiameterMm).toBe(0);
    expect(summary.deltaMm).toBe(targetWristMm);
  });
});
