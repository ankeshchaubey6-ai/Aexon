/**
 * src/lib/ai/sanitizeOutput.ts
 * Sanitizes AI-generated code by rewriting external image URLs to use a proxy
 * to avoid COEP (Cross-Origin Embedder Policy) restrictions in WebContainer/iframe
 */

const IMAGE_URL_PATTERNS = [
  /\/api\/image\?url=[^\s"'`<>]+/gi,
  /https:\/\/source\.unsplash\.com\/[^\s"'`<>]+/gi,
  /https:\/\/images\.unsplash\.com\/[^\s"'`<>]+/gi,
  /https:\/\/(?:www\.)?unsplash\.com\/[^\s"'`<>]+/gi,
  /https:\/\/api\.unsplash\.com\/[^\s"'`<>]+/gi,
  /https:\/\/[a-z0-9]*\.?pexels\.com\/[^\s"'`<>]+/gi,
  /https:\/\/pixabay\.com\/[^\s"'`<>]+/gi,
  /https:\/\/[^\s"'`<>]+\.(jpg|jpeg|png|webp|gif|svg)\b[^\s"'`<>]*(?=["\s<>'`]|$)/gi,
];

type SafeURLType = "unsplash" | "pexels" | "pixabay" | "generic";

const CURATED_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  "https://images.unsplash.com/photo-1516321318423-f06f70504b6f",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
  "https://images.unsplash.com/photo-1552664730-d307ca884978",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
  "https://images.unsplash.com/photo-1560264357-8d9766c54b0f",
  "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
];

const THEMED_FALLBACK_IMAGES: Record<string, string[]> = {
  car: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  auto: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  vehicle: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  ],
  fashion: [
    "https://images.unsplash.com/photo-1445205170230-053b83016050",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b",
  ],
  travel: [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
  ],
  tech: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
  ],
};

function stableFallbackImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CURATED_FALLBACK_IMAGES[hash % CURATED_FALLBACK_IMAGES.length];
}

function themedFallbackImage(seed: string): string {
  const lower = seed.toLowerCase();
  for (const [keyword, urls] of Object.entries(THEMED_FALLBACK_IMAGES)) {
    if (lower.includes(keyword)) {
      let hash = 0;
      for (let i = 0; i < lower.length; i++) {
        hash = (hash * 31 + lower.charCodeAt(i)) >>> 0;
      }
      return urls[hash % urls.length];
    }
  }
  return stableFallbackImage(seed);
}

function validateURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function categorizeImageURL(url: string): SafeURLType {
  if (url.includes("unsplash.com")) return "unsplash";
  if (url.includes("pexels.com")) return "pexels";
  if (url.includes("pixabay.com")) return "pixabay";
  return "generic";
}

function unwrapProxyUrl(url: string): string {
  if (!url.startsWith("/api/image?url=")) return url;
  const encoded = url.slice("/api/image?url=".length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function normalizeImageUrl(url: string): string {
  const raw = unwrapProxyUrl(url.trim());
  if (!raw) return themedFallbackImage("empty-image-url");

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    
    // Reject API endpoints - they must be handled by the proxy
    if (hostname === "api.unsplash.com" || hostname === "api.pexels.com") {
      // This is an API endpoint, should go through proxy
      // Return the raw URL for proxyImageURL to wrap
      return parsed.toString();
    }

    const cleanUrl = `${parsed.protocol}//${hostname}${parsed.pathname}`;
    const forbiddenPhrase =
      /component|layout|banner|responsive|featured|random|template|widget|section|element/.test(
        `${cleanUrl.toLowerCase()}${parsed.search.toLowerCase()}`
      );

    // For source.unsplash.com, prefer the CDN URL instead
    if (hostname === "source.unsplash.com") {
      return themedFallbackImage(raw);
    }

    if (
      forbiddenPhrase ||
      hostname === "unsplash.com" ||
      hostname === "api.unsplash.com" ||
      (hostname.endsWith(".unsplash.com") && hostname !== "images.unsplash.com")
    ) {
      return themedFallbackImage(raw);
    }

    // Valid Unsplash CDN URL
    if (hostname === "images.unsplash.com") {
      if (/\/photo-[0-9a-z-]+$/i.test(parsed.pathname)) {
        return cleanUrl;
      }
      return themedFallbackImage(raw);
    }

    // Valid Pexels CDN URL
    if (hostname === "images.pexels.com") {
      if (/\/photos\/\d+(?:\/|$)/i.test(parsed.pathname)) {
        return cleanUrl;
      }
      return themedFallbackImage(raw);
    }

    // Pixabay CDN
    if (hostname === "cdn.pixabay.com") {
      return parsed.toString();
    }

    // Generic image extension check
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(parsed.pathname)) {
      return parsed.toString();
    }
  } catch {
    return themedFallbackImage(raw);
  }

  return themedFallbackImage(raw);
}

export function proxyImageURL(imageUrl: string): string {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  if (!validateURL(normalizedUrl)) {
    console.warn(`[sanitizeOutput] Invalid URL skipped: ${imageUrl}`);
    return imageUrl;
  }

  // ALWAYS wrap external URLs in the proxy format
  // This ensures they work inside COEP-restricted iframes
  try {
    const encoded = encodeURIComponent(normalizedUrl);
    return `/api/image?url=${encoded}`;
  } catch (error) {
    console.error(`[sanitizeOutput] Failed to proxy URL ${imageUrl}:`, error);
    return imageUrl;
  }
}

export function detectImageURLs(content: string): string[] {
  const urls = new Set<string>();
  for (const pattern of IMAGE_URL_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) urls.add(match[0]);
  }
  return Array.from(urls);
}

export function rewriteImageUrls(content: string): string {
  let rewriteCount = 0;
  let result = content;

  result = result.replace(
    /(src\s*=\s*["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (
        url.startsWith("data:") ||
        url.startsWith("./") ||
        (url.startsWith("/") && !url.startsWith("/api/image?url="))
      ) {
        return match;
      }

      rewriteCount++;
      return `${prefix}${proxyImageURL(url)}${suffix}`;
    }
  );

  for (const pattern of IMAGE_URL_PATTERNS) {
    result = result.replace(pattern, (match) => {
      rewriteCount++;
      return proxyImageURL(match);
    });
  }

  if (rewriteCount > 0) {
    console.log(`[sanitizeOutput] Rewrote ${rewriteCount} image URLs`);
  }

  return result;
}

export function addImageFallbacks(content: string): string {
  const imgTagPattern = /<img\s+([^>]*?)>/gi;

  return content.replace(imgTagPattern, (match) => {
    let updated = match;
    updated = updated.replace(/\s*onerror="[^"]*"/gi, "");
    updated = updated.replace(/\s*onerror=\{[^}]*\}/gi, "");

    if (!/onError=/.test(updated)) {
      const srcMatch = updated.match(/\ssrc=["']([^"']+)["']/i);
      const fallbackUrl =
        "/api/image?url=" +
        encodeURIComponent(themedFallbackImage(srcMatch?.[1] ?? updated));

      updated = updated.replace(
        "<img",
        `<img onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "${fallbackUrl}";
        }}`
      );
    }

    return updated;
  });
}

export function fixReactImageProps(content: string): string {
  return content.replace(/onerror=/gi, "onError=");
}

export function sanitizeOutput(fileContent: string, filePath?: string): string {
  if (!fileContent || typeof fileContent !== "string") {
    return fileContent;
  }

  const logPrefix = filePath ? `[${filePath}]` : "[sanitizeOutput]";
  let processed = fileContent;

  try {
    processed = rewriteImageUrls(processed);
    processed = addImageFallbacks(processed);
    processed = fixReactImageProps(processed);

    if (processed !== fileContent) {
      console.log(`${logPrefix} Content sanitized successfully`);
    }
  } catch (error) {
    console.error(`${logPrefix} Sanitization error:`, error);
    return fileContent;
  }

  return processed;
}

export function sanitizeFiles(
  files: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  return files.map((file) => ({
    ...file,
    content: sanitizeOutput(file.content, file.path),
  }));
}

export interface ImageMetadata {
  totalFound: number;
  byType: Record<SafeURLType, number>;
  urls: string[];
}

export function analyzeImageURLs(content: string): ImageMetadata {
  const urls = detectImageURLs(content);
  const byType: Record<SafeURLType, number> = {
    unsplash: 0,
    pexels: 0,
    pixabay: 0,
    generic: 0,
  };

  urls.forEach((url) => {
    const type = categorizeImageURL(url);
    byType[type]++;
  });

  return {
    totalFound: urls.length,
    byType,
    urls,
  };
}

/**
 * Validates that all external image URLs in the content have been proxied through /api/image.
 * Returns an object with validation results.
 *
 * @param content - The HTML/JSX content to validate
 * @returns Object with isValid flag and details about any unproxied URLs found
 */
export function ensureAllImagesProxied(
  content: string
): {
  isValid: boolean;
  unproxiedUrls: string[];
  message: string;
} {
  const unproxiedUrls: string[] = [];

  // Pattern to find unproxied external URLs in src attributes
  // Looks for src="https://..." but NOT src="https:/api/image?url=..."
  const unproxiedPattern = /src=["'](?!\/api\/image\?url=)(https?:\/\/[^"']+)["']/gi;

  let match;
  while ((match = unproxiedPattern.exec(content)) !== null) {
    const url = match[1];
    // Only flag actual external URLs, not data URIs or local paths
    if (url.startsWith("http://") || url.startsWith("https://")) {
      unproxiedUrls.push(url);
    }
  }

  const isValid = unproxiedUrls.length === 0;
  const message = isValid
    ? "✓ All images are properly proxied through /api/image"
    : `✗ Found ${unproxiedUrls.length} unproxied external URLs`;

  return {
    isValid,
    unproxiedUrls: [...new Set(unproxiedUrls)], // Deduplicate
    message,
  };
}
