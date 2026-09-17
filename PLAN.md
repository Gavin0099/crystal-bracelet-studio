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
> **環境隔離策略 (Dual-Track Staging)**：
> - **Production (`main`)**：維持客戶既有 Concept，交付前絕不動用，防止資料污染或提早洩漏。
> - **Staging (`staging`)**：透過 Pages Preview + Worker `env.staging`（`crystal-bracelet-api-staging`、`crystal-bracelet-db-staging`、`crystal-bracelet-images-staging`）進行完整真實雲端驗收。注意：Preview URL 預設 public by default，不將 URL 隱蔽視為認證機制。


---

## 1. 需求邊界凍結 (Scope Freeze)

- **前台**：從 **0 顆** 開始自行串珠，不具備任何預估價格功能。
- **後台**：單一商品＝單一尺寸（扁平模型），僅提供 **新增珠子、上傳/替換照片、修改尺寸** 三大核心能力。
- **邊界明定**：
  - v1 支援修改尺寸與替換圖片；若名稱/分類修改一併納入編輯表單則維持極簡（成本低）；**不提供刪除商品功能**。
  - **同步語意**：新增／修改成功後，前台於下一次載入或重新整理 (refresh / refetch) 時取得最新資料，**不宣稱或實作任何 realtime / WebSocket / SSE / polling 機制**。
- **排除範疇**：會員系統、購物車、訂單系統、拖曳重排、Undo/Redo、AI 推薦均不納入。

---

## 2. 切片進度 (Vertical Slices Status)

- [x] **S0｜Scope Freeze**：更新 PLAN、contract、AGENTS 護欄，鎖定正式版收斂規格。
- [x] **S1｜Empty Bracelet**：開頁手串預設 0 顆、總長 0mm，Reset 亦清空回 0 顆。
- [x] **S2｜Remove Pricing**：徹底自 Domain Model、UI、測試中移除價格與幣別。
- [x] **S3｜Catalog Data Model**：固定扁平商品結構 `id, name, category, diameterMm, imageKey?, fallbackColor`（採用相對物件鍵 `imageKey`，解耦 R2 URL 與 DB；`fallbackColor` 採系統預設 `#D1D5DB`，後台新增珠子無需填寫色票）。
- [x] **S4｜D1 Catalog Storage & Migration**：
  - 建立 versioned migration `migrations/0001_create_beads.sql`，包含 `CHECK (diameter_mm > 0)` 與 `updated_at`。
  - 將既有 mock beads 匯入 (seed) 至 D1。
  - Cloudflare Worker 綁定 D1 (`env.DB`) 並提供公開查詢 API `GET /api/beads`。
  - 固定 `API_BASE_URL`、CORS 設定以及 local / production config。
  - 前台改讀 API，且在 **Production 採 Fail-Closed 原則**（API 失敗明確顯示「暫時無法載入」，絕不退回舊 mock 造成幽靈資料）。
- [x] **S5｜Admin Baseline & Worker Shared-Secret Protection**：
  - 建立 `/admin` 管理頁面基線（前端採用 sessionStorage 作為單一店主防護之輕量 trade-off）。
  - **核心防線**：Worker 端部署 Shared Admin Secret（至少 32-byte 隨機密鑰，僅存於 Worker Secret，絕不寫入 repo，不用 `NEXT_PUBLIC_*`）。
  - 鑑權僅保護 mutation APIs (`POST /api/admin/beads`, `PUT /api/admin/beads/:id`, `POST /api/admin/beads/:id/image`)；Public GET 永遠不接受 admin credential。
- [x] **S6｜Add Bead (無照片亦可建立)**：
  - 後台新增珠子（名稱、分類、尺寸），寫入 D1；`image_key` 預設為 NULL，由系統自動提供預設 fallbackColor。
  - 前台重新載入時即可呈現新珠子。
- [x] **S7｜R2 Upload + Replace + 跨資源補償清理**：
  - 每個珠子可上傳一張照片，並支援重新上傳取代。
  - 補償清理流程：
    1. 產生新 key `B`，上傳至 R2 (`R2.put(B)`)。
    2. 若失敗直接回傳 500；若成功則更新 D1 `image_key = B`。
    3. 若 D1 更新失敗，觸發補償清理刪除新圖 `R2.delete(B)`，不改動舊圖，回傳 500。
    4. 若 D1 更新成功，刪除舊圖 `R2.delete(A)`（若刪舊圖失敗不影響成功回應，記錄 warning）。
  - 規則：JPEG / PNG / WebP ≤ 5 MB，前端輕量檢核，Worker 驗證 MIME 與大小，伺服器隨機生成 key。
  - 前台 Catalog 與手串畫布支援顯示實拍圖（無圖時退回 fallback）。

