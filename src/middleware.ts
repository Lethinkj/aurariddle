import { NextRequest, NextResponse } from "next/server";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "hardword_admin_secret_2024";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin routes (except login page and login API)
  if (
    pathname.startsWith("/admin/dashboard") ||
    pathname.startsWith("/admin/event")
  ) {
    const session = request.cookies.get("admin_session");

    if (session?.value !== SESSION_SECRET) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // Protect admin API routes (except login)
  if (
    pathname.startsWith("/api/admin/") &&
    !pathname.startsWith("/api/admin/login")
  ) {
    const session = request.cookies.get("admin_session");

    if (session?.value !== SESSION_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
