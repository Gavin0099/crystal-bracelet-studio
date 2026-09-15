import { describe, it, expect } from 'vitest';
import { calculateBraceletLayout, calculateLengthSummary } from '../layout';
import { BeadSpec } from '../types';

const createMockBead = (id: string, diameterMm: number): BeadSpec => ({
  id,
  name: `Bead ${id}`,
  category: 'Quartz',
  diameterMm,
  priceMinor: 2000,
  currency: 'TWD',
});

describe('Bracelet Layout Functional Core (Invariants)', () => {
  it('should return empty placement array for empty beads', () => {
    const placements = calculateBraceletLayout([]);
    expect(placements).toEqual([]);
  });

  it('should preserve count (Given N beads -> exactly N placements)', () => {
    const beads = [
      createMockBead('b1', 10),
      createMockBead('b2', 10),
      createMockBead('b3', 10),
    ];
    const placements = calculateBraceletLayout(beads);
    expect(placements.length).toBe(3);
  });

  it('should be deterministic (same input produces identical angles)', () => {
    const beads = [
      createMockBead('b1', 8),
      createMockBead('b2', 10),
      createMockBead('b3', 12),
    ];
    const run1 = calculateBraceletLayout(beads);
    const run2 = calculateBraceletLayout(beads);
    expect(run1).toEqual(run2);
  });

  it('should have uniform spacing for equal size beads', () => {
    const count = 8;
    const beads = Array.from({ length: count }, (_, i) => createMockBead(`b${i}`, 10));
    const placements = calculateBraceletLayout(beads);

    const expectedStep = (2 * Math.PI) / count;
    for (let i = 1; i < placements.length; i++) {
      const diff = placements[i].angleRad - placements[i - 1].angleRad;
      expect(diff).toBeCloseTo(expectedStep, 4);
    }
  });

  it('should allocate larger visual proportion to larger beads (Monotonicity)', () => {
    const beads = [
      createMockBead('small', 8),
      createMockBead('large', 12),
    ];
    const placements = calculateBraceletLayout(beads);
    const smallPlacement = placements.find((p) => p.beadId === 'small')!;
    const largePlacement = placements.find((p) => p.beadId === 'large')!;

    expect(largePlacement.visualProportion).toBeGreaterThan(smallPlacement.visualProportion);
  });

  it('should produce valid angle bounds and no NaN or Infinity', () => {
    const beads = [
      createMockBead('b1', 8),
      createMockBead('b2', 10),
      createMockBead('b3', 12),
      createMockBead('b4', 14),
    ];
    const placements = calculateBraceletLayout(beads);

    for (const p of placements) {
      expect(Number.isNaN(p.angleRad)).toBe(false);
      expect(Number.isFinite(p.angleRad)).toBe(true);
      expect(p.angleRad).toBeGreaterThanOrEqual(0);
      expect(p.angleRad).toBeLessThan(2 * Math.PI);
    }
  });
});

describe('Length Summary Functional Core', () => {
  it('should calculate total diameter and delta correctly', () => {
    const beads = [
      createMockBead('b1', 8),
      createMockBead('b2', 10),
      createMockBead('b3', 12),
    ];
    const summary = calculateLengthSummary(beads, 150);

    expect(summary.count).toBe(3);
    expect(summary.totalDiameterMm).toBe(30); // 8 + 10 + 12
    expect(summary.targetReferenceMm).toBe(150);
    expect(summary.deltaMm).toBe(120); // 150 - 30
  });
});
