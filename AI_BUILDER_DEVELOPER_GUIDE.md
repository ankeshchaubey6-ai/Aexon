# AI Builder System - Developer Implementation Guide

---

## 1. ADDING A NEW PROJECT TYPE

### Step 1: Define Design Tokens

**File**: `src/lib/ai/engine/batch-generator.ts` (lines 280-310)

```typescript
// Add after existing project types:

if (isYourType) return {
  projectType: "yourtype",
  primary: "#YOUR_HEX",           // Main brand color
  primaryLight: "#YOUR_LIGHT",    // Lighter variant for hover states
  accent: "#YOUR_ACCENT",         // Secondary highlight color
  
  // Dark mode palette
  bg: "#DARK_BG",                 // Main background
  bgAlt: "#ALT_BG",              // Secondary background
  bgCard: "#CARD_BG",            // Card backgrounds
  text: "#TEXT_COLOR",           // Primary text
  textMuted: "#MUTED_TEXT",      // Secondary text
  border: "#BORDER_COLOR",       // Borders
  
  // Gradients (used in hero sections)
  gradient: "linear-gradient(135deg, #YOUR_HEX 0%, #YOUR_ACCENT 100%)",
};
```

### Step 2: Add Detection Regex

```typescript
// In `determineProjectType()` function (line 207)

const isYourType = /keyword1|keyword2|keyword3/i.test(prompt);

// Place BEFORE the generic catch-all:
if (isYourType) return { ... };  // ← Keep other returns above this
```

### Step 3: Test

```bash
npm run dev
# Test with prompt containing your keywords
# Verify colors applied in generated components
```

**Example**: Adding "travel" project type
```typescript
const isTravel = /travel|booking|hotel|flight|tour|destination/i.test(prompt);

if (isTravel) return {
  projectType: "travel",
  primary: "#FF6B35",        // Warm orange
  primaryLight: "#FF8C42",
  accent: "#004E89",         // Ocean blue
  bg: "#0A0E27",
  // ... rest of palette
};
```

---

## 2. MODIFYING FILE COUNT STRATEGY

### Current Logic

**File**: `src/lib/ai/stream/stream-pipeline.ts` (lines 239-265)

```typescript
const determineFileCount = (prompt: string) => {
  const isSimple = /* keyword check */;
  const isComplex = /* keyword check */;
  
  if (isSimple) return {
    targetFileCount: 2,
    minFileCount: 1,
    maxFileCount: 4,
  };
  
  if (isComplex) {
    const n = 6;  // Calculate complexity level (1-12)
    return {
      targetFileCount: n,
      minFileCount: Math.max(1, n - 1),
      maxFileCount: n + 2,
    };
  }
};
```

### Scenario: Generate Larger Projects

**Problem**: Users want 20+ file projects but max is 12  
**Solution**: Extend complexity detection

```typescript
const isHuge = /enterprise|large|complex|scalable|production-grade/i.test(prompt);

if (isHuge) {
  const n = 16 + Math.floor(Math.random() * 5);  // 16-20 files
  return {
    targetFileCount: n,
    minFileCount: Math.max(1, n - 2),
    maxFileCount: n + 3,
  };
}
```

### Scenario: Smaller Default

**Problem**: Simple projects generating too many files  
**Solution**: Lower default

```typescript
if (isSimple) return {
  targetFileCount: 2,      // Was: 2
  minFileCount: 1,         // No change
  maxFileCount: 3,         // Was: 4
};
```

---

## 3. CUSTOMIZING TOKEN BUDGETS

### What Each Budget Controls

| Budget | File | Line | Impact |
|--------|------|------|--------|
| `PLAN_MAX_TOKENS` | stream-pipeline.ts | 149 | How detailed architecture planning is |
| `CODEGEN_MAX_TOKENS` | stream-pipeline.ts | 150 | How much code per LLM call |
| `MAX_FILE_SIZE` | editor.ts | 38 | Max chars bundled per file |
| `MAX_BUNDLE_SIZE` | editor.ts | 39 | Max chars per LLM request |

### Tuning for Faster Generation

```typescript
// In src/lib/ai/stream/stream-pipeline.ts

const PLAN_MAX_TOKENS = 3000;      // Was: 4096 (saves time, less detail)
const CODEGEN_MAX_TOKENS = 8000;   // Was: 6000 (allows bigger files)
const PARALLEL_BATCH_SIZE = 4;     // Was: 3 (more files per call)
```

