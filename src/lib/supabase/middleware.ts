import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types';

/**
 * Middleware session updater.
 * 1. Refreshes the user's Supabase Auth session token before expiration.
 * 2. Protects /dashboard and /onboarding routes, redirecting unauthenticated users to /login.
 * 3. Redirects authenticated users away from /login and /register directly to /dashboard.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

  // If mock mode is enabled or Supabase is not configured, allow access
  if (useMock || !supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify currently logged in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding');
  const isAuthPath = pathname === '/login' || pathname === '/register';

  // Unauthenticated user attempting to access protected route
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user attempting to access login/register
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}