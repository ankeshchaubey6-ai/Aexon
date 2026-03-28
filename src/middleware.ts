import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((auth, req) => {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  const res = NextResponse.next();

  // Only apply WebContainer headers on AI builder routes
  const isAIBuilder = url.pathname.includes("/ai-builder");
  if (isAIBuilder) {
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  }

  // Allow main localhost app
  if (hostname === "localhost:3000") {
    return res;
  }

  // Ignore static files
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