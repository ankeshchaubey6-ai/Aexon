// src/lib/ai/utils/parse-json.ts

export interface AIFileResponse {
  path: string;
  content: string;
}

export interface ParseJSONOptions {
  strict?: boolean;
  fallbackToOriginal?: boolean;
  logErrors?: boolean;
}

/**
 * Parse AI response to extract files
 * @param response - The AI API response object
 * @param options - Parsing options
 * @returns Array of files with path and content
 */
export function parseJSON(
  response: any,
  options: ParseJSONOptions = {}
): AIFileResponse[] {
  const { strict = false, logErrors = true } = options;

  try {
    let text = response?.choices?.[0]?.message?.content || "";

    if (!text) {
      if (logErrors) console.warn("⚠️ Empty response from AI");
      return [];
    }

    // Clean the text
    text = cleanText(text);

    // Try different parsing strategies
    const parsers = [
      () => parseArrayFormat(text),
      () => parseObjectFormat(text),
      () => parseNestedObjectFormat(text),
      () => parseCodeBlockFormat(text),
      () => parseDeepSeekFormat(text),
      () => extractJSONFromText(text),
    ];

    for (const parser of parsers) {
      try {
        const result = parser();
        if (result && result.length > 0) {
          // Validate the result
          const validated = validateFiles(result);
          if (validated.length > 0 || !strict) {
            if (logErrors && validated.length !== result.length) {
              console.warn(`⚠️ Filtered ${result.length - validated.length} invalid files`);
            }
            return validated;
          }
        }
      } catch (err) {
        // Continue to next parser
        continue;
      }
    }

    // If we get here, no parser worked
    if (logErrors) {
      console.error("❌ Unsupported AI format:", text.substring(0, 500));
    }

    return [];

  } catch (err) {
    if (logErrors) {
      console.error("❌ JSON parse failed:", err);
    }
    return [];
  }
}

// Helper: Clean markdown and formatting
function cleanText(text: string): string {
  return text
    .replace(/```json/g, "")
    .replace(/```javascript/g, "")
    .replace(/```js/g, "")
    .replace(/```/g, "")
    .replace(/^\s*```[\s\S]*?```\s*$/gm, "")
    .trim();
}

// Parser 1: Direct array format
// Expected: [{ "path": "file.js", "content": "code" }]
function parseArrayFormat(text: string): AIFileResponse[] {
  if (text.startsWith("[")) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  throw new Error("Not array format");
}

// Parser 2: Object with files array
// Expected: { "files": [{ "path": "file.js", "content": "code" }] }
function parseObjectFormat(text: string): AIFileResponse[] {
  if (text.startsWith("{")) {
    const obj = JSON.parse(text);
    if (obj.files && Array.isArray(obj.files)) {
      return obj.files;
    }
    if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
      // Convert object to array
      return Object.entries(obj.files).map(([path, content]) => ({
        path,
        content: content as string,
      }));
    }
  }
  throw new Error("Not object format");
}

