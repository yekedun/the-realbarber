const ALLOWED_ORIGINS = [
  'https://siradaki.app',
  'https://www.siradaki.app',
  'http://localhost:3000',
  'http://localhost:8081',
];

function getAllowOrigin(req?: Request): string {
  if (!req) return '*';
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : '*';
}

export function cors(response: Response, req?: Request): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', getAllowOrigin(req));
  headers.set(
    'Access-Control-Allow-Headers',
    'authorization, x-client-info, apikey, content-type',
  );
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function corsOptions(req?: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowOrigin(req),
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

export function json(data: unknown, status = 200, req?: Request): Response {
  return cors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    req,
  );
}

// req is now the 4th param — existing callers (error(msg), error(msg, status),
// error(msg, status, extras)) are backward compatible; pass req for correct CORS origin.
export function error(
  message: string,
  status = 400,
  extras?: Record<string, unknown>,
  req?: Request,
): Response {
  return json({ error: message, ...(extras ?? {}) }, status, req);
}

const MAX_BODY_BYTES = 16_000; // 16 KB — sufficient for all booking payloads

// Call at the top of every POST handler. Returns a 413 Response if the
// request body exceeds the limit, null otherwise.
export function bodyGuard(req: Request): Response | null {
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return error('Request body too large', 413, {}, req);
  }
  return null;
}