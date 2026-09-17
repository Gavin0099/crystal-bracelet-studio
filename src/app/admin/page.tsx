'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, LogOut, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config/api';

const SESSION_STORAGE_KEY = 'cbs_admin_secret';

export default function AdminPage() {
  const [secretInput, setSecretInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        <span className="text-slate-400">S5 管理安全基線</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center">
        {/* Header 圖標 */}
        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-xs">
          {isAuthenticated ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>

        {!isAuthenticated ? (
          // S5b 登入畫面
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
          // S5b 驗證成功後之管理頁基線 (嚴格排除 S6 新增/上傳/編輯功能)
          <div className="w-full flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              已授權管理員階段
            </div>

            <h1 className="text-lg font-bold text-slate-900 mb-1">珠子管理</h1>
            <p className="text-xs text-slate-500 mb-6">後台受保護控制台基線</p>

            {/* S5 邊界展示卡 */}
            <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 mb-6 text-slate-600 text-xs flex flex-col items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <p className="font-semibold text-slate-700">目前尚未提供新增功能</p>
              <p className="text-slate-500 text-[11px]">S6 將開放新增珠子與基礎屬性建立</p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              登出管理階段 (清除 Session)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
