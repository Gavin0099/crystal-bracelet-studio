/**
 * S9 Production Sanity Check Script
 * 用於對已部署至 Cloudflare 的真實 Production Worker 進行安全與契約稽核
 * 
 * 使用方式：
 *   node scripts/production_sanity_check.mjs <WORKER_URL> [ADMIN_SECRET]
 * 例如：
 *   node scripts/production_sanity_check.mjs https://crystal-bracelet-api.your-subdomain.workers.dev my_secret_123
 */

const targetUrl = process.argv[2];
const adminSecret = process.argv[3];

if (!targetUrl) {
  console.error('❌ 請提供目標 Worker URL！');
  console.error('範例: node scripts/production_sanity_check.mjs https://crystal-bracelet-api.example.workers.dev [ADMIN_SECRET]');
  process.exit(1);
}

const base = targetUrl.replace(/\/+$/, '');

async function runSanityChecks() {
  console.log(`\n🔍 開始對目標環境進行 S9 Production Sanity 稽核: ${base}\n`);
  let passCount = 0;
  let totalCount = 0;

  function assert(name, condition, detail = '') {
    totalCount++;
    if (condition) {
      console.log(`  ✅ PASS: ${name} ${detail ? `(${detail})` : ''}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    // 1. 公開端點 GET /api/beads
    const beadsRes = await fetch(`${base}/api/beads`);
    assert(
      '公開端點 GET /api/beads 回傳 200',
      beadsRes.status === 200,
      `HTTP ${beadsRes.status}`
    );
    const beadsData = await beadsRes.json();
    assert(
      'GET /api/beads 回傳資料為陣列',
      Array.isArray(beadsData),
      `取得 ${beadsData.length || 0} 款珠子`
    );

    // 2. 嚴格 CORS 防護：未授權 Origin 絕不回傳 Allow-Origin
    const evilCorsRes = await fetch(`${base}/api/beads`, {
      headers: { Origin: 'https://malicious-tracker.com' },
    });
    const allowOrigin = evilCorsRes.headers.get('Access-Control-Allow-Origin');
    assert(
      '嚴格 CORS 防護 (非允許網域不給予 Allow-Origin)',
      allowOrigin !== 'https://malicious-tracker.com' && allowOrigin !== '*',
      `Allow-Origin: ${allowOrigin || '無 (正確阻擋)'}`
    );

    // 3. 管理端點未授權存取阻擋 (401 Unauthorized)
    const unauthorizedRes = await fetch(`${base}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert(
      '管理端點無 Token 存取採 Fail-Closed 阻擋',
      unauthorizedRes.status === 401,
      `HTTP ${unauthorizedRes.status}`
    );

    const wrongTokenRes = await fetch(`${base}/api/admin/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer definitely_wrong_secret_123',
      },
    });
    assert(
      '管理端點錯誤 Token 存取採 Fail-Closed 阻擋',
      wrongTokenRes.status === 401,
      `HTTP ${wrongTokenRes.status}`
    );

    // 4. 若提供正確 ADMIN_SECRET，檢驗授權通過與安全限制
    if (adminSecret) {
      const authRes = await fetch(`${base}/api/admin/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSecret}`,
        },
      });
      assert(
        '正確 ADMIN_SECRET 驗證通過',
        authRes.status === 200,
        `HTTP ${authRes.status}`
      );

      // 非法 MIME 拒絕 (415)
      const fakeId = beadsData[0]?.id || 'fake-id';
      const wrongMimeRes = await fetch(`${base}/api/admin/beads/${fakeId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `Bearer ${adminSecret}`,
        },
        body: 'this is plain text not image',
      });
      assert(
        '非法 MIME 格式 (text/plain) 拒絕 (415 Unsupported Media Type)',
        wrongMimeRes.status === 415,
        `HTTP ${wrongMimeRes.status}`
      );

      // 超過 5MB 拒絕 (400)
      const oversized = new Uint8Array(5 * 1024 * 1024 + 10);
      const oversizeRes = await fetch(`${base}/api/admin/beads/${fakeId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          Authorization: `Bearer ${adminSecret}`,
        },
        body: oversized,
      });
      assert(
        '超過 5MB 檔案拒絕 (400 Payload size invalid)',
        oversizeRes.status === 400,
        `HTTP ${oversizeRes.status}`
      );

      // 未實作端點 DELETE 回傳 501 (Scope Freeze: 不提供刪除)
      const deleteRes = await fetch(`${base}/api/admin/beads/${fakeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminSecret}`,
        },
      });
      assert(
        'Scope Freeze 未支援之 mutation (DELETE) 回傳 501 Not Implemented',
        deleteRes.status === 501,
        `HTTP ${deleteRes.status}`
      );
    } else {
      console.log('  ℹ️ 未提供 ADMIN_SECRET，略過需授權之 Mutation 安全邊界檢查');
    }

    console.log(`\n📊 稽核完成：${passCount} / ${totalCount} 項檢查通過！\n`);
    if (passCount === totalCount) {
      console.log('🎉 Production Sanity 檢查全數通過，環境具備生產健康度！');
    } else {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ 連線或執行過程發生異常:', err);
    process.exitCode = 1;
  }
}

runSanityChecks();
