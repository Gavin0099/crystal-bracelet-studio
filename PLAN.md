# PLAN.md
<!-- governance-baseline: overridable -->
<!-- baseline_version: 1.0.0 -->

> **最後更新**: 2026-09-17
> **Owner**: Gavin
> **Freshness**: Sprint (7d)

---

# Crystal Bracelet Studio — Engineering & Product Plan

## 1. 當前進度與階段 (Current Phase)

- **當前階段**：`Concept v0.1 (S0 ~ S6)`
- **狀態**：Engineering Gate PASS，已部署至 Cloudflare Pages，處於 Customer Gate 1B 驗收階段。

### Vertical Slices 狀態
- [x] **S0 Baseline**：Next.js + TypeScript + Tailwind + Vitest + CI Build 就緒。
- [x] **S1 Static View**：手機畫布置中呈現正圓形穿線手串。
- [x] **S2 Catalog View**：底部水晶分類與商品目錄（紫水晶、粉晶、白水晶、黑曜石、髮晶、海藍寶）。
- [x] **S3 Add Bead**：點擊水晶卡片即時加入手串並重新運算極座標角度。
- [x] **S4 Remove / Replace**：點選珠子彈出浮動工具列執行移除或目錄替換。
- [x] **S5 Mixed Geometry**：8mm / 10mm / 12mm 混排比例自適應，大珠佔較大弧長。
- [x] **S6 Length Info**：尺寸參考儀表板（珠數、總直徑、目標手圍、尚差長度、預估總價）。

---

## 2. 後續階段規劃 (Future Roadmap)

### Gate 1 驗收通過後 (Phase 1 擴充)
- [ ] **S7 Drag / Reorder**：觸控拖曳排序。
- [ ] **S8 Edit History**：Undo / Redo 歷史還原。
- [ ] **S9 Local Persistence**：localStorage 設計暫存。
- [ ] **S10 Summary & Export**：產出分享圖與訂單摘要。

### Phase 2：店主管理與資料庫 (Confirmed Requirement)
- [ ] **Catalog Admin**：店主後台自行新增珠子規格、定價、尺寸與說明。
- [ ] **Cloudflare R2**：水晶商品照片上傳儲存。
- [ ] **Cloudflare D1**：商品與設計持久化儲存（Serverless SQLite）。
- [ ] **Cloudflare Workers**：REST API 處理。

### Phase 3：AI 輔助推薦 (Governed AI Boundary)
- [ ] **Natural Language Intent**：風格與色系需求分析。
- [ ] **Rule-bounded AI Generator**：AI 僅產生設計意圖與珠種建議，真實幾何與價格由 Deterministic Engine 計算。

---

## 3. 治理與邊界契約 (Governance & Scope Boundary)

- **Claim Ceiling**：手圍尺寸計算僅作為參考總直徑，不作實體配戴絕對合身之宣稱。
- **Forbidden Scope**：Phase 1 嚴格禁止私自引進全套後端資料庫、會員登入系統或未授權的付款金流。
- **Verification Evidence**：每一次發布均須提供 Invariant 單元測試（`layout.test.ts`, `bracelet-interaction.test.ts`）與靜態 build 通過證據。
