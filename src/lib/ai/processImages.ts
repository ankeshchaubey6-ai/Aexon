// src/lib/ai/processImages.ts
// Image processing pipeline for generated components
// Handles extraction, download, replacement, and file generation

import {
  downloadImage,
  downloadImages,
  extractImageUrls,
  replaceUrlsWithLocal,
  generateImageStats,
  ImageDownloadResult,
  ImageAsset,
} from './downloadImage';

export interface ProcessedFile {
  path: string;
  content: string | Buffer;
  encoding: 'text' | 'binary' | 'base64';
  mimeType?: string;
}

export interface ImageProcessingResult {
  success: boolean;
  codeFiles: ProcessedFile[];
  imageFiles: ProcessedFile[];
  urlMap: Record<string, string>;
  stats: {
    totalUrls: number;
    downloadedCount: number;
    failedCount: number;
    totalSizeMB: string;
    urlsReplaced: Record<string, string>;
  };
  errors: string[];
}

/**
 * Main entry point: Process all images in generated files
 * Returns code with replaced URLs + image files ready for WebContainer
 */
export async function processImagesInGeneration(
  files: Array<{ path: string; content: string }>,
  options?: {
    downloadImages?: boolean;
    maxConcurrentDownloads?: number;
    timeoutPerImageMs?: number;
  }
): Promise<ImageProcessingResult> {
  const downloadEnabled = options?.downloadImages ?? true;
  const maxConcurrent = options?.maxConcurrentDownloads ?? 5;
  const timeoutMs = options?.timeoutPerImageMs ?? 10000;

  const result: ImageProcessingResult = {
    success: true,
    codeFiles: [],
    imageFiles: [],
    urlMap: {},
    stats: {
      totalUrls: 0,
      downloadedCount: 0,
      failedCount: 0,
      totalSizeMB: '0',
      urlsReplaced: {},
    },
    errors: [],
  };

  // If download disabled, just return code files as-is
  if (!downloadEnabled) {
    result.codeFiles = files.map((f) => ({
      path: f.path,
      content: f.content,
      encoding: 'text',
    }));
    return result;
  }

  // Extract all unique image URLs
  const allUrls = new Set<string>();
  for (const file of files) {
    const urls = extractImageUrls(file.content);
    urls.forEach((url) => allUrls.add(url));
  }

  result.stats.totalUrls = allUrls.size;

  // Download images
  if (allUrls.size > 0) {
    console.log(`[ImageProcessor] Found ${allUrls.size} external images, downloading...`);

    const downloadResults = await downloadImages(Array.from(allUrls), maxConcurrent);

    // Build URL map and collect successful downloads
    const successfulAssets: ImageAsset[] = [];
    const failedUrls: string[] = [];

    for (const downloadResult of downloadResults) {
      if (downloadResult.success && downloadResult.asset) {
        result.urlMap[downloadResult.originalUrl!] = downloadResult.asset.localPath;
        result.stats.urlsReplaced[downloadResult.originalUrl!] = downloadResult.asset.localPath;
        successfulAssets.push(downloadResult.asset);
        result.stats.downloadedCount++;
      } else {
        failedUrls.push(downloadResult.originalUrl || 'unknown');
        result.stats.failedCount++;

        if (downloadResult.fallbackPath) {
          result.urlMap[downloadResult.originalUrl!] = downloadResult.fallbackPath;
          result.stats.urlsReplaced[downloadResult.originalUrl!] = downloadResult.fallbackPath;
        }

        if (downloadResult.error) {
          result.errors.push(downloadResult.error);
        }
      }
    }

    // Generate image files for WebContainer
    for (const asset of successfulAssets) {
      result.imageFiles.push({
        path: `public${asset.localPath}`,
        content: asset.buffer,
        encoding: 'binary',
        mimeType: asset.mimeType,
      });
    }

    // Calculate stats
    const totalSize = successfulAssets.reduce((sum, asset) => sum + asset.buffer.length, 0);
    result.stats.totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

    if (failedUrls.length > 0) {
      console.warn(
        `[ImageProcessor] Failed to download ${failedUrls.length} images:`,
        failedUrls.slice(0, 5)
      );
    }
  }

  // Replace URLs in code files
  for (const file of files) {
    let updatedContent = file.content;

    // Replace URLs with local paths
    if (Object.keys(result.urlMap).length > 0) {
      updatedContent = replaceUrlsWithLocal(updatedContent, result.urlMap);
    }

    result.codeFiles.push({
      path: file.path,
      content: updatedContent,
      encoding: 'text',
    });
  }

  // Mark overall success only if no critical errors
  result.success = result.errors.length === 0 || result.stats.downloadedCount > 0;

  return result;
}

