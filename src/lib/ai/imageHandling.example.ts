/**
 * src/lib/ai/imageHandling.example.ts
 * 
 * COMPREHENSIVE GUIDE: Using the Image Proxy System
 * 
 * This file demonstrates production-ready patterns for handling external images
 * in the AI-generated code builder with WebContainer/COEP restrictions.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Basic Usage in Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

import { sanitizeOutput, rewriteImageUrls, analyzeImageURLs } from '@/lib/ai/sanitizeOutput';
import { getSafeImageSrc, buildProxyUrl, sanitizeImageElements } from '@/lib/ai/imageProxyHelpers';

// When generating files in stream-pipeline.ts or batch-generator.ts:
async function examplePipelineUsage() {
  const aiGeneratedContent = `
    <div>
      <h1>My App</h1>
      <!-- This external URL will be rewritten automatically -->
      <img src="https://images.unsplash.com/photo-123" alt="Hero" />
      <img src="https://images.pexels.com/photos/456" alt="Gallery" />
    </div>
  `;

  // Automatic sanitization (already integrated in pipeline):
  const sanitized = sanitizeOutput(aiGeneratedContent, 'src/components/Hero.jsx');
  // Result: Image URLs are automatically rewritten to use /api/image?url=...
  
  console.log(sanitized);
  // Output:
  // <img src="/api/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-123" alt="Hero" />
  // <img src="/api/image?url=https%3A%2F%2Fimages.pexels.com%2Fphotos-456" alt="Gallery" />
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Analyzing Generated Output
// ═══════════════════════════════════════════════════════════════════════════════

function exampleAnalyzeContent() {
  const generatedCode = `
    const HeroSection = () => {
      return (
        <section>
          <img src="https://source.unsplash.com/1600x900/?landscape" alt="Hero" />
          <img src="https://images.pexels.com/photos/123456" alt="Alt" />
          <img src="/local/image.png" alt="Local" />
        </section>
      );
    };
  `;

  // Analyze what images are found
  const metadata = analyzeImageURLs(generatedCode);
  
  console.log('Total images found:', metadata.totalFound);
  // Output: 3
  
  console.log('By source:', metadata.byType);
  // Output: { unsplash: 1, pexels: 1, pixabay: 0, generic: 0 }
  
  console.log('URLs:', metadata.urls);
  // Output: [
  //   'https://source.unsplash.com/1600x900/?landscape',
  //   'https://images.pexels.com/photos/123456'
  // ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: React Component - Handling Generated Images
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';

interface GeneratedComponentProps {
  html: string; // HTML from AI generator
}

export function GeneratedComponentViewer({ html }: GeneratedComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Option 1: Set innerHTML with sanitized HTML
      containerRef.current.innerHTML = sanitizeOutput(html);
      
      // Option 2: Also sanitize DOM elements for extra safety
      sanitizeImageElements(containerRef.current);
    }
  }, [html]);

  return React.createElement('div', {
    ref: containerRef,
    className: 'component-viewer',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Manual Image URL Handling
// ═══════════════════════════════════════════════════════════════════════════════

function exampleManualHandling() {
  // Get a safe image source
  const unsplashUrl = 'https://images.unsplash.com/photo-123';
  const safeUrl = getSafeImageSrc(unsplashUrl);
  
  console.log(safeUrl);
  // Output: /api/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-123
  
  // You can then use it in JSX:
  // <img src={safeUrl} alt="..." />
  
  // Or build the proxy URL manually:
  const manualProxy = buildProxyUrl('https://images.pexels.com/photos/456');
  // Output: /api/image?url=https%3A%2F%2Fimages.pexels.com%2Fphotos-456
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: API Route Integration
// ═══════════════════════════════════════════════════════════════════════════════

// The API route at /app/api/image/route.ts handles:
// 
// 1. URL Validation
//    - Only allows whitelisted domains (Unsplash, Pexels, Pixabay)
//    - Validates http/https protocol only
//    - Prevents SSRF attacks
//
// 2. Image Fetching
//    - Fetches remote image with User-Agent header
//    - 10-second timeout
//    - Size limit: 10MB
//
// 3. Response Headers
//    - Sets Cache-Control: public, max-age=31536000 (1 year, immutable)
//    - Adds COEP headers for iframe compatibility
//    - Sets Content-Type from remote server
//
// Usage: GET /api/image?url=https://images.unsplash.com/photo-123

async function exampleAPIUsage() {
  // Client-side code (automatically handled by sanitizer, but shown for clarity):
  const imageUrl = 'https://images.unsplash.com/photo-1234567890';
  const proxyUrl = `/api/image?url=${encodeURIComponent(imageUrl)}`;
  
  try {
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const blob = await response.blob();
      // Use blob for image
      const objectUrl = URL.createObjectURL(blob);
      console.log('Proxied image available at:', objectUrl);
    }
  } catch (error) {
    console.error('Failed to fetch proxied image:', error);
    // Fallback to placeholder
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Error Handling & Fallbacks
// ═══════════════════════════════════════════════════════════════════════════════

function exampleErrorHandling() {
  // The system automatically adds fallback handlers:
  const generatedHTML = `
    <img src="https://images.unsplash.com/photo-bad" alt="Might fail" />
  `;

  const sanitized = sanitizeOutput(generatedHTML);
  
  // Result automatically includes fallback:
  // <img 
  //   src="/api/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-bad"
  //   onerror="this.src='/placeholder.jpg'; this.style.opacity='0.5';"
  // />
  
  // If the proxy fails or remote image is unavailable:
  // - onerror callback triggers
  // - Image falls back to /public/placeholder.jpg
  // - Image opacity set to 0.5 to indicate it's a fallback
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Configuration & Monitoring
// ═══════════════════════════════════════════════════════════════════════════════

import { setImageProxyConfig, getProxyStats } from '@/lib/ai/imageProxyHelpers';

function exampleConfiguration() {
  // Configure at app startup (e.g., in root layout or _app.tsx):
  setImageProxyConfig({
    enabled: true,
    placeholderUrl: '/placeholder.jpg',
    debug: process.env.NODE_ENV === 'development',
  });

  // Monitor usage:
  const stats = getProxyStats();
  console.log(`Proxied images: ${stats.totalProxied}`);
  console.log(`Failed proxies: ${stats.totalFailed}`);
  console.log(`By host:`, stats.byHost);
  
  // Reset stats:
  // resetProxyStats();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 8: Security Features
// ═══════════════════════════════════════════════════════════════════════════════

const SECURITY_FEATURES = `
BUILT-IN PROTECTIONS:

1. SSRF Prevention
   - Only whitelisted domains allowed
   - Hostname validation required
   - No local file access

2. Type Safety
   - Only image MIME types accepted
   - Content-Type validation
   - Invalid types rejected (403)

3. Size Limits
   - Maximum 10MB per image
   - Content-Length header validation
   - Timeout: 10 seconds

4. Cache Control
   - 1-year cache for immutable URLs
   - Prevents redundant fetches
   - Reduces bandwidth

5. COEP Compliance
   - Proper Cross-Origin headers
   - Cross-Origin-Embedder-Policy: require-corp
   - Works in restricted iframe environments

6. Error Gracefully
   - Invalid URLs return 400
   - Network errors return 502/504
   - Large files return 413
   - Maintains service availability
`;

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 9: Troubleshooting
// ═══════════════════════════════════════════════════════════════════════════════

const TROUBLESHOOTING = `
ISSUE: "Image not loading inside iframe/WebContainer"
SOLUTION: 
  - Verify AI output is being sanitized (check stream-pipeline)
  - Enable debug logging: setImageProxyConfig({ debug: true })
  - Check browser console for errors
  - Verify /api/image route is deployed

ISSUE: "403 Forbidden when loading image"
SOLUTION:
  - The image host may not be whitelisted
  - Add to ALLOWED_HOSTS in /app/api/image/route.ts
  - Or use a whitelisted service (Unsplash, Pexels, Pixabay)

ISSUE: "Placeholder showing for all images"
SOLUTION:
  - Check network tab for /api/image requests
  - Verify remote server is accessible
  - Check for CORS issues
  - Ensure proper User-Agent in proxy

ISSUE: "Performance degradation"
SOLUTION:
  - Check cache headers (should be max-age=31536000)
  - Monitor proxy stats for patterns
  - Consider CDN for proxy route
  - Optimize image sizes on remote servers
`;

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 10: Integration Checklist
// ═══════════════════════════════════════════════════════════════════════════════

const INTEGRATION_CHECKLIST = `
☑️  SETUP:
   ✓ Create /app/api/image/route.ts
   ✓ Create src/lib/ai/sanitizeOutput.ts
   ✓ Create src/lib/ai/imageProxyHelpers.ts
   ✓ Create /public/placeholder.jpg
   
☑️  PIPELINE INTEGRATION:
   ✓ Import sanitizeOutput in stream-pipeline.ts
   ✓ Import sanitizeOutput in batch-generator.ts
   ✓ Add shouldSanitizeFile() helper
   ✓ Call sanitizeOutput() before emitting files
   
☑️  TESTING:
   ✓ Test with Unsplash URLs in AI prompt
   ✓ Test with Pexels URLs
   ✓ Test with Pixabay URLs
   ✓ Test with local /images URLs (should pass through)
   ✓ Test invalid URLs (should be skipped)
   ✓ Test fallback (disable network, check placeholder)
   
☑️  DEPLOYMENT:
   ✓ Verify API route is deployed
   ✓ Verify placeholder.jpg is accessible
   ✓ Test in production environment
   ✓ Monitor error logs for proxy failures
   ✓ Set up usage monitoring/logging
   
☑️  DOCUMENTATION:
   ✓ Add notes to AI generation prompts about supported images
   ✓ Update README with image handling explanation
   ✓ Document whitelisted image services
`;

export const EXAMPLES = {
  SECURITY_FEATURES,
  TROUBLESHOOTING,
  INTEGRATION_CHECKLIST,
};
