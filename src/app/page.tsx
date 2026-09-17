'use client';

import React, { useState, useMemo } from 'react';
import { BeadSpec } from '../domain/types';
import { calculateLengthSummary } from '../domain/layout';
import { MOCK_BEADS } from '../data/mock-beads';
import { BraceletCanvas } from '../components/canvas/BraceletCanvas';
import { Trash2, Plus, Sparkles, RotateCcw, Info } from 'lucide-react';

export default function Home() {
  // S1: 手串預設為 0 顆起始 (Empty Bracelet)
  const [braceletBeads, setBraceletBeads] = useState<BeadSpec[]>([]);
  // 目前在手串中選取的珠子索引 (用於刪除/替換)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  // 目標參考手圍長度 (mm)
  const [targetWristMm, setTargetWristMm] = useState<number>(160);
  // 水晶分類篩選
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  // 計算長度統計 (Functional Core - 零價格計算)
  const lengthSummary = useMemo(
    () => calculateLengthSummary(braceletBeads, targetWristMm),
    [braceletBeads, targetWristMm]
  );

  // 分類列表
  const categories = useMemo(() => {
    const set = new Set(MOCK_BEADS.map((b) => b.category));
    return ['全部', ...Array.from(set)];
  }, []);

  // 篩選後的水晶目錄
  const filteredCatalog = useMemo(() => {
    if (activeCategory === '全部') return MOCK_BEADS;
    return MOCK_BEADS.filter((b) => b.category === activeCategory);
  }, [activeCategory]);

  // 點擊目錄中的珠子 -> 加入手串 (或若有選取槽位則替換)
  const handleSelectCatalogBead = (bead: BeadSpec) => {
    if (selectedSlotIndex !== null && selectedSlotIndex < braceletBeads.length) {
      // 替換已選取的槽位
      const updated = [...braceletBeads];
      updated[selectedSlotIndex] = bead;
      setBraceletBeads(updated);
      setSelectedSlotIndex(null);
    } else {
      // 追加到手串末尾
      setBraceletBeads((prev) => [...prev, bead]);
    }
  };

  // 刪除手串上的指定珠子
  const handleRemoveBead = (indexToRemove: number) => {
    setBraceletBeads((prev) => prev.filter((_, i) => i !== indexToRemove));
    setSelectedSlotIndex(null);
  };

  // S1: Reset 直接清空回到 0 顆
  const handleReset = () => {
    setBraceletBeads([]);
    setSelectedSlotIndex(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-between pb-6 font-sans">
      {/* 頂部 Header */}
      <header className="w-full max-w-md bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">晶選手串工作室</h1>
            <p className="text-xs text-slate-500">自由串珠設計</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors font-medium border border-slate-200"
            title="清空重設 (回到 0 顆)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重設
          </button>
        </div>
      </header>

      {/* 主體手串可視區 (Mobile First) */}
      <main className="w-full max-w-md flex-1 flex flex-col items-center px-4 py-2">
        {/* 長度與手圍指標卡 (純尺寸與長度差值，零價格顯示) */}
        <div className="w-full bg-white rounded-xl border border-slate-200 p-3 shadow-xs mb-2">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium text-slate-700 flex items-center gap-1">
              手串尺寸參考
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <span className="text-slate-500">
              目標手圍:
              <select
                value={targetWristMm}
                onChange={(e) => setTargetWristMm(Number(e.target.value))}
                className="ml-1 font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border-0 outline-none"
              >
                <option value={140}>14.0 cm</option>
                <option value={150}>15.0 cm</option>
                <option value={160}>16.0 cm</option>
                <option value={170}>17.0 cm</option>
                <option value={180}>18.0 cm</option>
              </select>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-1 text-center border-t border-slate-100 pt-2">
            <div className="bg-slate-50 rounded-lg p-1.5">
              <div className="text-[11px] text-slate-500">珠數</div>
              <div className="text-base font-bold text-slate-800">
                {lengthSummary.count} <span className="text-xs font-normal">顆</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5">
              <div className="text-[11px] text-slate-500">目前總直徑</div>
              <div className="text-base font-bold text-slate-800">
                {lengthSummary.totalDiameterMm} <span className="text-xs font-normal">mm</span>
              </div>
            </div>
            <div
              className={`rounded-lg p-1.5 ${
                lengthSummary.deltaMm >= 0
                  ? 'bg-indigo-50 text-indigo-900'
                  : 'bg-amber-50 text-amber-900'
              }`}
            >
              <div className="text-[11px] opacity-75">
                {lengthSummary.deltaMm >= 0 ? '尚差長度' : '超出長度'}
              </div>
              <div className="text-base font-bold">
                {Math.abs(lengthSummary.deltaMm)} <span className="text-xs font-normal">mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* 手串 SVG 畫布 */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center relative overflow-hidden py-1">
          <BraceletCanvas
            beads={braceletBeads}
            selectedIndex={selectedSlotIndex}
            onSelectBead={(idx) => setSelectedSlotIndex(idx === selectedSlotIndex ? null : idx)}
          />

          {/* 選取珠子時的快捷操作浮動條 */}
          {selectedSlotIndex !== null && braceletBeads[selectedSlotIndex] && (
            <div className="absolute bottom-3 bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-3 text-xs animate-in fade-in zoom-in duration-150">
              <span className="font-medium text-slate-200">
                #{selectedSlotIndex + 1} {braceletBeads[selectedSlotIndex].name}
              </span>
              <span className="text-slate-400">|</span>
              <button
                onClick={() => handleRemoveBead(selectedSlotIndex)}
                className="flex items-center gap-1 text-rose-300 hover:text-rose-100 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> 移除
              </button>
              <button
                onClick={() => setSelectedSlotIndex(null)}
                className="text-slate-400 hover:text-white"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 底部水晶選品抽屜 (Catalog - 零價格純規格) */}
      <footer className="w-full max-w-md px-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">挑選水晶加入手串</span>
          {selectedSlotIndex !== null && (
            <span className="text-xs text-indigo-600 font-medium">點選水晶進行替換</span>
          )}
        </div>

        {/* 分類標籤滑動條 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white font-medium shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 水晶目錄卡片 (只顯示名稱與尺寸，零價格) */}
        <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto p-1 bg-slate-100/60 rounded-xl border border-slate-200">
          {filteredCatalog.map((bead) => (
            <button
              key={bead.id}
              onClick={() => handleSelectCatalogBead(bead)}
              className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs hover:border-indigo-400 flex flex-col items-center text-center transition-all active:scale-95 group"
            >
              {/* 珠子外觀預覽 */}
              <div
                className="w-9 h-9 rounded-full shadow-inner mb-1.5 flex items-center justify-center text-[10px] text-white font-bold transition-transform group-hover:scale-105"
                style={{ backgroundColor: bead.fallbackColor || '#8a62a7' }}
              >
                {bead.diameterMm}
              </div>

              <div className="text-xs font-medium text-slate-800 line-clamp-1">
                {bead.name.replace(/ \d+mm$/, '')}
              </div>
              <div className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                {bead.diameterMm} mm
              </div>
              <div className="mt-1 text-[10px] text-slate-500 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-3 h-3" /> 加選手串
              </div>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
