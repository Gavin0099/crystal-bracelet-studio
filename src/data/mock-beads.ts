import { BeadSpec } from '../domain/types';

/**
 * 預設水晶珠子樣品庫 (Concept v0.1 展示資料)
 * 注意：Phase 2 將開放後台由店主自行新增/編輯/上傳
 */
export const MOCK_BEADS: BeadSpec[] = [
  {
    id: 'amethyst-8',
    name: '烏拉圭紫水晶 8mm',
    category: '紫水晶',
    diameterMm: 8,
    priceMinor: 3500, // NT$ 35
    currency: 'TWD',
    fallbackColor: '#8a62a7',
  },
  {
    id: 'amethyst-10',
    name: '烏拉圭紫水晶 10mm',
    category: '紫水晶',
    diameterMm: 10,
    priceMinor: 4800, // NT$ 48
    currency: 'TWD',
    fallbackColor: '#7e539d',
  },
  {
    id: 'amethyst-12',
    name: '烏拉圭紫水晶 12mm',
    category: '紫水晶',
    diameterMm: 12,
    priceMinor: 6500, // NT$ 65
    currency: 'TWD',
    fallbackColor: '#6c438c',
  },
  {
    id: 'rose-quartz-8',
    name: '馬達加斯加粉晶 8mm',
    category: '粉晶',
    diameterMm: 8,
    priceMinor: 3000, // NT$ 30
    currency: 'TWD',
    fallbackColor: '#f7c5cc',
  },
  {
    id: 'rose-quartz-10',
    name: '馬達加斯加粉晶 10mm',
    category: '粉晶',
    diameterMm: 10,
    priceMinor: 4200, // NT$ 42
    currency: 'TWD',
    fallbackColor: '#f4b2bb',
  },
  {
    id: 'clear-quartz-8',
    name: '白水晶 8mm',
    category: '白水晶',
    diameterMm: 8,
    priceMinor: 2500, // NT$ 25
    currency: 'TWD',
    fallbackColor: '#eef2f7',
  },
  {
    id: 'clear-quartz-10',
    name: '白水晶 10mm',
    category: '白水晶',
    diameterMm: 10,
    priceMinor: 3500, // NT$ 35
    currency: 'TWD',
    fallbackColor: '#e2e8f0',
  },
  {
    id: 'obsidian-10',
    name: '彩虹眼黑曜石 10mm',
    category: '黑曜石',
    diameterMm: 10,
    priceMinor: 3800, // NT$ 38
    currency: 'TWD',
    fallbackColor: '#2b2d42',
  },
  {
    id: 'obsidian-12',
    name: '彩虹眼黑曜石 12mm',
    category: '黑曜石',
    diameterMm: 12,
    priceMinor: 5200, // NT$ 52
    currency: 'TWD',
    fallbackColor: '#1a1b26',
  },
  {
    id: 'rutilated-quartz-10',
    name: '順髮金髮晶 10mm',
    category: '髮晶',
    diameterMm: 10,
    priceMinor: 8800, // NT$ 88
    currency: 'TWD',
    fallbackColor: '#dfb15b',
  },
  {
    id: 'rutilated-quartz-12',
    name: '順髮金髮晶 12mm',
    category: '髮晶',
    diameterMm: 12,
    priceMinor: 12800, // NT$ 128
    currency: 'TWD',
    fallbackColor: '#cc9e45',
  },
  {
    id: 'aquamarine-8',
    name: '海藍寶 8mm',
    category: '海藍寶',
    diameterMm: 8,
    priceMinor: 4500, // NT$ 45
    currency: 'TWD',
    fallbackColor: '#a0d2eb',
  },
  {
    id: 'aquamarine-10',
    name: '海藍寶 10mm',
    category: '海藍寶',
    diameterMm: 10,
    priceMinor: 5800, // NT$ 58
    currency: 'TWD',
    fallbackColor: '#80c2e3',
  },
];

/**
 * 預設展示手串 (S1 靜態原型預設載入)
 * 模擬一條約 16 顆、包含 8mm / 10mm 的初始搭配
 */
export const DEFAULT_BRACELET_BEADS: BeadSpec[] = [
  MOCK_BEADS[1], // amethyst 10
  MOCK_BEADS[4], // rose quartz 10
  MOCK_BEADS[6], // clear quartz 10
  MOCK_BEADS[0], // amethyst 8
  MOCK_BEADS[0], // amethyst 8
  MOCK_BEADS[6], // clear quartz 10
  MOCK_BEADS[4], // rose quartz 10
  MOCK_BEADS[1], // amethyst 10
  MOCK_BEADS[9], // rutilated 10
  MOCK_BEADS[6], // clear quartz 10
  MOCK_BEADS[3], // rose quartz 8
  MOCK_BEADS[3], // rose quartz 8
  MOCK_BEADS[6], // clear quartz 10
  MOCK_BEADS[9], // rutilated 10
  MOCK_BEADS[1], // amethyst 10
  MOCK_BEADS[4], // rose quartz 10
];
