# PLAN.md
<!-- governance-baseline: overridable -->
<!-- baseline_version: 1.0.0 -->

> **最後更新**: 2026-09-17
> **Owner**: Gavin
> **Freshness**: Sprint (7d)

---

# Crystal Bracelet Studio — 正式版增量實作計畫 (S0 ~ S10)

> **專案定位**：輕量高反饋的晶選手串設計室（Web / Mobile-First）。
> **架構定位**：前端靜態部署於 Cloudflare Pages，後端與商品圖片由 Cloudflare Workers + D1 + R2 提供。

---

## 1. 需求邊界凍結 (Scope Freeze)

- **前台**：從 **0 顆** 開始自行串珠，不具備任何預估價格功能。
- **後台**：單一商品＝單一尺寸，僅提供 **新增珠子、上傳照片、修改尺寸** 三大核心能力。
- **排除範疇**：會員登入、購物車、訂單系統、拖曳重排、Undo/Redo、AI 推薦均不納入。

---

## 2. 切片進度 (Vertical Slices Status)

- [x] **S0｜Scope Freeze**：更新 PLAN、contract、AGENTS 護欄，鎖定正式版收斂規格。
- [x] **S1｜Empty Bracelet**：開頁手串預設 0 顆、總長 0mm，Reset 亦清空回 0 顆。
- [x] **S2｜Remove Pricing**：徹底自 Domain Model、UI、測試中移除價格與幣別。
- [x] **S3｜Catalog Data Model**：固定扁平商品結構 `id, name, category, diameterMm, imageUrl, fallbackColor`。
- [ ] **S4｜D1 Catalog Storage**：商品資料改由 Cloudflare D1 (Worker API `GET /api/beads`) 讀取。
- [ ] **S5｜Admin Baseline**：建立 `/admin` 管理介面，配置基礎 Admin Secret 存取保護。
- [ ] **S6｜Add Bead**：後台新增珠子（名稱、分類、尺寸），前台即時同步。
- [ ] **S7｜Image Upload**：支援手機拍照/選圖上傳至 Cloudflare R2，前台 Catalog 即時展示實拍圖。
- [ ] **S8｜Edit Size**：後台修改尺寸後，前台手串幾何計算與長度統計同步採用新直徑。
- [ ] **S9｜Integration & Validation**：全鏈路端到端驗證（新增 → 上傳圖片 → 改尺寸 → 前台串珠）。
- [ ] **S10｜Release**：真機 iPhone Safari / Chrome 測試、生產部署、資料庫備份與交付。

---

## 3. 治理與品質護欄 (Governance & Quality Guardrails)

- **Claim Ceiling**：手串總直徑僅供參考，不宣稱「保證合身」。
- **Forbidden Scope**：嚴禁私自引入會員、訂單或第三方付費依賴；嚴禁在 Domain 引入 `px` 像素。
- **Validator**：透過 `validators/bracelet_geometry_validator.py` 自動稽核 Domain 純粹性與測試完整性。
