import { BeadSpec, BraceletPlacement, LengthSummary } from './types';

/**
 * 依據珠子直徑比例純函式計算環狀極座標排列 (Functional Core)
 * 零 DOM 依賴、零像素污染、確定性運算 (Deterministic)
 */
export function calculateBraceletLayout(
  beads: readonly BeadSpec[]
): readonly BraceletPlacement[] {
  const count = beads.length;
  if (count === 0) {
    return [];
  }

  const totalDiameter = beads.reduce((acc, b) => acc + (b.diameterMm > 0 ? b.diameterMm : 8), 0);
  if (totalDiameter <= 0) {
    return [];
  }

  let accumulatedAngle = 0;
  const twoPi = 2 * Math.PI;

  return beads.map((bead, index) => {
    const diameter = bead.diameterMm > 0 ? bead.diameterMm : 8;
    const proportion = diameter / totalDiameter;
    const arcAngle = proportion * twoPi;

    // 珠子中心點位於其分配弧形區間的正中央
    const centerAngle = (accumulatedAngle + arcAngle / 2) % twoPi;
    accumulatedAngle += arcAngle;

    return {
      slotId: `slot-${index}-${bead.id}`,
      beadId: bead.id,
      angleRad: centerAngle,
      visualProportion: proportion,
    };
  });
}

/**
 * 計算長度統計資訊 (目前總直徑、參考手圍、差值)
 */
export function calculateLengthSummary(
  beads: readonly BeadSpec[],
  targetReferenceMm: number
): LengthSummary {
  const totalDiameterMm = beads.reduce(
    (acc, b) => acc + (b.diameterMm > 0 ? b.diameterMm : 0),
    0
  );

  return {
    totalDiameterMm,
    targetReferenceMm,
    deltaMm: targetReferenceMm - totalDiameterMm,
    count: beads.length,
  };
}
