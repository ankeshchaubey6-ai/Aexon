// src/lib/ai/downloadImage.ts
// Image download & local asset management for WebContainer
// Fetches external images and serves them from project /public/assets

import { createHash } from 'crypto';

export interface ImageAsset {
  url: string;
  localPath: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface ImageDownloadResult {
  success: boolean;
  asset?: ImageAsset;
  error?: string;
  originalUrl?: string;
  fallbackPath?: string;
}

/**
 * Download image from external URL
 * Returns buffer and metadata for local storage
 */
export async function downloadImageBuffer(
  url: string,
  timeoutMs: number = 10000
): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIBuilder/1.0)',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to download image: ${url} (HTTP ${response.status})`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    return null;
  }
}

/**
 * Generate unique filename from URL
 * Uses hash of URL + timestamp for collision resistance
 */
export function generateImageFilename(url: string): string {
  try {
    // Extract filename from URL if possible
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const lastSegment = pathname.split('/').pop() || '';
    const withoutQuery = lastSegment.split('?')[0];

    // If URL has a real filename, use it
    if (withoutQuery && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(withoutQuery)) {
      return sanitizeFilename(withoutQuery);
    }
  } catch (e) {
    // Continue with hash-based naming
  }

  // Fallback: create filename from URL hash
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
  const timestamp = Date.now().toString(36);
  return `img-${timestamp}-${hash}.jpg`;
}

/**
 * Sanitize filename to prevent path traversal and invalid chars
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200)
    .toLowerCase();
}

/**
 * Detect MIME type from URL or buffer
 */
export function detectMimeType(url: string, buffer?: Buffer): string {
  // Try to detect from URL
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.gif')) return 'image/gif';
  if (url.includes('.webp')) return 'image/webp';
  if (url.includes('.svg')) return 'image/svg+xml';

  // Try to detect from buffer magic bytes
  if (buffer && buffer.length > 8) {
    const bytes = buffer.slice(0, 8);

    // JPEG magic bytes: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG magic bytes: 89 50 4E 47
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return 'image/png';
    }

    // GIF magic bytes: 47 49 46
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return 'image/gif';
    }

    // WebP magic bytes: RI FF ... WE BP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
  }

  // Default to JPEG
  return 'image/jpeg';
}

/**
 * Convert buffer to base64 for embedding in code
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Get file extension from mime type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mimeType] || 'jpg';
}

/**
 * Download image and prepare for local storage
 * Main entry point for image download workflow
 */
export async function downloadImage(url: string): Promise<ImageDownloadResult> {
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    return {
      success: false,
      error: `Invalid URL: ${url}`,
      fallbackPath: '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1507525428034-b723cf961d3e'),
    };
  }

  // Skip if already local
  if (url.startsWith('/') || url.startsWith('.') || url.includes('localhost')) {
    return {
      success: false,
      error: `Already local URL: ${url}`,
      fallbackPath: url,
    };
  }

  // Skip if data URL
  if (url.startsWith('data:')) {
    return {
      success: false,
      error: `Data URL not supported: ${url}`,
      fallbackPath: '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1507525428034-b723cf961d3e'),
    };
  }

  // Download image buffer
  const buffer = await downloadImageBuffer(url);
  if (!buffer) {
    return {
      success: false,
      error: `Failed to download image from ${url}`,
      originalUrl: url,
      fallbackPath: '/api/image?url=' + encodeURIComponent('https://images.unsplash.com/photo-1507525428034-b723cf961d3e'),
    };
  }

  // Generate filename
  const filename = generateImageFilename(url);

  // Detect MIME type
  const mimeType = detectMimeType(url, buffer);
  const ext = getExtensionFromMimeType(mimeType);
  const finalFilename = filename.endsWith(ext) ? filename : `${filename}.${ext}`;

  // Create asset object
  const asset: ImageAsset = {
    url,
    localPath: `/assets/${finalFilename}`,
    filename: finalFilename,
    buffer,
    mimeType,
  };

  return {
    success: true,
    asset,
    originalUrl: url,
  };
}

/**
 * Download multiple images in parallel
 * Returns array of results (successes and failures)
 */
export async function downloadImages(
  urls: string[],
  maxConcurrent: number = 5
): Promise<ImageDownloadResult[]> {
  const results: ImageDownloadResult[] = [];
  const batchSize = maxConcurrent;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((url) => downloadImage(url)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Extract all external image URLs from content
 * Returns array of unique URLs found
 */
export function extractImageUrls(content: string): string[] {
  const urls = new Set<string>();

  // Match src attributes
  const srcPattern = /src\s*=\s*["']([^"']+)["']/gi;
  const backgroundPattern = /backgroundImage\s*:\s*["']?url\(['"]?([^'")]+)['"]?\)?["']?/gi;

  for (const match of content.matchAll(srcPattern)) {
    const url = match[1];
    if (isExternalImageUrl(url)) {
      urls.add(url);
    }
  }

  for (const match of content.matchAll(backgroundPattern)) {
    const url = match[1];
    if (isExternalImageUrl(url)) {
      urls.add(url);
    }
  }

  return Array.from(urls);
}

/**
 * Check if URL is an external image that should be downloaded
 */
export function isExternalImageUrl(url: string): boolean {
  // Skip local URLs
  if (url.startsWith('/') || url.startsWith('.') || url.startsWith('http://localhost')) {
    return false;
  }

  // Skip data URLs
  if (url.startsWith('data:')) {
    return false;
  }

  // Check if it's an HTTP(S) URL pointing to an image
  if (url.match(/^https?:\/\/.+/i)) {
    // Rough image extension check
    if (
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) ||
      /images\.unsplash\.com|pexels\.com|pixabay\.com|etc/.test(url)
    ) {
      return true;
    }

    // If no extension but known image host, assume it's an image
    if (/images\.unsplash\.com|pexels\.com|pixabay\.com|imgur\.com|cdn\./.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Replace all external URLs with local paths in content
 * urlMap: {originalUrl -> localPath}
 */
export function replaceUrlsWithLocal(
  content: string,
  urlMap: Record<string, string>
): string {
  let result = content;

  for (const [original, local] of Object.entries(urlMap)) {
    // Escape special regex characters in URL
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace in src attributes
    result = result.replace(
      new RegExp(`src\\s*=\\s*["']${escaped}["']`, 'gi'),
      `src="${local}"`
    );

    // Replace in backgroundImage
    result = result.replace(
      new RegExp(`url\\(['"]?${escaped}['"]?\\)`, 'gi'),
      `url('${local}')`
    );

    // Replace in direct references
    result = result.replace(new RegExp(escaped, 'g'), local);
  }

  return result;
}

/**
 * Estimate total size of images in bytes
 * Useful for warnings about large downloads
 */
export function estimateDownloadSize(images: ImageDownloadResult[]): number {
  return images.reduce((total, img) => {
    if (img.asset?.buffer) {
      return total + img.asset.buffer.length;
    }
    return total;
  }, 0);
}

/**
 * Generate statistics about downloaded images
 */
export function generateImageStats(images: ImageDownloadResult[]) {
  const successful = images.filter((img) => img.success).length;
  const failed = images.filter((img) => !img.success).length;
  const totalSize = estimateDownloadSize(images);

  return {
    total: images.length,
    successful,
    failed,
    successRate: images.length > 0 ? (successful / images.length) * 100 : 0,
    totalSizeBytes: totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
  };
}
