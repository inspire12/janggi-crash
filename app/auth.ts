import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { env } from 'cloudflare:workers';

export type AppUser = { userId: string; displayName: string; email: string; fullName: string | null };

export async function authClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('Supabase Auth configuration is missing.');
  const jar = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        // Middleware refreshes cookies for read-only server components.
        try { for (const { name, value, options } of items) jar.set(name, value, options); } catch { /* read-only component */ }
      },
    },
  });
}

export async function getAppUser(): Promise<AppUser | null> {
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email) return null;
  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;
  return { userId: user.id, email: user.email, fullName, displayName: fullName ?? user.email.split('@')[0] };
}

export async function requireAppUser(returnTo: string) {
  const user = await getAppUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function safePath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !/[\\\r\n]/.test(value) ? value : '/';
}

export function signInPath(returnTo: string) {
  return `/login?return_to=${encodeURIComponent(safePath(returnTo))}`;
}
