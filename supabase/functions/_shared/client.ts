import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
  retryAfterMs?: number;
}

export function requestIdFor(req: Request): string {
  const supplied = req.headers.get('x-request-id')?.trim() ?? '';
  return /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

/** Product admission is based on the verified Supabase user email, never OAuth `hd`. */
export function isValidAccountEmail(value: unknown): boolean {
  return typeof value === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Fences user-intent payloads against an auth session changing in flight. */
export function expectedUserFenceResponse(
  body: Record<string, unknown>,
  authenticatedUserId: string,
  requestId: string,
  required = false,
): Response | null {
  const expectedUserId = typeof body.expectedUserId === 'string' ? body.expectedUserId.trim() : '';
  if (required && !expectedUserId) {
    return errorResponse(requestId, 'expected_user_required', 'expectedUserId is required.', 400);
  }
  if (expectedUserId && expectedUserId !== authenticatedUserId) {
    return errorResponse(requestId, 'session_changed', 'Tài khoản đã thay đổi. Vui lòng thử lại.', 409);
  }
  return null;
}

/** Parses only JSON objects so `null`, arrays and primitives never escape into handlers. */
export async function jsonObjectBody(req: Request): Promise<Record<string, unknown>> {
  const value: unknown = await req.json().catch(() => null);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function createRequestClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('Supabase environment is not configured.');

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
      },
    },
  });
}

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Supabase service environment is not configured.');

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function jsonResponse(body: unknown, status = 200, requestId?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    },
  });
}

export function errorResponse(
  requestId: string,
  code: string,
  message: string,
  status: number,
  retryable = false,
  retryAfterMs?: number,
): Response {
  const body: ApiErrorBody = {
    ok: false,
    error: { code, message, retryable, requestId },
    ...(retryAfterMs != null ? { retryAfterMs } : {}),
  };
  return jsonResponse(body, status, requestId);
}

/** Maps database failures without leaking SQL/table details to clients. */
export function rpcErrorResponse(
  requestId: string,
  error: { code?: string | null } | null | undefined,
  fallbackCode: string,
  fallbackMessage: string,
): Response {
  const code = error?.code ?? '';
  if (code === '22023' || code === '22P02') {
    return errorResponse(requestId, 'invalid_request', 'Dữ liệu gửi lên không hợp lệ.', 400);
  }
  if (code === '28000' || code === '42501') {
    return errorResponse(requestId, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.', 403);
  }
  if (code === 'P0002') {
    return errorResponse(requestId, 'not_found', 'Không tìm thấy dữ liệu được yêu cầu.', 404);
  }
  if (code === '40001' || code === '55000' || code === '23505') {
    return errorResponse(requestId, 'conflict', 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.', 409);
  }
  return errorResponse(requestId, fallbackCode, fallbackMessage, 503, true, 2_000);
}

function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function requireUser(req: Request, fixedRequestId?: string) {
  const requestId = fixedRequestId ?? requestIdFor(req);
  const client = createRequestClient(req);

  if (req.method === 'OPTIONS') {
    return { client, user: null, requestId, response: corsResponse() };
  }

  if (req.method !== 'POST') {
    return {
      client,
      user: null,
      requestId,
      response: errorResponse(requestId, 'method_not_allowed', 'Only POST is supported.', 405),
    };
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return {
      client,
      user: null,
      requestId,
      response: errorResponse(requestId, 'not_authenticated', 'Not authenticated', 401),
    };
  }
  if (!isValidAccountEmail(data.user.email)) {
    return {
      client,
      user: null,
      requestId,
      response: errorResponse(
        requestId,
        'verified_email_required',
        'Tài khoản cần có địa chỉ email hợp lệ đã được xác thực.',
        403,
      ),
    };
  }
  return { client, user: data.user, requestId, response: null };
}
