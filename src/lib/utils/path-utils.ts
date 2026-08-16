/**
 * lib/utils/path-utils.ts
 * 
 * Production-grade path utilities for AI Builder pipeline
 * Ensures consistent, safe path handling throughout file generation
 */

/**
 * Normalize component import paths
 * Handles: @/lib/utils.ts -> @/lib/utils, _generated/hero -> _generated/hero
 */
export function normalizeImportPath(importPath: string | undefined): string {
  if (!importPath) return "";

  let normalized = importPath.trim();

  // Remove trailing extensions (.ts, .tsx, .js, .jsx)
  normalized = normalized.replace(/\.(ts|tsx|js|jsx)$/, "");

  // Ensure @ prefix for absolute paths (if missing)
  if (!normalized.startsWith("@/") && !normalized.startsWith("./") && !normalized.startsWith("../")) {
    if (normalized.includes("/")) {
      normalized = "@/" + normalized;
    }
  }

  return normalized;
}

/**
 * Build safe file path with proper extension
 * Input: "@/components/hero", "tsx" -> "src/components/hero.tsx"
 */
export function buildFilePath(
  importPath: string,
  fileType: "tsx" | "jsx" | "ts" | "js" | "css" = "tsx"
): string {
  if (!importPath) return "";

  const normalized = normalizeImportPath(importPath);

  // Convert @/ to src/
  let filePath = normalized.startsWith("@/")
    ? normalized.replace("@/", "src/")
    : normalized;

  // Handle _generated paths
  if (filePath.startsWith("_generated/")) {
    filePath = "src/" + filePath;
  }

  // Add extension if not already present
  if (!filePath.endsWith("." + fileType)) {
    filePath = filePath + "." + fileType;
  }

  // Normalize slashes
  filePath = filePath.replace(/\\/g, "/");

  return filePath;
}

/**
 * Extract clean import statement from resolved paths
 * Used in page index generation
 */
export function getImportStatement(importPath: string, componentId: string): string {
  const normalized = normalizeImportPath(importPath);

  // Strip @ for relative imports in generated code
  let relativeImport = normalized;
  if (normalized.startsWith("@/")) {
    relativeImport = "./" + normalized.replace("@/", "");
  }

  return `import ${componentId} from '${relativeImport}';`;
}

/**
 * Validate path has no double extensions
 * Returns true if valid (no: file.ts.jsx, utils.tsx.js)
 */
export function validateNoDoubleExtension(path: string): boolean {
  // Check for double extensions like .ts.jsx, .tsx.js
  const doubleExtPattern = /\.(ts|tsx|js|jsx)\.(ts|tsx|js|jsx)$/i;
  return !doubleExtPattern.test(path);
}

/**
 * Sanitize path for use in import statements
 * Removes @ prefix and adds relative path indicator
 */
export function sanitizeImportPath(path: string): string {
  let sanitized = normalizeImportPath(path);

  if (sanitized.startsWith("@/")) {
    sanitized = sanitized.replace("@/", "../");
  }

  return sanitized;
}

/**
 * Get component display name from path
 * "@/components/hero" -> "Hero", "_generated/section-1" -> "Section1"
 */
export function getComponentName(importPath: string | undefined): string {
  if (!importPath) return "Component";

  const normalized = normalizeImportPath(importPath);
  const parts = normalized.split("/");
  const lastPart = parts[parts.length - 1];

  // Convert kebab-case to PascalCase
  return lastPart
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

/**
 * Validate component path format
 * Ensures path is safe, properly formatted
 */
export function validateComponentPath(path: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!path || path.trim() === "") {
    errors.push("Path cannot be empty");
  }

  if (path.includes("//")) {
    errors.push("Path contains double slashes");
  }

  if (!validateNoDoubleExtension(path)) {
    errors.push("Path has double file extensions (e.g., .ts.jsx)");
  }

  if (path.includes("\\")) {
    errors.push("Path should use forward slashes, not backslashes");
  }

  // Check for invalid characters
  if (/[<>:"|?*]/.test(path)) {
    errors.push("Path contains invalid characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
