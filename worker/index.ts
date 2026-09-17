/**
 * Cloudflare Worker API for Crystal Bracelet Studio
 * 提供前台公開讀取 API (GET /api/beads, GET /api/images/*)
 * 與後台受保護 Mutation APIs (/api/admin/*)
 */

export interface Env {
  DB: any; // Cloudflare D1 Database Binding
  BEAD_IMAGES?: any; // Cloudflare R2 Bucket Binding
  ADMIN_SECRET?: string; // 32-byte Shared Secret (Worker 環境變數，絕不寫入靜態 bundle)
  CORS_ORIGIN?: string;
}

// 預設允許的 CORS Origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://crystal-bracelet-studio.pages.dev',
];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB 限制
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * 檢查 Admin Mutation 操作的 Bearer Token 授權 (Fail-Closed 原則)
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
      // 1. 公開讀取：GET /api/beads (Public)
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

      // 2. 公開讀取：GET /api/images/* (Cloudflare R2 串流交付)
      if (request.method === 'GET' && path.startsWith('/api/images/')) {
        if (!env.BEAD_IMAGES) {
          return new Response(
            JSON.stringify({ error: 'Storage binding BEAD_IMAGES is missing' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const imageKey = path.replace(/^\/api\/images\//, '');
        if (!imageKey) {
          return new Response(JSON.stringify({ error: 'Image key is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const object = await env.BEAD_IMAGES.get(imageKey);
        if (!object) {
          return new Response(JSON.stringify({ error: 'Image not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(object.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': object.httpMetadata?.contentType || 'image/webp',
            'Cache-Control': 'public, max-age=86400, immutable',
          },
        });
      }

      // 3. 受保護 Mutation APIs 命名空間：/api/admin/*
      if (path.startsWith('/api/admin/')) {
        const authCheck = verifyAdminAuthorization(request, env);
        if (!authCheck.authorized) {
          return authCheck.errorResponse!;
        }

        // S5a: 授權驗證檢查端點
        if (request.method === 'POST' && path === '/api/admin/verify') {
          return new Response(
            JSON.stringify({ ok: true, message: 'Authorized admin session valid' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // S6: 新增珠子 (POST /api/admin/beads)
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

          if (!name || !category) {
            return new Response(
              JSON.stringify({ error: 'Validation Error: name and category are required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
            return new Response(
              JSON.stringify({ error: 'Validation Error: diameterMm must be a positive number' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

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

        // S7: 上傳/替換珠子實拍圖片 (POST /api/admin/beads/:id/image)
        const imageMatch = path.match(/^\/api\/admin\/beads\/([^/]+)\/image$/);
        if (request.method === 'POST' && imageMatch) {
          const beadId = imageMatch[1];

          if (!env.DB) {
            return new Response(
              JSON.stringify({ error: 'Database binding DB is missing' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!env.BEAD_IMAGES) {
            return new Response(
              JSON.stringify({ error: 'Storage binding BEAD_IMAGES is missing' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 1. 確認該珠子存在於 D1 中
          const existingBead = await env.DB.prepare(
            `SELECT id, image_key FROM beads WHERE id = ?`
          )
            .bind(beadId)
            .first();

          if (!existingBead) {
            return new Response(JSON.stringify({ error: 'Bead not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // 2. 解析檔案內容與 MIME 檢查
          let imageBuffer: ArrayBuffer;
          let mimeType = '';

          const contentTypeHeader = request.headers.get('Content-Type') || '';
          if (contentTypeHeader.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
              return new Response(JSON.stringify({ error: 'No file uploaded' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            mimeType = file.type;
            imageBuffer = await file.arrayBuffer();
          } else {
            // 直接以 binary body 上傳
            mimeType = contentTypeHeader.split(';')[0].trim();
            imageBuffer = await request.arrayBuffer();
          }

          // 3. 安全驗證：MIME 與 大小 (≤ 5MB)
          const ext = ALLOWED_MIME_TYPES[mimeType];
          if (!ext) {
            return new Response(
              JSON.stringify({
                error: 'Unsupported Media Type: Only JPEG, PNG, and WebP are allowed',
              }),
              { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (imageBuffer.byteLength <= 0 || imageBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
            return new Response(
              JSON.stringify({
                error: `Payload size invalid: Must be > 0 and <= ${MAX_IMAGE_SIZE_BYTES} bytes`,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 4. 生成不可偽造之安全 Object Key
          const newImageKey = `beads/${crypto.randomUUID()}.${ext}`;
          const oldImageKey = existingBead.image_key;

          // 5. 跨資源補償操作流程：
          // Step 5a: 上傳新圖片至 R2
          try {
            await env.BEAD_IMAGES.put(newImageKey, imageBuffer, {
              httpMetadata: { contentType: mimeType },
            });
          } catch (r2Err: any) {
            // R2 PUT 失敗 -> D1 不動
            return new Response(
              JSON.stringify({ error: 'R2 upload failed', message: r2Err.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Step 5b: 更新 D1 image_key
          try {
            await env.DB.prepare(
              `UPDATE beads SET image_key = ?, updated_at = unixepoch() WHERE id = ?`
            )
              .bind(newImageKey, beadId)
              .run();
          } catch (dbErr: any) {
            // D1 更新失敗 -> 觸發補償清理：刪除剛上傳的新圖，維持舊圖有效
            await env.BEAD_IMAGES.delete(newImageKey).catch(() => {});
            return new Response(
              JSON.stringify({
                error: 'Database update failed; newly uploaded image was rolled back',
                message: dbErr.message,
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Step 5c: D1 更新成功 -> 刪除舊圖 (若刪舊圖異常不中斷使用者成功，記錄 warning)
          if (oldImageKey && oldImageKey !== newImageKey) {
            try {
              await env.BEAD_IMAGES.delete(oldImageKey);
            } catch (delErr) {
              console.warn(
                `[S7 Cleanup Warning] Failed to delete old image ${oldImageKey}:`,
                delErr
              );
            }
          }

          return new Response(
            JSON.stringify({
              ok: true,
              id: beadId,
              imageKey: newImageKey,
              message: 'Image uploaded and bound successfully',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // S8 未來切片 Mutation：尚未實作回傳 501 Not Implemented
        if (request.method === 'PUT' && path.startsWith('/api/admin/beads/')) {
          return new Response(
            JSON.stringify({
              error: 'Not Implemented',
              message: 'This mutation endpoint is not yet implemented (scheduled for S8).',
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
