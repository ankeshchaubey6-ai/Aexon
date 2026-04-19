// src/lib/ai/sanitizeWithImages.ts
// Enhanced sanitizer that downloads external images and replaces them
// Combines image download + URL replacement in one pipeline step
import { sanitizeOutput } from '@/lib/ai/sanitizeOutput';
import {
  processComponentImages,
  processImagesInGeneration,
  generateProcessingSummary,
} from './processImages';

export interface SanitizationResult {
  success: boolean;
  code: string;
  imageFiles: Array<{
    path: string;
    content: Buffer;
    mimeType: string;
  }>;
  urlMap: Record<string, string>;
  stats: {
    imagesDownloaded: number;
    imagesFailed: number;
    totalSizeMB: string;
  };
  errors: string[];
}

/**
 * MAIN ENTRY POINT: Sanitize code + download external images
 *
 * This replaces sanitizeOutput() for components with images.
 * It does everything sanitizeOutput does PLUS:
 *   1. Extracts all external image URLs
 *   2. Downloads them to local buffers
 *   3. Replaces with /assets/filename paths
 *   4. Returns both code and image files
 *
 * Usage:
 * ```typescript
 * const result = await sanitizeWithImages(generatedCode);
 * if (result.success) {
 *   await saveComponentCode(result.code);
 *   for (const img of result.imageFiles) {
 *     await writeFile(img.path, img.content);
 *   }
 * }
 * ```
 */
export async function sanitizeWithImages(
  content: string,
  options?: {
    downloadImages?: boolean;
    maxConcurrentDownloads?: number;
    timeoutPerImageMs?: number;
  }
): Promise<SanitizationResult> {
  // Step 1: Apply standard sanitization (map safety, prop fixes, etc.)
  let sanitized = sanitizeOutput(content);

  // Step 2: Process images (download and replace URLs)
  const result = await processComponentImages(sanitized, 'temporary.jsx', options);

  // Step 3: Apply sanitization again after URL replacement
  // (in case any sanitization rules interact with the new URLs)
  sanitized = sanitizeOutput(result.componentCode);

  return {
    success: true,
    code: sanitized,
    imageFiles: result.imageFiles.map((f) => {
      if (Buffer.isBuffer(f.content)) {
        return {
          path: f.path,
          content: f.content,
          mimeType: f.mimeType || 'image/jpeg',
        };
      }
      return {
        path: f.path,
        content: Buffer.from(f.content, (f.encoding as any) || 'utf8'),
        mimeType: f.mimeType || 'image/jpeg',
      };
    }),
    urlMap: result.urlMap,
    stats: {
      imagesDownloaded: Object.keys(result.urlMap).length,
      imagesFailed: 0,
      totalSizeMB: result.imageFiles
        .reduce((total, f) => {
          if (Buffer.isBuffer(f.content)) {
            return total + f.content.length;
          }
          return total;
        }, 0)
        .toString(),
    },
    errors: [],
  };
}

/**
 * Batch process multiple components with images
 * More efficient for projects with many components
 */
export async function sanitizeMultipleWithImages(
  components: Array<{ path: string; content: string }>,
  options?: {
    downloadImages?: boolean;
    maxConcurrentDownloads?: number;
  }
): Promise<{
  components: Array<{ path: string; content: string }>;
  images: Array<{ path: string; content: Buffer; mimeType: string }>;
  urlMap: Record<string, string>;
  summary: string;
}> {
  // Step 1: Sanitize all components
  const sanitized = components.map((comp) => ({
    ...comp,
    content: sanitizeOutput(comp.content),
  }));

  // Step 2: Process all images together (more efficient with parallel downloads)
  const result = await processImagesInGeneration(sanitized, options);

  return {
    components: result.codeFiles.map((f) => ({
      path: f.path,
      content: f.content as string,
    })),
    images: result.imageFiles.map((f) => ({
      path: f.path,
      content: Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content),
      mimeType: f.mimeType || 'image/jpeg',
    })),
    urlMap: result.urlMap,
    summary: generateProcessingSummary(result),
  };
}

/**
 * Get information about images that would be downloaded
 * Useful for previewing before actually downloading
 */
export async function analyzeImagesBeforeDownload(
  componentContent: string
): Promise<{
  imageUrls: string[];
  estimatedCount: number;
}> {
  const { extractImageUrls } = await import('./downloadImage');

  const urls = extractImageUrls(componentContent);
  const unique = [...new Set(urls)];

  return {
    imageUrls: unique,
    estimatedCount: unique.length,
  };
}

/**
 * Sanitize without downloading images (for testing or staging)
 * Just replaces external URLs with placeholder paths
 */
export function sanitizeWithoutImageDownload(content: string): {
  code: string;
  detectedUrls: string[];
} {
  const { extractImageUrls, replaceUrlsWithLocal } = require('./downloadImage');

  // Apply standard sanitization
  let sanitized = sanitizeOutput(content);

  const urls = extractImageUrls(sanitized) as string[];
const unique = [...new Set(urls)];

  // Create placeholder map
  const placeholderMap: Record<string, string> = {};
  unique.forEach((url, index) => {
    placeholderMap[url as string] = `/assets/image-${index}.jpg`;
  });

  // Replace with placeholders
  sanitized = replaceUrlsWithLocal(sanitized, placeholderMap);

  return {
    code: sanitized,
    detectedUrls: unique,
  };
}
