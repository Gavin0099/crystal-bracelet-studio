/**
 * Cloudflare Worker API for Crystal Bracelet Studio
 * 提供前台公開讀取 API (GET /api/beads) 與 CORS 防護
 */

export interface Env {
  DB: any; // Cloudflare D1 Database Binding
  ADMIN_SECRET?: string;
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

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
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
      // 1. 公開讀取：GET /api/beads
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