- [x] **S8｜Edit Bead (修改尺寸/名稱/分類)**：
  - 後台修改直徑 (mm) 及名稱/分類，更新 D1 (`PUT /api/admin/beads/:id`)。
  - **核心不變量 (Invariant)**：修改商品規格只影響之後重新載入／重新加入手串的珠子；前台當下手串既有 state 不做背景同步與 reconciliation。
  - 前台重新整理 (refresh / refetch) 取得最新資料後，新加入手串之珠子由極座標幾何計算與長度統計同步採用新直徑。


- [ ] **S9｜Full Integration Gate (真實 Cloudflare 生產環境 14 步驗收門檻)**：
  - [ ] 1. Production Worker 部署成功。
  - [ ] 2. Production D1 migration 套用成功 (`migrations/0001_create_beads.sql`)。
  - [ ] 3. Seed catalog 成功 (`db/seed.sql`)。
  - [ ] 4. Production R2 bucket binding 正常 (`BEAD_IMAGES`)。
  - [ ] 5. `ADMIN_SECRET` 以 Worker secret 設定，絕不存在 repo。
  - [ ] 6. Pages 的正式 API base URL 指向 production Worker。
  - [ ] 7. 公開前台可正常讀取 `GET /api/beads`。
  - [ ] 8. `/admin` 用錯 secret → 401；正確 secret → 成功進入。
  - [ ] 9. 新增「月光石 / 8mm / 無照片」→ D1 成功建立。
  - [ ] 10. 前台 refresh → 月光石 fallback 出現，加入後總長 +8mm。
  - [ ] 11. 用**真實照片**上傳 → R2 有 object、D1 有 `imageKey`、前台 refresh 顯示實拍圖。
  - [ ] 12. 換第二張照片 → 新圖顯示，舊 R2 object 正常清理（或產生 warning 但不影響成功）。
  - [ ] 13. Admin 將 8mm → 10mm → 前台 refresh → 新加入珠子以 10mm 進幾何計算；已存在於手串內的舊珠子維持原有規格不被背景改寫。
  - [ ] 14. Reset → 手串清空回歸 0 顆 / 0mm。全部 PASS。
  - **Production Sanity Checks (環境完整性稽核)**：
    - 非允許 origin 沒有 permissive CORS (`Access-Control-Allow-Origin`)。
    - Production API 異常時前台明確呈現 error，絕不退回舊 mock。
    - > 5MB 圖片確實被伺服器拒絕 (HTTP 400)。
    - SVG 或非合法圖片格式確實被拒絕 (HTTP 415)。
    - 圖片網址公開讀取正常 (`GET /api/images/*` 串流快取)。
    - Admin Secret 絕無輸出至 browser bundle 或 log。
- [ ] **S10｜Production Release & Client Handoff**：
  - iPhone Safari / Android Chrome 真機驗收操作。
  - Production URL 固定與 DNS 設定確認。
  - D1 定期備份腳本與還原指引。
  - Cloudflare 帳號與資源歸屬移轉（建議客戶自持帳號，避免維運負擔）。
  - 單頁簡易店主操作手冊、驗收確認與 30 天保固啟動。


---

## 3. 測試與驗證防護網 (Verification Plan)

不依賴單一 happy path，分層建立：
1. **Domain Model Invariants**：極座標幾何、角度累加、長度統計（Vitest 13 項測試全綠，零 px 污染）。
2. **Worker API Security & Validation Tests**：
   - 未授權 POST/PUT → 401 Unauthorized
   - 合法 GET → 200 (回傳結構符合 BeadSpec)
   - 非法直徑 (invalid diameter, 如 ≤0 或非數字) → 400
   - 檔案過大 (>5MB) 或格式不符 (wrong MIME) → 400/415 reject
   - D1 / R2 例外處理 → 不回傳假 success，不殘留孤立 `imageKey`。
3. **新增 4 大關鍵防禦測試 (Critical Cases)**：
   - `Production GET API failure` → 前台明確顯示載入失敗，絕不退回舊 mock。
   - `R2 success → D1 failure` → 刪除新 R2 object，舊 imageKey 保持有效。
   - `Replace success` → 新 imageKey 生效，舊 R2 object 清除。
   - `前台已開 + 後台改商品` → 不宣稱 realtime；前台 refresh/refetch 後才看到新版。
4. **Governance Drift**：執行 `validators/bracelet_geometry_validator.py` 與 `governance_drift_checker.py`。

---

## 4. 治理與品質護欄 (Governance & Quality Guardrails)

- **Claim Ceiling**：手串總直徑僅供參考，不宣稱「保證合身」；不宣稱「即時同步」。
- **Forbidden Scope**：嚴禁私自引入會員、訂單或第三方付費依賴；嚴禁在 Domain 引入 `px` 像素；禁止將 Admin Secret 寫入前端靜態 bundle。
- **Fail-Closed 原則**：Production 環境 API 異常時嚴禁偷偷展示 mock 資料。
- **Validator**：透過 `validators/bracelet_geometry_validator.py` 自動稽核 Domain 純粹性與測試完整性。
