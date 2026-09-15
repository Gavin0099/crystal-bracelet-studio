'use client';

import React, { useMemo } from 'react';
import { BeadSpec } from '../../domain/types';
import { calculateBraceletLayout } from '../../domain/layout';
import { BeadSvg } from './BeadSvg';

interface BraceletCanvasProps {
  beads: readonly BeadSpec[];
  selectedIndex?: number | null;
  onSelectBead?: (index: number) => void;
}

export const BraceletCanvas: React.FC<BraceletCanvasProps> = ({
  beads,
  selectedIndex = null,
  onSelectBead,
}) => {
  // 純計算核心輸出配置
  const placements = useMemo(() => calculateBraceletLayout(beads), [beads]);

  // 視圖畫布幾何常數 (UI Shell 專有，不污染領域模型)
  const CANVAS_SIZE = 360;
  const CENTER_X = CANVAS_SIZE / 2;
  const CENTER_Y = CANVAS_SIZE / 2;
  const BASE_BRACELET_RADIUS = 120; // 穿線圓心半徑 (px)

  // 基準珠子繪製半徑：10mm 對應 14px，其餘等比換算
  const getVisualBeadRadius = (diameterMm: number): number => {
    const baseMm = 10;
    const basePx = 13.5;
    return (diameterMm / baseMm) * basePx;
  };

  return (
    <div className="relative w-full aspect-square max-w-[380px] mx-auto flex items-center justify-center p-2">
      <svg
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        className="w-full h-full touch-manipulation drop-shadow-sm"
      >
        {/* 背景柔和手圍指示環 */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={BASE_BRACELET_RADIUS}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.6"
        />

        {/* 穿線示意 (微透淡金色彈性線) */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={BASE_BRACELET_RADIUS}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="2.5"
        />

        {/* 珠子節點排列 */}
        {placements.map((placement, index) => {
          const bead = beads[index];
          if (!bead) return null;

          const angle = placement.angleRad;
          // 極座標轉笛卡兒坐標 (UI Shell 職責)
          const x = CENTER_X + BASE_BRACELET_RADIUS * Math.cos(angle);
          const y = CENTER_Y + BASE_BRACELET_RADIUS * Math.sin(angle);
          const beadRadius = getVisualBeadRadius(bead.diameterMm);

          return (
            <BeadSvg
              key={placement.slotId}
              bead={bead}
              index={index}
              cx={x}
              cy={y}
              radiusPx={beadRadius}
              isSelected={selectedIndex === index}
              onClick={() => onSelectBead?.(index)}
            />
          );
        })}

        {/* 中央空白指示或手串提示 */}
        {beads.length === 0 && (
          <text
            x={CENTER_X}
            y={CENTER_Y}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="14"
            className="select-none"
          >
            點擊下方水晶開始設計
          </text>
        )}
      </svg>
    </div>
  );
};