// Parser 3: Nested object format
// Expected: { "src": { "App.jsx": "code", "main.jsx": "code" } }
function parseNestedObjectFormat(text: string): AIFileResponse[] {
  const obj = JSON.parse(text);
  const files: AIFileResponse[] = [];

  function traverse(obj: any, currentPath: string = "") {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}/${key}` : key;
      
      if (typeof value === "string") {
        files.push({ path: newPath, content: value });
      } else if (typeof value === "object" && value !== null) {
        traverse(value, newPath);
      }
    }
  }

  traverse(obj);
  
  if (files.length > 0) {
    return files;
  }
  throw new Error("No files found");
}

// Parser 4: Code block with file structure
// Expected: ```json\n{ "files": [...] }\n```
function parseCodeBlockFormat(text: string): AIFileResponse[] {
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  const matches = [...text.matchAll(codeBlockRegex)];
  
  for (const match of matches) {
    const content = match[1].trim();
    try {
      const parsed = JSON.parse(content);
      if (parsed.files && Array.isArray(parsed.files)) {
        return parsed.files;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed.files && typeof parsed.files === "object") {
        return Object.entries(parsed.files).map(([path, fileContent]) => ({
          path,
          content: fileContent as string,
        }));
      }
    } catch (err) {
      continue;
    }
  }
  throw new Error("No valid code block found");
}

// Parser 5: DeepSeek specific format
// Expected: { "files": { "path": "content", ... } }
function parseDeepSeekFormat(text: string): AIFileResponse[] {
  const obj = JSON.parse(text);
  
  if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
    return Object.entries(obj.files).map(([path, content]) => ({
      path,
      content: content as string,
    }));
  }
  
  throw new Error("Not DeepSeek format");
}

// Parser 6: Extract JSON from any text
function extractJSONFromText(text: string): AIFileResponse[] {
  // Try to find JSON object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  
  if (start !== -1 && end !== -1 && start < end) {
    const jsonStr = text.slice(start, end + 1);
    const obj = JSON.parse(jsonStr);
    
    if (obj.files) {
      if (Array.isArray(obj.files)) {
        return obj.files;
      }
      if (typeof obj.files === "object") {
        return Object.entries(obj.files).map(([path, content]) => ({
          path,
          content: content as string,
        }));
      }
    }
  }
  
  throw new Error("No JSON found");
}

// Helper: Validate file structure
function validateFiles(files: any[]): AIFileResponse[] {
  return files.filter(file => {
    const isValid = file && 
                   typeof file.path === "string" && 
                   file.path.trim().length > 0 &&
                   typeof file.content === "string";
    
    if (!isValid) {
      console.warn(`⚠️ Invalid file structure:`, file);
    }
    
    return isValid;
  });
}

// Helper: Format files for AI
export function formatFilesForAI(files: AIFileResponse[]): string {
  return JSON.stringify(files, null, 2);
}

// Helper: Create project summary
export function createProjectSummary(files: AIFileResponse[]): string {
  const summary = files.map(file => ({
    path: file.path,
    size: file.content.length,
    type: file.path.split('.').pop() || 'unknown',
    lines: file.content.split('\n').length,
  }));
  
  return JSON.stringify(summary, null, 2);
}

// Helper: Extract dependencies from files
export function extractDependencies(files: AIFileResponse[]): string[] {
  const dependencies = new Set<string>();
  const packageJson = files.find(f => f.path === "package.json");
  
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson.content);
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(dep => dependencies.add(dep));
      }
      if (pkg.devDependencies) {
        Object.keys(pkg.devDependencies).forEach(dep => dependencies.add(dep));
      }
    } catch (err) {
      console.error("Failed to parse package.json:", err);
    }
  }
  
  // Also scan for imports in JS/JSX files
  files.forEach(file => {
    if (file.path.endsWith('.jsx') || file.path.endsWith('.js') || file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
      const importRegex = /import.*from ['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        const importPath = match[1];
        // Only include external dependencies (not relative imports)
        if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
          // Extract package name (for scoped packages like @react/core)
          const packageName = importPath.startsWith('@') 
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0];
          dependencies.add(packageName);
        }
      }
    }
  });
  
  return Array.from(dependencies).sort();
}

// Helper: Type guard for AIFileResponse
export function isAIFileResponse(obj: any): obj is AIFileResponse {
  return obj && 
         typeof obj.path === "string" && 
         typeof obj.content === "string";
}

// Helper: Type guard for AIFileResponse array
export function isAIFileArray(obj: any): obj is AIFileResponse[] {
  return Array.isArray(obj) && obj.every(isAIFileResponse);
}

// Helper: Merge files (new files override old ones)
export function mergeFiles(
  existingFiles: AIFileResponse[],
  newFiles: AIFileResponse[]
): AIFileResponse[] {
  const fileMap = new Map<string, AIFileResponse>();
  
  // Add existing files
  existingFiles.forEach(file => {
    fileMap.set(file.path, file);
  });
  
  // Override with new files
  newFiles.forEach(file => {
    fileMap.set(file.path, file);
  });
  
  return Array.from(fileMap.values());
}

// Helper: Get file by path
export function getFileByPath(
  files: AIFileResponse[],
  path: string
): AIFileResponse | undefined {
  return files.find(file => file.path === path);
}

// Helper: Remove file by path
export function removeFileByPath(
  files: AIFileResponse[],
  path: string
): AIFileResponse[] {
  return files.filter(file => file.path !== path);
}

// Helper: Validate project has required files
export function validateProjectStructure(files: AIFileResponse[]): {
  isValid: boolean;
  missingFiles: string[];
  issues: string[];
} {
  const requiredFiles = [
    "src/App.jsx",
    "src/main.jsx",
    "package.json",
    "index.html"
  ];
  
  const missingFiles = requiredFiles.filter(required => 
    !files.some(file => file.path === required)
  );
  
  const issues: string[] = [];
  
  // Check for index.html
  const htmlFile = files.find(f => f.path === "index.html");
  if (htmlFile && !htmlFile.content.includes("<div id=\"root\"></div>")) {
    issues.push("index.html missing root div");
  }
  
  // Check for main.jsx
  const mainFile = files.find(f => f.path === "src/main.jsx");
  if (mainFile && !mainFile.content.includes("createRoot")) {
    issues.push("main.jsx missing createRoot render setup");
  }
  
  return {
    isValid: missingFiles.length === 0 && issues.length === 0,
    missingFiles,
    issues
  };
}