**Trade-off**: Faster but less detailed architecture and potential quality loss.

### Tuning for Better Quality

```typescript
const PLAN_MAX_TOKENS = 6000;      // More detailed planning
const CODEGEN_MAX_TOKENS = 5000;   // Smaller batches, focused generation
const PARALLEL_BATCH_SIZE = 2;     // 2 files per call (more attention)
const MAX_RETRIES = 3;             // More retry attempts
```

**Trade-off**: Slower but more consistent quality.

---

## 4. ADDING CUSTOM COMPONENT TEMPLATES

### Current Template System

**File**: `src/lib/ai/engine/batch-generator.ts` (lines 491-550)

```typescript
// Pattern-based template injection:

if (/nav|header|navbar/.test(componentName)) return `
  export default function Navbar() {
    return (
      <nav className="...">
        {/* Navigation JSX */}
      </nav>
    )
  }
`;
```

### Adding a New Template Type

```typescript
// Add after existing templates:

if (/dashboard|admin|panel/.test(componentName)) return `
  export default function Dashboard() {
    return (
      <div className="flex gap-4 p-6">
        <aside className="w-64 border-r">
          {/* Sidebar */}
        </aside>
        <main className="flex-1">
          {/* Main content */}
        </main>
      </div>
    )
  }
`;
```

### Best Practices for Templates

1. **Use project colors in JSX**:
   ```typescript
   return \`
     <button style={{ 
       backgroundColor: '\${primary}',
       color: 'white' 
     }}>
       Click me
     </button>
   \`;
   ```

2. **Keep templates simple**: LLM will expand on them
   ```typescript
   // Good: 10-15 lines
   // Bad: 100+ lines (LLM can't refactor)
   ```

3. **Include accessibility**:
   ```typescript
   <button aria-label="Close modal" onClick={onClose}>
     ×
   </button>
   ```

---

## 5. IMPLEMENTING CUSTOM VALIDATION

### Current JSX Validation

**File**: `src/lib/ai/stream/stream-pipeline.ts`

```typescript
// Check for bracket imbalance
const openBrackets = (content.match(/{/g) || []).length;
const closeBrackets = (content.match(/}/g) || []).length;

if (Math.abs(openBrackets - closeBrackets) > JSX_IMBALANCE_TOL) {
  // Reject or fix
}
```

### Adding TypeScript Validation

```typescript
// In post-processing stage:

function validateTypeScript(fileContent: string, fileName: string) {
  const errors: string[] = [];
  
  // Check for type annotations in .tsx files
  if (fileName.endsWith('.tsx')) {
    if (!fileContent.includes(':') && fileContent.includes('function')) {
      errors.push('Missing type annotations');
    }
  }
  
  // Check for unused imports
  const importMatch = fileContent.match(/import .* from/g);
  // ... validation logic
  
  return { valid: errors.length === 0, errors };
}
```

### Adding Custom Linting

```typescript
function customLint(fileContent: string) {
  const issues = [];
  
  // Example: Warn about missing keys in lists
  if (/\.map\(/.test(fileContent) && !/<.*key=/.test(fileContent)) {
    issues.push('List items should have keys');
  }
  
  // Example: Check for console.log in production
  if (/console\.log/.test(fileContent)) {
    issues.push('console.log found - consider removing');
  }
  
  return issues;
}
```

---

## 6. MODIFYING RATE LIMITING

### Current Rate Limit

**File**: `src/lib/ai/llm/editor.ts` (lines 30-50)

```typescript
const RL_MAX_RPM = 5;        // 5 requests per minute
const RL_WINDOW = 62_000;    // Rolling 62-second window
```

### Making It User-Tier Based

```typescript
interface UserTier {
  name: string;
  requestsPerMinute: number;
  requestTimeout: number;
}

const TIER_CONFIG: Record<string, UserTier> = {
  free: {
    name: 'Free',
    requestsPerMinute: 3,
    requestTimeout: 120_000,
  },
  pro: {
    name: 'Pro',
    requestsPerMinute: 10,
    requestTimeout: 180_000,
  },
  enterprise: {
    name: 'Enterprise',
    requestsPerMinute: 50,
    requestTimeout: 300_000,
  },
};

// In rate limiter:
async waitAndLog(label: string, userTier: string = 'free') {
  const config = TIER_CONFIG[userTier];
  const maxRequests = config.requestsPerMinute;
  
  while (requestCount >= maxRequests) {
    // ... wait logic
  }
}
```

