import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, sessionRefreshCookieName } from "@/lib/session-cookie-names";

// Runs on every request. Three jobs:
//   1. security headers, including a per-request nonce CSP
//   2. no-store on API responses, which carry personal data
//   3. bounce anonymous visitors off app pages before anything renders
//
// The redirect is a UX guard only — it trusts nothing but the presence of a
// cookie. Every route handler still resolves and authorises the real session.

const PUBLIC_PATHS = ["/login", "/setup"];

// Paths that never need a session cookie to work.
const PUBLIC_API = ["/api/auth/login", "/api/setup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!isApi && !isPublicPage(pathname) && !hasSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", pathname + request.nextUrl.search);
    return harden(NextResponse.redirect(login), request, isApi);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return harden(response, request, isApi, nonce);
}

function isPublicPage(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicApi(pathname: string) {
  return PUBLIC_API.some((p) => pathname === p);
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(
    request.cookies.get(sessionCookieName)?.value ||
      request.cookies.get(sessionRefreshCookieName)?.value
  );
}

function harden(response: NextResponse, request: NextRequest, isApi: boolean, nonce?: string) {
  const isProd = process.env.NODE_ENV === "production";

  if (nonce) {
    response.headers.set("Content-Security-Policy", csp(nonce, isProd));
  }

  // Clickjacking, MIME sniffing, and referrer leakage. no-referrer matters here
  // because record URLs and usernames should never ride along to another site.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()"
  );

  if (isProd) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // API payloads are per-user and often personal (records, signatures, profiles).
  // Keep them out of every cache, including the browser's back/forward store.
  if (isApi) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    response.headers.set("Pragma", "no-cache");
    if (!isPublicApi(request.nextUrl.pathname)) {
      response.headers.set("Vary", "Cookie");
    }
  }

  return response;
}

function csp(nonce: string, isProd: boolean) {
  // Fonts are self-hosted by next/font at build time and signatures are data:
  // URLs, so nothing legitimately loads from another origin. 'strict-dynamic'
  // lets Next's own bootstrap load its chunks without listing every hash.
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`; // React Fast Refresh

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // React style props + next/font
    "img-src 'self' data: blob:", // drawn signatures are data: URLs
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const config = {
  matcher: [
    // Everything except Next's build output, the favicon and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
