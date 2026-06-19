import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/coach",
  "/achievements",
  "/chat",
  "/notes",
  "/quiz",
  "/flashcards",
  "/explain",
  "/planner",
  "/projects",
  "/repos",
  "/profile",
  "/settings",
];

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Pass through if Supabase isn't configured yet
  if (!url || !key) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST call getUser() not getSession().
  // Guard against transient network failures talking to Supabase: a thrown
  // fetch here would 500 every request (including login/signup Server Actions,
  // surfacing as "An unexpected response was received from the server").
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
