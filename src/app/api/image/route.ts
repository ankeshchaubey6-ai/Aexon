/**
 * src/app/api/image/route.ts
 * Image proxy API for handling external images in WebContainer/iframe with COEP restrictions
 *
 * Supports:
 *   1. Direct CDN URLs: /api/image?url=https://images.unsplash.com/...
 *   2. API endpoints: /api/image?url=https://api.unsplash.com/... (fetches JSON, extracts image URL)
 *   3. Pexels API: /api/image?url=https://api.pexels.com/... (same flow)
 *
 * All responses include COEP-compliant headers for iframe embedding.
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "api.unsplash.com",
  "source.unsplash.com",
  "images.pexels.com",
  "api.pexels.com",
  "cdn.pixabay.com",
  "pixabay.com",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * COEP/CORS headers required for all responses
 */
const COEP_CORS_HEADERS = {
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Access-Control-Allow-Origin": "*",
  "Timing-Allow-Origin": "*",
};

/**
 * Detect MIME type from magic bytes (first 12 bytes)
 * FF D8 FF = image/jpeg
 * 89 50 4E 47 = image/png
 * 52 49 46 46 (at 8: 57 45 42 50) = image/webp
 * 47 49 46 = image/gif
 * .svg or <svg in content = image/svg+xml
 */
function detectMimeType(buffer: ArrayBuffer, urlHint?: string): string {
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }

  // WebP: RIFF ... WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return "image/webp";
    }
  }

  // GIF: 47 49 46
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }

  // SVG: check URL hint or content
  if (urlHint?.endsWith(".svg")) {
    return "image/svg+xml";
  }

  const str = new TextDecoder().decode(bytes.slice(0, 100));
  if (str.includes("<svg")) {
    return "image/svg+xml";
  }

  // Default to JPEG
  return "image/jpeg";
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: COEP_CORS_HEADERS,
  });
}

/**
 * GET handler for image proxy
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and validate URL parameter
    const urlParam = request.nextUrl.searchParams.get("url");

    if (!urlParam) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400, headers: COEP_CORS_HEADERS }
      );
    }

    // Decode URL
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(urlParam);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL encoding" },
        { status: 400, headers: COEP_CORS_HEADERS }
      );
    }

    // Parse and validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(decodedUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400, headers: COEP_CORS_HEADERS }
      );
    }

    // Validate hostname against whitelist
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = Array.from(ALLOWED_HOSTS).some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Hostname not allowed" },
        { status: 403, headers: COEP_CORS_HEADERS }
      );
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let imageBuffer: ArrayBuffer;
    let mimeType: string = "image/jpeg";

    // Case A: Unsplash API endpoint
    if (hostname === "api.unsplash.com") {
      try {
        // Fetch from Unsplash API with authentication
        const apiResponse = await fetch(decodedUrl, {
          signal: controller.signal,
          headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || ""}`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!apiResponse.ok) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: `Unsplash API error: ${apiResponse.status}` },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        // Parse JSON response
        const jsonData = await apiResponse.json();

        // Extract image URL from Unsplash API response
        const imageUrl = jsonData.urls?.regular || jsonData.urls?.small;
        if (!imageUrl) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Could not extract image URL from Unsplash response" },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        // Fetch the actual image from CDN (no auth needed for CDN)
        const cdnResponse = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!cdnResponse.ok) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: `CDN fetch failed: ${cdnResponse.status}` },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        imageBuffer = await cdnResponse.arrayBuffer();
        if (imageBuffer.byteLength === 0) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Empty image response" },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }
        if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Image exceeds maximum size" },
            { status: 413, headers: COEP_CORS_HEADERS }
          );
        }

        mimeType = detectMimeType(imageBuffer, imageUrl);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return NextResponse.json(
            { error: "Request timeout" },
            { status: 504, headers: COEP_CORS_HEADERS }
          );
        }
        return NextResponse.json(
          { error: "Unsplash API fetch failed" },
          { status: 502, headers: COEP_CORS_HEADERS }
        );
      }
    }
    // Case B: Pexels API endpoint
    else if (hostname === "api.pexels.com") {
      try {
        // Fetch from Pexels API with authentication
        const apiResponse = await fetch(decodedUrl, {
          signal: controller.signal,
          headers: {
            Authorization: process.env.PEXELS_API_KEY || "",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!apiResponse.ok) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: `Pexels API error: ${apiResponse.status}` },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        // Parse JSON response
        const jsonData = await apiResponse.json();

        // Extract image URL from Pexels API response
        const imageUrl = jsonData.src?.large || jsonData.src?.medium;
        if (!imageUrl) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Could not extract image URL from Pexels response" },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        // Fetch the actual image from CDN (no auth needed for CDN)
        const cdnResponse = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!cdnResponse.ok) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: `CDN fetch failed: ${cdnResponse.status}` },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        imageBuffer = await cdnResponse.arrayBuffer();
        if (imageBuffer.byteLength === 0) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Empty image response" },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }
        if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Image exceeds maximum size" },
            { status: 413, headers: COEP_CORS_HEADERS }
          );
        }

        mimeType = detectMimeType(imageBuffer, imageUrl);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return NextResponse.json(
            { error: "Request timeout" },
            { status: 504, headers: COEP_CORS_HEADERS }
          );
        }
        return NextResponse.json(
          { error: "Pexels API fetch failed" },
          { status: 502, headers: COEP_CORS_HEADERS }
        );
      }
    }
    // Case C: Direct CDN URL
    else {
      try {
        const response = await fetch(decodedUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "image/*",
          },
        });

        if (!response.ok) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: `Fetch failed: ${response.status}` },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }

        imageBuffer = await response.arrayBuffer();
        if (imageBuffer.byteLength === 0) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Empty image response" },
            { status: 502, headers: COEP_CORS_HEADERS }
          );
        }
        if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: "Image exceeds maximum size" },
            { status: 413, headers: COEP_CORS_HEADERS }
          );
        }

        mimeType = detectMimeType(imageBuffer, decodedUrl);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return NextResponse.json(
            { error: "Request timeout" },
            { status: 504, headers: COEP_CORS_HEADERS }
          );
        }
        return NextResponse.json(
          { error: "Fetch failed" },
          { status: 502, headers: COEP_CORS_HEADERS }
        );
      }
    }

    clearTimeout(timeoutId);

    // Return image with COEP headers and cache headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        ...COEP_CORS_HEADERS,
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[image-proxy] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: COEP_CORS_HEADERS }
    );
  }
}

