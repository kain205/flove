import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

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

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function requireUser(req: Request) {
  const client = createRequestClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { client, user: null, response: jsonResponse({ error: 'Not authenticated' }, 401) };
  }
  return { client, user: data.user, response: null };
}
