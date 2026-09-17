import { BeadSpec } from '../domain/types';

/**
 * 預設水晶珠子樣品庫 (Phase 2 過渡假資料，S4 起改由 Cloudflare D1 提供)
 * 規則：一個商品 = 一個尺寸，不含價格
 */
export const MOCK_BEADS: BeadSpec[] = [
  {
    id: 'amethyst-8',
    name: '烏拉圭紫水晶 8mm',
    category: '紫水晶',
    diameterMm: 8,
    fallbackColor: '#8a62a7',
  },
  {
    id: 'amethyst-10',
    name: '烏拉圭紫水晶 10mm',
    category: '紫水晶',
    diameterMm: 10,
    fallbackColor: '#7e539d',
  },
  {
    id: 'amethyst-12',
    name: '烏拉圭紫水晶 12mm',
    category: '紫水晶',
    diameterMm: 12,
    fallbackColor: '#6c438c',
  },
  {
    id: 'rose-quartz-8',
    name: '馬達加斯加粉晶 8mm',
    category: '粉晶',
    diameterMm: 8,
    fallbackColor: '#f7c5cc',
  },
  {
    id: 'rose-quartz-10',
    name: '馬達加斯加粉晶 10mm',
    category: '粉晶',
    diameterMm: 10,
    fallbackColor: '#f4b2bb',
  },
  {
    id: 'clear-quartz-8',
    name: '白水晶 8mm',
    category: '白水晶',
    diameterMm: 8,
    fallbackColor: '#eef2f7',
  },
  {
    id: 'clear-quartz-10',
    name: '白水晶 10mm',
    category: '白水晶',
    diameterMm: 10,
    fallbackColor: '#e2e8f0',
  },
  {
    id: 'obsidian-10',
    name: '彩虹眼黑曜石 10mm',
    category: '黑曜石',
    diameterMm: 10,
    fallbackColor: '#2b2d42',
  },
  {
    id: 'obsidian-12',
    name: '彩虹眼黑曜石 12mm',
    category: '黑曜石',
    diameterMm: 12,
    fallbackColor: '#1a1b26',
  },
  {
    id: 'rutilated-quartz-10',
    name: '順髮金髮晶 10mm',
    category: '髮晶',
    diameterMm: 10,
    fallbackColor: '#dfb15b',
  },
  {
    id: 'rutilated-quartz-12',
    name: '順髮金髮晶 12mm',
    category: '髮晶',
    diameterMm: 12,
    fallbackColor: '#cc9e45',
  },
  {
    id: 'aquamarine-8',
    name: '海藍寶 8mm',
    category: '海藍寶',
    diameterMm: 8,
    fallbackColor: '#a0d2eb',
  },
  {
    id: 'aquamarine-10',
    name: '海藍寶 10mm',
    category: '海藍寶',
    diameterMm: 10,
    fallbackColor: '#80c2e3',
  },
];
