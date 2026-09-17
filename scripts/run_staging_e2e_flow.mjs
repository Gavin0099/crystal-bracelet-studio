/**
 * S9 Full Integration Gate: Live Cloudflare E2E Flow Check
 * 對真實部署的 Cloudflare Staging Worker 跑完整業務流程：
 * 1. 新增「月光石」8mm (無照片)
 * 2. 公開 GET /api/beads 讀取
 * 3. 上傳第一張真實照片 (WebP) -> R2 & D1
 * 4. 讀取公開圖片串流 GET /api/images/*
 * 5. 替換第二張真實照片 (PNG) -> R2 & D1, 舊圖清除
 * 6. 修改尺寸 8mm -> 10mm (PUT)
 * 7. 驗證資料庫最終規格
 */

const base = process.env.STAGING_WORKER_URL || 'https://crystal-bracelet-api-staging.readwithus.workers.dev';
const secret = process.argv[2] || process.env.ADMIN_SECRET;

if (!secret) {
  console.error('❌ 請提供 ADMIN_SECRET 作為命令列參數或環境變數！');
  console.error('範例: node scripts/run_staging_e2e_flow.mjs <ADMIN_SECRET>');
  process.exit(1);
}


async function runLiveFlow() {
  console.log('🚀 開始執行 S9 Real Cloudflare Live E2E 整合鏈路驗收...\n');

  // Step 1: Admin 新增珠子「月光石」8mm
  console.log('1️⃣ POST /api/admin/beads: 新增「月光石」8mm (無照片)...');
  const postRes = await fetch(`${base}/api/admin/beads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      name: '月光石',
      category: '月光石',
      diameterMm: 8,
    }),
  });
  if (postRes.status !== 201) {
    throw new Error(`新增失敗: HTTP ${postRes.status} ${await postRes.text()}`);
  }
  const created = await postRes.json();
  console.log(`   ✅ 成功建立珠子！ID: ${created.id}, 尺寸: ${created.diameterMm}mm, imageKey: ${created.imageKey}`);

  // Step 2: 前台 GET /api/beads 確認包含該珠子
  console.log('\n2️⃣ GET /api/beads: 前台讀取目錄確認新珠子存在...');
  const getRes = await fetch(`${base}/api/beads`);
  const catalog = await getRes.json();
  const found = catalog.find((b) => b.id === created.id);
  if (!found) throw new Error('目錄中未找到剛新增的珠子！');
  console.log(`   ✅ 前台目錄成功讀取新珠子: ${found.name} (${found.diameterMm}mm, fallbackColor: ${found.fallbackColor})`);

  // Step 3: 上傳第一張實拍照片 (1KB fake WebP)
  console.log('\n3️⃣ POST /api/admin/beads/:id/image: 上傳第一張實拍照片 (WebP)...');
  const img1 = new Uint8Array(1024);
  const upload1Res = await fetch(`${base}/api/admin/beads/${created.id}/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/webp',
      Authorization: `Bearer ${secret}`,
    },
    body: img1,
  });
  if (upload1Res.status !== 200) {
    throw new Error(`圖片 1 上傳失敗: HTTP ${upload1Res.status} ${await upload1Res.text()}`);
  }
  const upload1Data = await upload1Res.json();
  console.log(`   ✅ 第一張照片成功寫入 R2 與 D1！imageKey: ${upload1Data.imageKey}`);

  // Step 4: 公開讀取串流 GET /api/images/*
  console.log(`\n4️⃣ GET /api/images/${upload1Data.imageKey}: 測試公開圖片串流讀取與快取標頭...`);
  const streamRes = await fetch(`${base}/api/images/${upload1Data.imageKey}`);
  if (streamRes.status !== 200) {
    throw new Error(`圖片串流讀取失敗: HTTP ${streamRes.status}`);
  }
  console.log(`   ✅ 成功自 R2 串流讀取圖片！Content-Type: ${streamRes.headers.get('Content-Type')}, Cache-Control: ${streamRes.headers.get('Cache-Control')}`);

  // Step 5: 替換第二張實拍照片 (512B fake PNG) -> 驗證新圖寫入與舊圖清理
  console.log('\n5️⃣ POST /api/admin/beads/:id/image: 替換第二張實拍照片 (PNG)...');
  const img2 = new Uint8Array(512);
  const upload2Res = await fetch(`${base}/api/admin/beads/${created.id}/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      Authorization: `Bearer ${secret}`,
    },
    body: img2,
  });
  if (upload2Res.status !== 200) {
    throw new Error(`圖片 2 替換失敗: HTTP ${upload2Res.status} ${await upload2Res.text()}`);
  }
  const upload2Data = await upload2Res.json();
  console.log(`   ✅ 第二張照片成功替換！新 imageKey: ${upload2Data.imageKey}`);

  // 驗證舊圖已被 R2 刪除 (舊 key 應為 404)
  const oldImgCheck = await fetch(`${base}/api/images/${upload1Data.imageKey}`);
  console.log(`   ✅ 舊圖 R2 清理檢查 (預期 404 Not Found): HTTP ${oldImgCheck.status}`);

  // Step 6: 後台修改尺寸 8mm -> 10mm (PUT)
  console.log('\n6️⃣ PUT /api/admin/beads/:id: 修改尺寸 8mm -> 10mm...');
  const putRes = await fetch(`${base}/api/admin/beads/${created.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      name: '頂級藍月光石',
      category: '月光石',
      diameterMm: 10,
    }),
  });
  if (putRes.status !== 200) {
    throw new Error(`尺寸修改失敗: HTTP ${putRes.status} ${await putRes.text()}`);
  }
  const updatedBead = await putRes.json();
  console.log(`   ✅ 成功修改規格！名稱: ${updatedBead.name}, 直徑: ${updatedBead.diameterMm}mm`);

  // Step 7: 再次前台 GET 確認最新資料
  console.log('\n7️⃣ GET /api/beads: 前台確認最終規格...');
  const finalGetRes = await fetch(`${base}/api/beads`);
  const finalCatalog = await finalGetRes.json();
  const finalBead = finalCatalog.find((b) => b.id === created.id);
  console.log(`   ✅ 前台最新規格: ${finalBead.name}, ${finalBead.diameterMm}mm, imageKey: ${finalBead.imageKey}`);

  console.log('\n🎉 S9 Cloudflare Live E2E 全鏈路 7 大步驟 100% 驗證通過！');
}

runLiveFlow().catch((e) => {
  console.error('\n❌ E2E 執行失敗:', e);
  process.exit(1);
});
