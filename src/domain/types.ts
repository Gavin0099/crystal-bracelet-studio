/**
 * 珠子規格定義 (純資料領域模型)
 */
export interface BeadSpec {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly diameterMm: number;
  readonly priceMinor: number;          // 金額以小單位整數計（如 TWD 3000 = NT$30, CNY 1700 = ¥17.00）
  readonly currency: 'TWD' | 'CNY';
  readonly imageUrl?: string;           // 實拍圖
  readonly fallbackColor?: string;      // 缺省或加載中時的色票
}

/**
 * 手串上的節點配置 (幾何排列模型 - 純幾何/無畫布像素)
 */
export interface BraceletPlacement {
  readonly slotId: string;
  readonly beadId: string;
  readonly angleRad: number;            // 在圓環上的極角弧度 (0 ~ 2π)
  readonly visualProportion: number;    // 該珠子佔全環弧度/直徑比例 (0 ~ 1)
}

/**
 * 長度與手圍統計摘要
 */
export interface LengthSummary {
  readonly totalDiameterMm: number;     // 目前珠子直徑總和
  readonly targetReferenceMm: number;   // 目標參考手圍長度
  readonly deltaMm: number;             // 差值 (target - total，正值表示尚差，負值表示超出)
  readonly count: number;               // 目前珠子總顆數
}