/**
 * Process images for a single component
 * Simpler wrapper for single file processing
 */
export async function processComponentImages(
  componentContent: string,
  componentPath: string,
  options?: {
    downloadImages?: boolean;
    maxConcurrentDownloads?: number;
  }
): Promise<{
  componentCode: string;
  imageFiles: ProcessedFile[];
  urlMap: Record<string, string>;
}> {
  const result = await processImagesInGeneration(
    [{ path: componentPath, content: componentContent }],
    options
  );

  return {
    componentCode: (result.codeFiles[0]?.content ?? componentContent) as string,
    imageFiles: result.imageFiles,
    urlMap: result.urlMap,
  };
}

/**
 * Prepare files for WebContainer mounting
 * Converts ProcessedFile array to WebContainer format
 */
export function prepareFilesForWebContainer(files: ProcessedFile[]) {
  return files.map((file) => {
    let content = file.content;

    if (file.encoding === 'binary') {
      // Convert buffer to base64 for WebContainer transport
      if (Buffer.isBuffer(content)) {
        content = content.toString('base64');
      }
    }

    return {
      path: file.path,
      content,
      encoding: file.encoding,
      mimeType: file.mimeType,
    };
  });
}

/**
 * Validate images will work in WebContainer
 */
export function validateImagesForWebContainer(files: ProcessedFile[]): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let totalSize = 0;

  for (const file of files) {
    if (file.path.startsWith('public/')) {
      if (Buffer.isBuffer(file.content)) {
        totalSize += file.content.length;
      } else if (typeof file.content === 'string' && file.encoding === 'base64') {
        totalSize += (file.content.length * 3) / 4;
      }
    }
  }

  // Warn if total size > 50MB
  if (totalSize > 50 * 1024 * 1024) {
    warnings.push(
      `Total image size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds 50MB threshold`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Generate summary of image processing
 */
export function generateProcessingSummary(result: ImageProcessingResult): string {
  const lines = [
    '═══════════════════════════════════════════════════════════',
    '📦 IMAGE PROCESSING SUMMARY',
    '═══════════════════════════════════════════════════════════',
    ``,
    `📊 Statistics:`,
    `  • URLs found: ${result.stats.totalUrls}`,
    `  • Successfully downloaded: ${result.stats.downloadedCount}`,
    `  • Failed: ${result.stats.failedCount}`,
    `  • Total size: ${result.stats.totalSizeMB} MB`,
    `  • Success rate: ${result.stats.downloadedCount > 0 ? ((result.stats.downloadedCount / result.stats.totalUrls) * 100).toFixed(1) : 0}%`,
    ``,
  ];

  if (Object.keys(result.stats.urlsReplaced).length > 0) {
    lines.push(`📍 URLs Replaced:`);
    Object.entries(result.stats.urlsReplaced).slice(0, 5).forEach(([original, local]) => {
      const short = original.length > 60 ? original.slice(0, 57) + '...' : original;
      lines.push(`  • ${short}`);
      lines.push(`    → ${local}`);
    });

    if (Object.keys(result.stats.urlsReplaced).length > 5) {
      lines.push(`  ... and ${Object.keys(result.stats.urlsReplaced).length - 5} more`);
    }
    lines.push(``);
  }

  if (result.errors.length > 0) {
    lines.push(`⚠️  Errors:`);
    result.errors.slice(0, 3).forEach((err) => {
      lines.push(`  • ${err}`);
    });
    if (result.errors.length > 3) {
      lines.push(`  ... and ${result.errors.length - 3} more errors`);
    }
    lines.push(``);
  }

  lines.push(`✅ Result: ${result.success ? 'SUCCESS' : 'PARTIAL'}`);
  lines.push(`═══════════════════════════════════════════════════════════`);

  return lines.join('\n');
}
