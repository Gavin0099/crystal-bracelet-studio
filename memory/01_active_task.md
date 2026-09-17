# Active Task

## Current Status

- Adopted AI Governance Framework baseline (submodule consumer at `additional/ai-governance-framework`).
- Crystal Bracelet Studio Concept v0.1 deployed to Cloudflare Pages (https://crystal-bracelet-studio.pages.dev) on locked `production` branch.
- S0~S8 Core functionality complete:
  - Zero-price model, 0-bead start, Add/Remove/Replace, Mixed-Size Geometry, Length Summary.
  - D1/R2 Admin Catalog, Image Upload/Replace with Compensation, Edit Bead Specifications.
- S9 Full Integration Gate:
  - Staging Cloudflare Backend (Worker + D1 + R2) Live E2E passed.
  - Cloudflare Pages Preview (`staging.crystal-bracelet-studio.pages.dev`) deployed with `NEXT_PUBLIC_API_BASE_URL` baked in.
  - Mobile Safari & Admin integration verified (Admin login, bead add, and image upload operational).
  - Staging secret rotated to user-accessible credential (`StudioAdmin2026`).
  - Status: S9 CLOSED.

## Next Steps

- S10 Production Release & Client Handoff (待正式簽約後執行 - Pending Contract Signing):
  1. 商業邊界：尚未簽約，Production 資源建置與正式網址發布暫緩執行；客戶端持續鎖定 Concept v0.1 (`5175320`)。
  2. 簽約後執行 6 步發布流程：
     - 建立獨立 Production D1/R2、套用 migration/seed。
     - 伺服器端產生全新 Production ADMIN_SECRET（不寫入任何日誌/代碼）。
     - 綁定 Worker 並將 main 合併至 production 分支部署至 Pages。
     - iPhone Safari 跑最後 9 步 smoke test。
     - 交付 1 頁操作手冊、備份還原腳本，確認帳號責任邊界，啟動 30 天保固。
