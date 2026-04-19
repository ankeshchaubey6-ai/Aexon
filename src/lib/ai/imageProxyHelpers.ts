/**
 * src/lib/ai/imageProxyHelpers.ts
 * Helper utilities for working with the image proxy system
 * Can be used independently or with the sanitizeOutput module
 */

/**
 * Builds a proxy URL for an external image
 * @param imageUrl - The original image URL
 * @returns - The proxy URL for use in src attributes
 */
export function buildProxyUrl(imageUrl: string): string {
  try {
    const encodedUrl = encodeURIComponent(imageUrl);
    return `/api/image?url=${encodedUrl}`;
  } catch (error) {
    console.error("[imageProxyHelpers] Failed to build proxy URL:", error);
    return imageUrl;
  }
}

/**
 * Checks if a URL is an external image that should be proxied
 */
export function isExternalImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    // If it's not already a proxy URL and it's http/https, it needs proxying
    return (
      !url.startsWith("/api/image") &&
      ["http:", "https:"].includes(parsed.protocol)
    );
  } catch {
    return false;
  }
}

/**
 * React hook helper: Get a safe image src attribute
 * Usage: const src = useSafeSrc(someImageUrl);
 * Fallback: High-quality Unsplash image (always proxied)
 */
export function getSafeImageSrc(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    // Fallback: Use curated Unsplash image through proxy
    const fallbackUrl = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e";
    return buildProxyUrl(fallbackUrl);
  }
  if (isExternalImage(imageUrl)) {
    return buildProxyUrl(imageUrl);
  }
  return imageUrl;
}

/**
 * Generate an img tag with automatic proxy and fallback
 * NOTE: Handler logic is NOT embedded in HTML. React components should use onError prop.
 */
export function generateImgTag(
  src: string,
  alt: string = "Image",
  className: string = ""
): string {
  const safeSrc = getSafeImageSrc(src);
  // Clean JSX: no inline JavaScript handlers
  return `<img src="${safeSrc}" alt="${alt}" class="${className}" />`;
}

/**
 * Sanitize a single image element in HTML
 * Only rewrites src to proxy — does NOT inject JS handlers
 */
export function sanitizeImageElement(htmlElement: HTMLImageElement): void {
  const src = htmlElement.getAttribute("src");
  if (src && isExternalImage(src)) {
    htmlElement.setAttribute("src", buildProxyUrl(src));
  }
  // NOTE: React components should use onError prop, not DOM setAttribute
}

/**
 * Sanitize all images in a container
 */
export function sanitizeImageElements(container: HTMLElement): void {
  const images = container.querySelectorAll("img");
  images.forEach((img) => sanitizeImageElement(img as HTMLImageElement));
}

/**
 * Configuration for image proxy behavior
 */
export interface ImageProxyConfig {
  /** Enable automatic image URL rewriting */
  enabled: boolean;
  /** Custom placeholder URL */
  placeholderUrl: string;
  /** Allowed image hosts */
  allowedHosts: string[];
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PROXY_CONFIG: ImageProxyConfig = {
  enabled: true,
  placeholderUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  allowedHosts: [
    "images.unsplash.com",
    "images.pexels.com",
  ],
  debug: false,
};

/**
 * Global proxy configuration (can be overridden at runtime)
 */
let proxyConfig = { ...DEFAULT_PROXY_CONFIG };

/**
 * Update global proxy configuration
 */
export function setImageProxyConfig(config: Partial<ImageProxyConfig>): void {
  proxyConfig = { ...proxyConfig, ...config };
  if (config.debug) {
    console.log("[imageProxyHelpers] Config updated:", proxyConfig);
  }
}

/**
 * Get current proxy configuration
 */
export function getImageProxyConfig(): ImageProxyConfig {
  return { ...proxyConfig };
}

/**
 * Monitoring: Track proxy usage statistics
 */
export interface ProxyStats {
  totalProxied: number;
  totalFailed: number;
  byHost: Record<string, number>;
}

const stats: ProxyStats = {
  totalProxied: 0,
  totalFailed: 0,
  byHost: {},
};

/**
 * Record a successful proxy request
 */
export function recordProxySuccess(url: string): void {
  try {
    const host = new URL(url).hostname;
    stats.totalProxied++;
    stats.byHost[host] = (stats.byHost[host] || 0) + 1;
  } catch {
    // Ignore parse errors
  }
}

/**
 * Record a failed proxy request
 */
export function recordProxyFailure(): void {
  stats.totalFailed++;
}

/**
 * Get proxy statistics
 */
export function getProxyStats(): ProxyStats {
  return { ...stats };
}

/**
 * Reset proxy statistics
 */
export function resetProxyStats(): void {
  stats.totalProxied = 0;
  stats.totalFailed = 0;
  stats.byHost = {};
}
