import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@keylow/db";

import { getSupabaseEnv } from "@/lib/supabase/env";

const DASHBOARD_PATHS = [
  "/dashboard",
  "/diary",
  "/foods",
  "/recipes",
  "/more",
  "/about",
  "/weight",
  "/settings",
];

function isDashboardPath(pathname: string) {
  return DASHBOARD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  // getUser() asks the Auth server to validate the token. getSession() alone only reads the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const redirectPath =
    !user && isDashboardPath(pathname)
      ? "/login"
      : user && pathname === "/login"
        ? "/dashboard"
        : null;

  if (redirectPath === null) {
    return response;
  }

  const redirectResponse = NextResponse.redirect(new URL(redirectPath, request.url));
  // Keep the refreshed session cookies and no-cache headers on the redirect.
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  response.headers.forEach((value, key) => {
    if (key === "cache-control" || key === "expires" || key === "pragma") {
      redirectResponse.headers.set(key, value);
    }
  });

  return redirectResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
