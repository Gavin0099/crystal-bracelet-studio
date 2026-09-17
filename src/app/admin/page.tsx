'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Plus,
  CheckCircle2,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config/api';
import { BeadSpec } from '../../domain/types';
import { getBeadImageUrl } from '../../services/bead-service';

const SESSION_STORAGE_KEY = 'cbs_admin_secret';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

  // S7 珠子列表與圖片管理狀態
  const [beads, setBeads] = useState<BeadSpec[]>([]);
  const [isLoadingBeads, setIsLoadingBeads] = useState(false);
  const [uploadingBeadId, setUploadingBeadId] = useState<string | null>(null);
  const [imageActionMessage, setImageActionMessage] = useState<{
    id: string;
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // S8 修改珠子規格狀態 (直徑/名稱/分類)
  const [editingBeadId, setEditingBeadId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editDiameterMm, setEditDiameterMm] = useState<number | ''>(8);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const getApiBase = () => {
    const isRelative = !API_BASE_URL.startsWith('http');
    return isRelative
      ? typeof window !== 'undefined'
        ? ''
        : 'http://localhost:8787'
      : API_BASE_URL;
  };

  // 向 Worker /api/admin/verify 驗證 Secret
  const verifySecretOnServer = async (secret: string) => {
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const base = getApiBase();
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

  // 載入所有珠子清單 (供店主檢視與上傳照片)
  const loadBeads = useCallback(async () => {
    setIsLoadingBeads(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/beads`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setBeads(data);
        }
      }
    } catch (err) {
      console.warn('[Admin loadBeads] Failed to fetch beads:', err);
    } finally {
      setIsLoadingBeads(false);
    }
  }, []);

  // 檢查 sessionStorage 中既有的管理員憑證
  useEffect(() => {
    const storedSecret = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSecret) {
      verifySecretOnServer(storedSecret);
    }
  }, []);

  // 驗證成功後載入珠子列表
  useEffect(() => {
    if (isAuthenticated) {
      loadBeads();
    }
  }, [isAuthenticated, loadBeads]);

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
    setImageActionMessage(null);
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
      const base = getApiBase();
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
        setFormSuccessMessage(
          `成功建立珠子「${created.name}」(${created.diameterMm}mm)！可於下方清單上傳實拍照片。`
        );
        setName('');
        setCategory('');
        setDiameterMm(8);
        loadBeads(); // 即刻更新列表
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

  // S7: 上傳/替換珠子實拍圖片
  const handleImageFileChange = async (
    bead: BeadSpec,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageActionMessage(null);

    // 1. Client 端安全檢驗 (大小與格式)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageActionMessage({
        id: bead.id,
        type: 'error',
        text: '檔案格式不符：僅支援 JPEG, PNG 與 WebP 圖片',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setImageActionMessage({
        id: bead.id,
        type: 'error',
        text: `檔案過大：圖片需小於 5 MB (目前為 ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      });
      return;
    }

    const secret = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!secret) {
      setImageActionMessage({
        id: bead.id,
        type: 'error',
        text: '管理憑證已過期，請重新登入',
      });
      setIsAuthenticated(false);
      return;
    }

    setUploadingBeadId(bead.id);

    try {
      const base = getApiBase();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${base}/api/admin/beads/${bead.id}/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
        },
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        setImageActionMessage({
          id: bead.id,
          type: 'success',
          text: `成功更新「${bead.name}」實拍照片！`,
        });
        // 更新本地清單中的 imageKey
        setBeads((prev) =>
          prev.map((b) => (b.id === bead.id ? { ...b, imageKey: result.imageKey } : b))
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        setImageActionMessage({
          id: bead.id,
          type: 'error',
          text: errData.error || `圖片上傳失敗 (HTTP ${res.status})`,
        });
      }
    } catch (err: any) {
      setImageActionMessage({
        id: bead.id,
        type: 'error',
        text: `上傳異常：${err.message || '連線中斷'}`,
      });
    } finally {
      setUploadingBeadId(null);
      // 清空 input 讓重複選相同檔名亦可觸發 onChange
      e.target.value = '';
    }
  };

  // S8: 啟動編輯珠子規格
  const startEditing = (bead: BeadSpec) => {
    setEditingBeadId(bead.id);
    setEditName(bead.name);
    setEditCategory(bead.category);
    setEditDiameterMm(bead.diameterMm);
    setImageActionMessage(null);
  };

  // S8: 取消編輯
  const cancelEditing = () => {
    setEditingBeadId(null);
  };

  // S8: 儲存編輯珠子規格 (PUT /api/admin/beads/:id)
  const handleSaveEdit = async (beadId: string) => {
    const secret = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!secret) {
      setImageActionMessage({
        id: beadId,
        type: 'error',
        text: '管理憑證已過期，請重新登入',
      });
      setIsAuthenticated(false);
      return;
    }

    if (!editName.trim() || !editCategory.trim()) {
      setImageActionMessage({
        id: beadId,
        type: 'error',
        text: '名稱與分類不可空白',
      });
      return;
    }

    const numDia = Number(editDiameterMm);
    if (!Number.isFinite(numDia) || numDia <= 0) {
      setImageActionMessage({
        id: beadId,
        type: 'error',
        text: '直徑必須大於 0 mm',
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/beads/${beadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim(),
          diameterMm: numDia,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBeads((prev) => prev.map((b) => (b.id === beadId ? updated : b)));
        setImageActionMessage({
          id: beadId,
          type: 'success',
          text: `成功更新「${updated.name}」規格（${updated.diameterMm} mm）！`,
        });
        setEditingBeadId(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setImageActionMessage({
          id: beadId,
          type: 'error',
          text: errData.error || `更新失敗 (HTTP ${res.status})`,
        });
      }
    } catch (err: any) {
      setImageActionMessage({
        id: beadId,
        type: 'error',
        text: `更新請求失敗：${err.message || '連線中斷'}`,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (

    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-start p-4 font-sans">
      {/* 頂部回到前台連結 */}
      <div className="w-full max-w-lg mb-4 flex justify-between items-center text-xs">
        <Link
          href="/"
          className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回手串工作室
        </Link>
        <span className="text-slate-400">店主管理後台</span>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center">
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
          // 已授權管理介面 (S6 新增 + S7 圖片上傳/替換)
          <div className="w-full flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h1 className="text-base font-bold text-slate-900">水晶珠管理工作台</h1>
                <p className="text-xs text-slate-500">S6: 屬性建立 ｜ S7: 實拍圖片管理</p>
              </div>
              <button
                onClick={handleLogout}
                title="登出管理階段"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* 區塊 1: 新增珠子樣品表單 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 mb-6">
              <h2 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                新增珠子樣品 (無需照片即可建立)
              </h2>

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
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      分類標籤
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="例如：月光石"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      直徑 (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="30"
                      value={diameterMm}
                      onChange={(e) =>
                        setDiameterMm(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="例如：8"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                    />
                  </div>
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
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 mt-1"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? '寫入資料庫中...' : '確認新增珠子'}
                </button>
              </form>
            </div>

            {/* 區塊 2: 既有珠子清單與圖片管理 (S7 核心) */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  既有珠子實拍圖片管理 ({beads.length} 款)
                </h2>
                <button
                  onClick={loadBeads}
                  disabled={isLoadingBeads}
                  title="重新整理清單"
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBeads ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {isLoadingBeads && beads.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">載入珠子目錄中...</div>
              ) : beads.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  尚未建立任何珠子資料，請先從上方表單新增。
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {beads.map((bead) => {
                    const imageUrl = getBeadImageUrl(bead.imageKey);
                    const isUploading = uploadingBeadId === bead.id;
                    const isEditing = editingBeadId === bead.id;
                    const actionMsg =
                      imageActionMessage?.id === bead.id ? imageActionMessage : null;

                    return (

                      <div
                        key={bead.id}
                        className="bg-white border border-slate-200/90 rounded-xl p-3 flex flex-col gap-2 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        {isEditing ? (
                          // 行內編輯模式 (S8)
                          <div className="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-lg border border-indigo-100">
                            <div className="text-[11px] font-semibold text-indigo-700 flex items-center justify-between">
                              <span>編輯珠子規格</span>
                              <span className="text-[10px] text-slate-400">ID: {bead.id}</span>
                            </div>

                            <div className="grid grid-cols-1 gap-1.5">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                  名稱
                                </label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    分類
                                  </label>
                                  <input
                                    type="text"
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    直徑 (mm)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    max="30"
                                    value={editDiameterMm}
                                    onChange={(e) =>
                                      setEditDiameterMm(
                                        e.target.value === '' ? '' : Number(e.target.value)
                                      )
                                    }
                                    className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 mt-1 pt-1 border-t border-slate-200/60">
                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={isSavingEdit}
                                className="px-2.5 py-1 rounded-md text-xs text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> 取消
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(bead.id)}
                                disabled={isSavingEdit}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-60"
                              >
                                {isSavingEdit ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    儲存中...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3 h-3" />
                                    儲存修改
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          // 一般展示模式 (可上傳照片或切換編輯)
                          <div className="flex items-center justify-between gap-3">
                            {/* 縮圖與基本資料 */}
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full shadow-inner overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center bg-slate-100 relative">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={bead.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center text-[10px] text-white font-bold"
                                    style={{ backgroundColor: bead.fallbackColor || '#8a62a7' }}
                                  >
                                    {bead.diameterMm}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-800">
                                  {bead.name}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                  <span>{bead.category}</span>
                                  <span>•</span>
                                  <span className="font-semibold text-indigo-600">
                                    {bead.diameterMm} mm
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 操作按鈕群 (編輯規格 + 上傳/替換照片) */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditing(bead)}
                                title="修改尺寸、名稱或分類"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>編輯</span>
                              </button>

                              <label
                                className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors ${
                                  isUploading
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : imageUrl
                                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {isUploading ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>上傳中</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>{imageUrl ? '換圖' : '照片'}</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={isUploading}
                                  onChange={(e) => handleImageFileChange(bead, e)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        )}


                        {/* 上傳狀態提示訊息 */}
                        {actionMsg && (
                          <div
                            className={`text-[11px] px-2.5 py-1 rounded-md ${
                              actionMsg.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {actionMsg.text}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
