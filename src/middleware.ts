import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((auth, req) => {
  const url = req.nextUrl;
  // nextUrl.hostname excludes the port, so localhost:3000 and other local
  // development ports are handled consistently.
  const hostname = req.nextUrl.hostname.toLowerCase();

  const res = NextResponse.next();

  const isAIBuilder = url.pathname.includes("/ai-builder");

  if (isAIBuilder) {
    // Cross-Origin-Opener-Policy: same-origin is required for crossOriginIsolated.
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");

    // ✅ FIX: Use "credentialless" instead of "require-corp".
    // "require-corp" blocks any cross-origin resource that doesn't explicitly
    // set Cross-Origin-Resource-Policy, breaking avatar images, CDN assets, etc.
    // "credentialless" enables crossOriginIsolated (SharedArrayBuffer for
    // WebContainer) without requiring every third-party resource to opt in.
    res.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return res;
  }

  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.startsWith("/noise") ||
    url.pathname.startsWith("/images") ||
    url.pathname.startsWith("/icons") ||
    url.pathname.includes(".")
  ) {
    return res;
  }

  // Vercel deployment and preview hosts are platform domains, not tenant
  // subdomains. Rewriting aexon-lilac.vercel.app to /aexon-lilac would turn
  // the application root into a non-existent route.
  const isVercelHost =
    hostname === "vercel.app" || hostname.endsWith(".vercel.app");

  if (isVercelHost) {
    return res;
  }

  const subdomain = hostname.split(".")[0];

  if (subdomain && subdomain !== "localhost") {
    url.pathname = `/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url, {
      headers: res.headers,
    });
  }

  return res;
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

