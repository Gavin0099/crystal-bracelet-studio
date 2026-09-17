/**
 * Cloudflare Worker API for Crystal Bracelet Studio
 * 提供前台公開讀取 API (GET /api/beads) 與後台受保護 Mutation APIs (/api/admin/*)
 */

export interface Env {
  DB: any; // Cloudflare D1 Database Binding
  ADMIN_SECRET?: string; // 32-byte Shared Secret (Worker 環境變數，絕不寫入靜態 bundle)
  CORS_ORIGIN?: string;
}

// 預設允許的 CORS Origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://crystal-bracelet-studio.pages.dev',
];

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    (env.CORS_ORIGIN && origin === env.CORS_ORIGIN) ||
    origin.endsWith('.pages.dev');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // 僅對受信任 Origin 附加 Allow-Origin，非信任 Origin 不提供放行 Header
  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * 檢查 Admin Mutation 操作的 Bearer Token 授權
 * 規則：
 * 1. 若伺服器未設定 ADMIN_SECRET，必須 Fail-Closed 回傳 500，絕不意外放行。
 * 2. 若缺少 Authorization Header 或 Token 不匹配，回傳 401。
 */
function verifyAdminAuthorization(
  request: Request,
  env: Env
): { authorized: boolean; errorResponse?: Response; corsHeaders: HeadersInit } {
  const corsHeaders = getCorsHeaders(request, env);

  if (!env.ADMIN_SECRET || env.ADMIN_SECRET.trim() === '') {
    return {
      authorized: false,
      errorResponse: new Response(
        JSON.stringify({ error: 'Server configuration error: ADMIN_SECRET is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
      corsHeaders,
    };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';

  if (!token || token !== env.ADMIN_SECRET) {
    return {
      authorized: false,
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing admin credential' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
      corsHeaders,
    };
  }

  return { authorized: true, corsHeaders };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // 處理 CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. 公開讀取：GET /api/beads (Public - 永遠不需 credential，帶任意 token 一樣回傳公開資料)
      if (request.method === 'GET' && path === '/api/beads') {
        if (!env.DB) {
          return new Response(
            JSON.stringify({ error: 'Database binding DB is missing' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { results } = await env.DB.prepare(
          `SELECT id, name, category, diameter_mm, image_key, fallback_color FROM beads ORDER BY created_at ASC`
        ).all();

        // 轉換為前端 BeadSpec 領域模型
        const beads = (results || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          diameterMm: Number(row.diameter_mm),
          imageKey: row.image_key || null,
          fallbackColor: row.fallback_color,
        }));

        return new Response(JSON.stringify(beads), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, s-maxage=120',
          },
        });
      }

      // 2. 受保護 Mutation APIs 命名空間：/api/admin/*
      if (path.startsWith('/api/admin/')) {
        const authCheck = verifyAdminAuthorization(request, env);
        if (!authCheck.authorized) {
          return authCheck.errorResponse!;
        }

        // S5a: 授權驗證檢查端點 (供 /admin 頁面測試 Token 有效性)
        if (request.method === 'POST' && path === '/api/admin/verify') {
          return new Response(
            JSON.stringify({ ok: true, message: 'Authorized admin session valid' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // S6: 新增珠子 (Add Bead) — 伺服器端驗證並寫入 D1
        if (request.method === 'POST' && path === '/api/admin/beads') {
          if (!env.DB) {
            return new Response(
              JSON.stringify({ error: 'Database binding DB is missing' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          let body: any;
          try {
            body = await request.json();
          } catch {
            return new Response(
              JSON.stringify({ error: 'Invalid JSON payload' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const name = typeof body?.name === 'string' ? body.name.trim() : '';
          const category = typeof body?.category === 'string' ? body.category.trim() : '';
          const diameterMm = Number(body?.diameterMm);

          // 嚴格校驗：名稱與分類不可空白
          if (!name || !category) {
            return new Response(
              JSON.stringify({ error: 'Validation Error: name and category are required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 嚴格校驗：直徑必須為大於 0 之正數
          if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
            return new Response(
              JSON.stringify({ error: 'Validation Error: diameterMm must be a positive number' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 伺服器端全權生成屬性 (使用標準 crypto.randomUUID()，不信任 Client 傳送之 id、imageKey 或色票)
          const beadId = `bead-${crypto.randomUUID()}`;
          const fallbackColor = '#D1D5DB';

          await env.DB.prepare(
            `INSERT INTO beads (id, name, category, diameter_mm, image_key, fallback_color) VALUES (?, ?, ?, ?, NULL, ?)`
          )
            .bind(beadId, name, category, diameterMm, fallbackColor)
            .run();

          const createdBead = {
            id: beadId,
            name,
            category,
            diameterMm,
            imageKey: null,
            fallbackColor,
          };

          return new Response(JSON.stringify(createdBead), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // S7/S8 未來切片 Mutation：尚未實作一律回傳 501 Not Implemented (不回假 200)
        if (
          (request.method === 'PUT' && path.startsWith('/api/admin/beads/')) ||
          (request.method === 'POST' && path.includes('/image'))
        ) {
          return new Response(
            JSON.stringify({
              error: 'Not Implemented',
              message: 'This mutation endpoint is not yet implemented (scheduled for S7/S8).',
            }),
            { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 404 Not Found
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: err.message || String(err) }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
