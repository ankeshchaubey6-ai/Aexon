/**
 * Image Proxying Validation Tests
 *
 * These tests demonstrate that the image proxying validation system works correctly,
 * and can be integrated into your build/validation pipeline.
 */

import { ensureAllImagesProxied } from "@/lib/ai/sanitizeOutput";
import { describe, expect, it } from "vitest";
import {
  validateFileImageProxying,
  validateFilesImageProxying,
  generateImageProxyingReport,
} from "@/lib/ai/validateImageProxying";

describe("Image Proxying Validation", () => {
  describe("ensureAllImagesProxied", () => {
    it("should pass for properly proxied images", () => {
      const content = `
        <img src="/api/image?url=${encodeURIComponent("https://example.com/photo.jpg")}" alt="photo" />
        <img src="/api/image?url=${encodeURIComponent("https://unsplash.com/image.png")}" alt="image" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.isValid).toBe(true);
      expect(result.unproxiedUrls).toHaveLength(0);
      expect(result.message).toContain("✓");
    });

    it("should fail for unproxied external URLs", () => {
      const content = `
        <img src="https://example.com/photo.jpg" alt="photo" />
        <img src="https://unsplash.com/image.png" alt="image" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.isValid).toBe(false);
      expect(result.unproxiedUrls.length).toBeGreaterThan(0);
      expect(result.unproxiedUrls).toContain("https://example.com/photo.jpg");
      expect(result.message).toContain("✗");
    });

    it("should pass for local asset URLs", () => {
      const content = `
        <img src="/assets/img-abc123.jpg" alt="local" />
        <img src="/images/icon.png" alt="icon" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.isValid).toBe(true);
      expect(result.unproxiedUrls).toHaveLength(0);
    });

    it("should pass for data URIs", () => {
      const content = `
        <img src="data:image/png;base64,iVBORw0KGgo..." alt="inline" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.isValid).toBe(true);
      expect(result.unproxiedUrls).toHaveLength(0);
    });

    it("should deduplicate unproxied URLs", () => {
      const content = `
        <img src="https://example.com/photo.jpg" alt="photo1" />
        <img src="https://example.com/photo.jpg" alt="photo2" />
        <img src="https://other.com/image.png" alt="other" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.unproxiedUrls).toHaveLength(2);
    });

    it("should handle mixed proxied and unproxied URLs", () => {
      const content = `
        <img src="/api/image?url=${encodeURIComponent("https://example.com/proxied.jpg")}" alt="proxied" />
        <img src="https://example.com/unproxied.jpg" alt="unproxied" />
        <img src="/assets/local.jpg" alt="local" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.isValid).toBe(false);
      expect(result.unproxiedUrls).toHaveLength(1);
      expect(result.unproxiedUrls).toContain("https://example.com/unproxied.jpg");
    });

    it("should handle HTTP URLs", () => {
      const content = `
        <img src="http://example.com/photo.jpg" alt="photo" />
      `;

      const result = ensureAllImagesProxied(content);

      expect(result.isValid).toBe(false);
      expect(result.unproxiedUrls).toContain("http://example.com/photo.jpg");
    });
  });

  describe("validateFileImageProxying", () => {
    it("should validate a single file", () => {
      const content = `
        <img src="/api/image?url=${encodeURIComponent("https://example.com/photo.jpg")}" alt="photo" />
      `;

      const result = validateFileImageProxying(content, "test.jsx");

      expect(result.isValid).toBe(true);
      expect(result.filePath).toBe("test.jsx");
      expect(result.timestamp).toBeDefined();
    });

    it("should include file path in result", () => {
      const result = validateFileImageProxying("<img/>", "components/Card.jsx");

      expect(result.filePath).toBe("components/Card.jsx");
    });
  });

  describe("validateFilesImageProxying", () => {
    it("should validate multiple files", () => {
      const files = [
        {
          path: "file1.jsx",
          content: `<img src="/api/image?url=${encodeURIComponent("https://example.com/1.jpg")}" />`,
        },
        {
          path: "file2.jsx",
          content: `<img src="/assets/local.jpg" />`,
        },
      ];

      const results = validateFilesImageProxying(files);

      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe("file1.jsx");
      expect(results[1].filePath).toBe("file2.jsx");
    });
  });

  describe("generateImageProxyingReport", () => {
    it("should generate a summary report", () => {
      const results = [
        {
          isValid: true,
          unproxiedUrls: [],
          message: "✓ Valid",
          timestamp: new Date().toISOString(),
        },
        {
          isValid: false,
          unproxiedUrls: ["https://example.com/photo.jpg"],
          message: "✗ Invalid",
          timestamp: new Date().toISOString(),
        },
      ];

      const report = generateImageProxyingReport(results);

      expect(report.totalFiles).toBe(2);
      expect(report.passedValidation).toBe(1);
      expect(report.failedValidation).toBe(1);
      expect(report.totalUnproxiedUrls).toBe(1);
      expect(report.summary).toContain("✗");
    });

    it("should report all passed validation", () => {
      const results = [
        {
          isValid: true,
          unproxiedUrls: [],
          message: "✓ Valid",
          timestamp: new Date().toISOString(),
        },
        {
          isValid: true,
          unproxiedUrls: [],
          message: "✓ Valid",
          timestamp: new Date().toISOString(),
        },
      ];

      const report = generateImageProxyingReport(results);

      expect(report.failedValidation).toBe(0);
      expect(report.summary).toContain("✓");
    });
  });
});

/**
 * Example integration test showing how to use in a real scenario:
 *
 * it("should generate components with properly proxied images", async () => {
 *   const component = await generateComponent({
 *     type: "ProductCard",
 *     theme: "modern"
 *   });
 *
 *   const validation = validateFileImageProxying(component.code, "ProductCard.jsx");
 *
 *   expect(validation.isValid).toBe(true);
 *   expect(validation.message).toContain("✓");
 * });
 *
 * Example CI/CD integration:
 *
 * async function validateGeneratedComponents() {
 *   const generatedFiles = await loadGeneratedComponents();
 *   const results = validateFilesImageProxying(generatedFiles);
 *   const report = generateImageProxyingReport(results);
 *
 *   if (report.failedValidation > 0) {
 *     console.error("Image proxying validation failed:", report);
 *     process.exit(1);
 *   }
 *
 *   console.log("✓ All components passed image proxying validation");
 * }
 */
