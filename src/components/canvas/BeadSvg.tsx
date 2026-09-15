'use client';

import React from 'react';
import { BeadSpec } from '../../domain/types';

interface BeadSvgProps {
  bead: BeadSpec;
  cx: number;
  cy: number;
  radiusPx: number;
  isSelected?: boolean;
  onClick?: () => void;
  index: number;
}

export const BeadSvg: React.FC<BeadSvgProps> = ({
  bead,
  cx,
  cy,
  radiusPx,
  isSelected = false,
  onClick,
  index,
}) => {
  const gradientId = `bead-grad-${bead.id}-${index}`;
  const baseColor = bead.fallbackColor || '#9c80bc';

  return (
    <g
      className="cursor-pointer transition-transform duration-200 active:scale-95 select-none"
      onClick={onClick}
    >
      <defs>
        {/* 水晶球體擬真立體球形漸層 */}
        <radialGradient id={gradientId} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="25%" stopColor={baseColor} stopOpacity="0.95" />
          <stop offset="80%" stopColor={baseColor} stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
        </radialGradient>
        {/* 輕微投影 */}
        <filter id={`drop-shadow-${index}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* 選中高亮外光環 */}
      {isSelected && (
        <circle
          cx={cx}
          cy={cy}
          r={radiusPx + 4}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeDasharray="4 2"
          className="animate-pulse"
        />
      )}

      {/* 珠體陰影與底色球體 */}
      <circle
        cx={cx}
        cy={cy}
        r={radiusPx}
        fill={`url(#${gradientId})`}
        filter={`url(#drop-shadow-${index})`}
      />

      {/* 高光反光點 (提升水晶通透感) */}
      <ellipse
        cx={cx - radiusPx * 0.3}
        cy={cy - radiusPx * 0.35}
        rx={radiusPx * 0.28}
        ry={radiusPx * 0.18}
        fill="#ffffff"
        opacity="0.65"
        transform={`rotate(-25 ${cx - radiusPx * 0.3} ${cy - radiusPx * 0.35})`}
      />

      {/* 珠子直徑小文字 (方便對照驗證，小字沉浸) */}
      <text
        cx={cx}
        cy={cy}
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        fontSize={radiusPx * 0.55}
        fill="#ffffff"
        opacity="0.9"
        fontWeight="600"
        pointerEvents="none"
      >
        {bead.diameterMm}
      </text>
    </g>
  );
};
