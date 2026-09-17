'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, LogOut, ArrowLeft, Plus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config/api';

const SESSION_STORAGE_KEY = 'cbs_admin_secret';

export default function AdminPage() {
  const [secretInput, setSecretInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // S6 新增珠子表單狀態
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [diameterMm, setDiameterMm] = useState<number | ''>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // 檢查 sessionStorage 中既有的管理員憑證
  useEffect(() => {
    const storedSecret = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSecret) {
      verifySecretOnServer(storedSecret);
    }
  }, []);

  // 向 Worker /api/admin/verify 驗證 Secret
  const verifySecretOnServer = async (secret: string) => {
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const isRelative = !API_BASE_URL.startsWith('http');
      const base = isRelative
        ? typeof window !== 'undefined'
          ? ''
          : 'http://localhost:8787'
        : API_BASE_URL;

      const res = await fetch(`${base}/api/admin/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      if (res.ok) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, secret);
        setIsAuthenticated(true);
      } else if (res.status === 401) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setIsAuthenticated(false);
        setErrorMessage('管理員密碼錯誤，請重新輸入。');
      } else if (res.status === 500) {
        setErrorMessage('伺服器設定錯誤：後端尚未配置 ADMIN_SECRET。');
      } else {
        setErrorMessage(`伺服器回應異常 (HTTP ${res.status})。`);
      }
    } catch (err: any) {
      setErrorMessage(`連線後端驗證失敗：${err.message || '請確認網路或 API 狀態'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) {
      setErrorMessage('請輸入管理員密碼');
      return;
    }
    verifySecretOnServer(secretInput.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setSecretInput('');
    setErrorMessage(null);
    setFormSuccessMessage(null);
    setFormErrorMessage(null);
  };

  // S6: 提交新增珠子
  const handleAddBead = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccessMessage(null);
    setFormErrorMessage(null);

    const secret = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!secret) {
      setFormErrorMessage('憑證遺失，請重新登入');
      setIsAuthenticated(false);
      return;
    }

    if (!name.trim() || !category.trim()) {
      setFormErrorMessage('名稱與分類不可空白');
      return;
    }

    const numDiameter = Number(diameterMm);
    if (!Number.isFinite(numDiameter) || numDiameter <= 0) {
      setFormErrorMessage('直徑必須大於 0 mm');
      return;
    }

    setIsSubmitting(true);
    try {
      const isRelative = !API_BASE_URL.startsWith('http');
      const base = isRelative
        ? typeof window !== 'undefined'
          ? ''
          : 'http://localhost:8787'
        : API_BASE_URL;

      const res = await fetch(`${base}/api/admin/beads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          diameterMm: numDiameter,
        }),
      });

      if (res.status === 201) {
        const created = await res.json();
        setFormSuccessMessage(`成功建立珠子「${created.name}」(${created.diameterMm}mm)！前台重新整理解析後即可選用。`);
        setName('');
        setCategory('');
        setDiameterMm(8);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFormErrorMessage(errData.error || `新增失敗 (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setFormErrorMessage(`請求失敗：${err.message || '請確認 API 連線'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4 font-sans">
      {/* 頂部回到前台連結 */}
      <div className="w-full max-w-sm mb-4 flex justify-between items-center text-xs">
        <Link
          href="/"
          className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回手串工作室
        </Link>
        <span className="text-slate-400">店主後台</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center">
        {/* Header 圖標 */}
        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-xs">
          {isAuthenticated ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>

        {!isAuthenticated ? (
          // 登入畫面
          <div className="w-full flex flex-col items-center">
            <h1 className="text-lg font-bold text-slate-900 mb-1">管理員存取</h1>
            <p className="text-xs text-slate-500 mb-6 text-center">
              單一店主輕量安全保護 (Session-only)
            </p>

            <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  管理密碼
                </label>
                <input
                  type="password"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="請輸入後台存取密鑰"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              >
                {isVerifying ? '驗證授權中...' : '進入管理頁'}
              </button>
            </form>
          </div>
        ) : (
          // S6: 已授權新增珠子表單
          <div className="w-full flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h1 className="text-base font-bold text-slate-900">新增珠子樣品</h1>
                <p className="text-xs text-slate-500">S6: 基本屬性建立 (無需照片)</p>
              </div>
              <button
                onClick={handleLogout}
                title="登出管理階段"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBead} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  水晶名稱
                  <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                    (勿含尺寸，尺寸填於下方欄位)
                  </span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：藍月光石"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  分類標籤
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="例如：月光石"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  珠子直徑 (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="30"
                  value={diameterMm}
                  onChange={(e) => setDiameterMm(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="例如：8"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  required
                />
              </div>

              {formErrorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  {formErrorMessage}
                </div>
              )}

              {formSuccessMessage && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{formSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus className="w-4 h-4" />
                {isSubmitting ? '寫入資料庫中...' : '確認新增珠子'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
