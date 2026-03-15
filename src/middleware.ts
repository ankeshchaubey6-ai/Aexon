import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((auth, req) => {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // Allow main localhost app
  if (hostname === "localhost:3000") {
    return NextResponse.next();
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
    return NextResponse.next();
  }

  const subdomain = hostname.split(".")[0];

  if (subdomain && subdomain !== "localhost") {
    url.pathname = `/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
  ],
};