### Dynamic Rate Limiting Based on System Load

```typescript
class AdaptiveRateLimiter {
  private cpuUsage: number = 0;
  private memoryUsage: number = 0;
  
  async getMaxRPM(): Promise<number> {
    if (this.cpuUsage > 80) return 2;      // Under load
    if (this.cpuUsage > 50) return 3;      // Moderate load
    return 5;                               // Normal
  }
  
  async waitAndLog(label: string) {
    const maxRPM = await this.getMaxRPM();
    // ... rest of logic
  }
}
```

---

## 7. ERROR HANDLING IMPROVEMENTS

### Current Error Handling

```typescript
// In batch-generator.ts
try {
  const result = await generateFile(file);
} catch (err) {
  console.error('Failed:', err);  // Generic logging
}
```

### Improved Error Handling with Context

```typescript
interface GenerationError {
  code: 'PARSE_ERROR' | 'TIMEOUT' | 'TOKEN_OVERFLOW' | 'INVALID_SYNTAX';
  message: string;
  context: {
    fileName: string;
    attempt: number;
    temperature: number;
    inputTokens?: number;
    error: Error;
  };
  recoverable: boolean;
}

async function generateFileWithErrorHandling(
  file: FileSpec,
  attempt: number = 1
): Promise<Result<string>> {
  try {
    const result = await callLLM(file);
    return { ok: true, data: result };
  } catch (err) {
    const genError: GenerationError = {
      code: categorizeError(err),
      message: err.message,
      context: {
        fileName: file.path,
        attempt,
        temperature: getTemperature(attempt),
      },
      recoverable: isRecoverable(err),
    };
    
    if (genError.recoverable && attempt < MAX_RETRIES) {
      return generateFileWithErrorHandling(file, attempt + 1);
    }
    
    return { ok: false, error: genError };
  }
}

function categorizeError(err: Error): GenerationError['code'] {
  if (err.message.includes('token')) return 'TOKEN_OVERFLOW';
  if (err.message.includes('timeout')) return 'TIMEOUT';
  if (err.message.includes('JSON')) return 'PARSE_ERROR';
  return 'INVALID_SYNTAX';
}

function isRecoverable(err: Error): boolean {
  const nonRecoverable = ['UNAUTHORIZED', 'INVALID_API_KEY'];
  return !nonRecoverable.some(type => err.message.includes(type));
}
```

---

## 8. STREAMING IMPROVEMENTS

### Current Streaming

```typescript
// Basic event streaming
stream.write({ type: 'FILE_START', fileName });
stream.write({ type: 'FILE_CHUNK', content });
stream.write({ type: 'FILE_END', stats });
```

### Enhanced Streaming with Progress

```typescript
interface StreamEvent {
  type: string;
  timestamp: number;
  progress?: {
    filesCompleted: number;
    filesTotal: number;
    percentComplete: number;
    estimatedTimeRemaining: number;
  };
  data: any;
}

async function streamWithProgress(
  files: FileSpec[],
  stream: WriteStream
) {
  const startTime = Date.now();
  let filesCompleted = 0;
  
  for (const file of files) {
    stream.write({
      type: 'PROGRESS',
      timestamp: Date.now(),
      progress: {
        filesCompleted,
        filesTotal: files.length,
        percentComplete: (filesCompleted / files.length) * 100,
        estimatedTimeRemaining: estimateRemaining(
          startTime,
          filesCompleted,
          files.length
        ),
      },
      data: {},
    });
    
    // Generate file...
    filesCompleted++;
  }
}

function estimateRemaining(
  startTime: number,
  completed: number,
  total: number
): number {
  if (completed === 0) return 0;
  const elapsedMs = Date.now() - startTime;
  const msPerFile = elapsedMs / completed;
  return (total - completed) * msPerFile;
}
```

---

## 9. TESTING CUSTOM CHANGES

### Unit Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { determinProjectType } from './batch-generator';

describe('Project Type Detection', () => {
  it('should detect SaaS projects', () => {
    const result = determineProjectType('Build a dashboard for CRM');
    expect(result.projectType).toBe('saas');
    expect(result.primary).toBe('#6366F1');
  });
  
  it('should detect Finance projects', () => {
    const result = determineProjectType('Create a cryptocurrency trading platform');
    expect(result.projectType).toBe('finance');
  });
  
  it('should fallback to default', () => {
    const result = determineProjectType('Build a random thing');
    expect(result.projectType).toBe('modern');
  });
});
```

### Integration Test Template

```typescript
it('should generate valid TypeScript for SaaS project', async () => {
  const prompt = 'Build an analytics dashboard';
  const result = await generateProject(prompt);
  
  expect(result.files).toHaveLength(expect.any(Number));
  
  for (const file of result.files) {
    expect(file.content).toMatch(/export (default )?/);
    expect(file.content).not.toMatch(/console\.log/);
  }
});
```

---

## 10. PERFORMANCE PROFILING

### Adding Performance Logging

```typescript
interface StageMetrics {
  stage: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tokenCount?: number;
  fileCount?: number;
}

const metrics: StageMetrics[] = [];

// At each stage:
const stageStart: StageMetrics = { stage: 'Planner', startTime: Date.now() };
metrics.push(stageStart);

// ... do work ...

stageStart.endTime = Date.now();
stageStart.duration = stageStart.endTime - stageStart.startTime;

// At end:
logMetrics(metrics);

function logMetrics(metrics: StageMetrics[]) {
  const total = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
  
  console.table(
    metrics.map(m => ({
      Stage: m.stage,
      'Duration (ms)': m.duration,
      '% of Total': ((m.duration / total) * 100).toFixed(1),
    }))
  );
}
```

### Bottleneck Identification

Common bottlenecks:
- **LLM latency** (50-70% of time): Optimize prompts, use caching
- **Import reconciliation** (10-20%): Parallelize or use index-based lookup
- **WebContainer writes** (10-15%): Batch file writes
- **Streaming overhead** (5-10%): Use compression for large outputs

---

## 11. CONFIGURATION FILE APPROACH

### New: `ai-config.ts`

```typescript
// src/config/ai-config.ts

export const AI_CONFIG = {
  generation: {
    planner: {
      maxTokens: 4096,
      temperature: 0.7,
    },
    codegen: {
      maxTokens: 6000,
      temperature: 0.7,
      parallelBatchSize: 3,
      maxRetries: 3,
    },
    fileSize: {
      max: 14_000,
      min: 50,
      bundleMax: 16_000,
    },
  },
  
  rateLimit: {
    maxRequestsPerMinute: 5,
    windowMs: 62_000,
  },
  
  projectTypes: {
    saas: {
      keywords: ['dashboard', 'admin', 'crm'],
      colors: { primary: '#6366F1', accent: '#06B6D4' },
    },
    // ... other types
  },
  
  fileCount: {
    simple: { target: 2, min: 1, max: 4 },
    complex: { base: 6, minDelta: -1, maxDelta: 2 },
  },
};

// Usage:
import { AI_CONFIG } from '@/config/ai-config';

const config = AI_CONFIG.generation.codegen;
const maxTokens = config.maxTokens;  // 6000
```

---

## 12. MONITORING & ALERTS

### Suggested Monitoring Setup

```typescript
class GenerationMonitor {
  private events: GenerationEvent[] = [];
  
  recordEvent(event: GenerationEvent) {
    this.events.push(event);
    
    // Check for anomalies
    if (this.isAnomalous(event)) {
      this.alertOps(event);
    }
  }
  
  private isAnomalous(event: GenerationEvent): boolean {
    // File generation taking > 5 minutes
    if (event.duration > 300_000) return true;
    
    // Failure rate > 30%
    const recentFailures = this.events
      .filter(e => Date.now() - e.timestamp < 60_000)
      .filter(e => e.status === 'failed').length;
    
    if (recentFailures / this.events.length > 0.3) return true;
    
    return false;
  }
  
  private alertOps(event: GenerationEvent) {
    // Send to monitoring service (DataDog, New Relic, etc.)
    console.warn('[ALERT]', event);
  }
}
```

---

**End of Implementation Guide**

For specific questions about your changes, refer back to the Assessment document or the original source files listed in the Appendix.
