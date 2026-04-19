# AI Builder System - Comprehensive Assessment

**Generated**: December 2024  
**Scope**: Full AI-driven code generation pipeline  
**Status**: Production with known architectural patterns

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

The AI Builder is a **multi-stage, streaming code generation system** that converts natural language prompts into full React/TypeScript web projects.

### Core Pipeline Architecture

```
User Input (Prompt)
    ↓
[1] Prompt Preprocessing
    - Length validation (1-5000 chars)
    - Keyword extraction
    - Complexity detection (simple/complex)
    ↓
[2] Planner Stage (LLM)
    - File count calculation (complexity-based)
    - Architecture outline generation
    - Component list & relationships
    ↓
[3] Batch Code Generation (LLM)
    - Parallel file generation (3 files per batch)
    - Real-time streaming output
    - Token budget enforcement
    ↓
[4] Post-Processing & Validation
    - JSX syntax validation
    - Import/export reconciliation
    - File tree assembly
    ↓
[5] Persistence & Snapshot
    - WebContainer file system write
    - Snapshot generation (.json)
    - Build artifact creation
```

### Key Components

| Component | File | Responsibility |
|-----------|------|-----------------|
| **Stream Pipeline** | `src/lib/ai/stream/stream-pipeline.ts` | Orchestrates all stages, real-time streaming |
| **Batch Generator** | `src/lib/ai/engine/batch-generator.ts` | LLM call batching, parallel file generation |
| **Editor LLM** | `src/lib/ai/llm/editor.ts` | Core code generation logic, retries, rate-limiting |
| **Planner LLM** | `src/lib/ai/llm/planner.ts` | Architecture planning, file count calculation |
| **File Tree Service** | `src/lib/ai/persistence/file-tree.service.ts` | File system tree management, import reconciliation |
| **WebContainer** | `src/lib/webcontainer/` | Runtime sandboxing, file I/O, build execution |

---

## 2. GENERATION PIPELINE - DETAILED FLOW

### Stage 1: Complexity Detection

**File**: `src/lib/ai/stream/stream-pipeline.ts` (lines 239-265)

```typescript
const determineFileCount = (prompt: string) => {
  const isComplex = /database|backend|auth|api|admin|dashboard|analytics/i.test(prompt);
  
  if (isSimpleKeyword) return {
    targetFileCount: 2,
    minFileCount: 1,
    maxFileCount: 4,
  };
  
  if (isComplexKeyword) return {
    targetFileCount: n,
    minFileCount: Math.max(1, n - 1),
    maxFileCount: n + 2,
  };
};
```

**Complexity Keywords**:
- **Simple** (2-4 files): landing pages, cards, forms, static UI
- **Complex** (5-12+ files): dashboards, admin panels, databases, authentication

### Stage 2: Planner - Architecture Design

**Input**: Prompt + Complexity Level  
**Output**: File list, component tree, architectural notes

**Token Budget**: `PLAN_MAX_TOKENS = 4096`

**Planner Prompt Pattern**:
```
You are an expert React/TypeScript architect.

Project: [DESCRIPTION]
Target Files: [COUNT]

Return ONLY valid JSON:
{
  "files": [{"path": "...", "purpose": "..."}],
  "imports": {"component": ["dependency1", "dependency2"]},
  "warnings": []
}
```

**Key Constraints**:
- No markdown wrapping
- Strict JSON validation (fallback to defaults if invalid)
- File count must respect `[minFileCount, maxFileCount]` bounds

### Stage 3: Batch Code Generation

**Input**: File list from planner  
**Output**: Generated JSX/TypeScript for each file

**Configuration**:
```typescript
const PARALLEL_BATCH_SIZE = 3;           // 3 files per LLM call
const MAX_FILE_RETRIES = 3;              // 3 attempts per failed file
const MAX_FILE_CHARS = 14_000;           // chars per file limit
const MIN_FILE_CHARS = 50;               // reject stubs < 50 chars
const CODEGEN_MAX_TOKENS = 6000;         // token budget per batch
```

**Retry Logic**:
- **Attempt 1**: temperature = 0.7 (balanced)
- **Attempt 2**: temperature = 0.5 (more deterministic)
- **Attempt 3**: temperature = 0.3 (conservative)
- **Max failures before abort**: 3 failed files

### Stage 4: Real-Time Streaming

**File**: `src/lib/ai/stream/stream-pipeline.ts`

**Streaming Protocol**:
```
stream.write({
  type: 'FILE_START',
  fileName: 'Component.tsx',
  index: 1
})
↓
stream.write({
  type: 'FILE_CHUNK',
  content: '// Generated code...'
})
↓
stream.write({
  type: 'FILE_END',
  fileName: 'Component.tsx',
  stats: { chars: 450, lines: 25 }
})
↓
stream.write({
  type: 'GENERATION_COMPLETE',
  stats: { totalFiles: 5, totalChars: 2450 }
})
```

**Monitoring**: Health pings every 7 seconds (`PING_INTERVAL_MS = 7_000`)

### Stage 5: Post-Processing

#### JSX Validation
- **Bracket balance check**: `JSX_IMBALANCE_TOL = 2` (allow up to 2 unmatched brackets)
- **Import extraction**: Named + namespace imports recognized
- **Multiline comment handling**: `/* ... */` detected and skipped during parsing

#### Import Reconciliation
**File**: `src/lib/ai/persistence/file-tree.service.ts`

Process:
1. Extract all imports from each file
2. Map to available components in project
3. Fix missing dependencies with stubs
4. Sort imports for stable ordering

---

## 3. DESIGN SYSTEMS & HARDCODED TOKENS

### Design Token Detection

**File**: `src/lib/ai/engine/batch-generator.ts` (lines 207-301)

The system automatically detects project type via **regex matching** of the prompt:

```typescript
const isSaas = /saas|dashboard|analytics|crm|productivity|workspace|admin|platform/i.test(prompt);
const isFinance = /finance|fintech|bank|invest|crypto|wallet|trading/i.test(prompt);
const isEcommerce = /shop|store|ecommerce|product|cart|checkout|fashion/i.test(prompt);
```

### Color Palettes by Project Type

| Type | Primary | Light | Accent | Gradient | Background |
|------|---------|-------|--------|----------|------------|
| **SaaS** | `#6366F1` (Indigo) | `#818CF8` | `#06B6D4` (Cyan) | 135° blend | `#030712` |
| **Finance** | `#10B981` (Green) | `#34D399` | `#F59E0B` (Amber) | 135° blend | `#030B0F` |
| **Ecommerce** | `#E11D48` (Rose) | `#FB7185` | `#F59E0B` | 135° blend | `#FAFAF9` |
| **Creative** | `#FF3D00` (Deep Orange) | `#FF7043` | `#FFD600` | - | `#1A1A1A` |
| **Streaming** | `#A855F7` (Purple) | `#C084FC` | `#F43F5E` | - | `#0F0F1E` |
| **Healthcare** | `#0EA5E9` (Sky) | `#38BDF8` | `#10B981` | - | `#0C1421` |
| **Education** | `#7C3AED` (Violet) | `#A78BFA` | `#F59E0B` | - | `#1C1427` |
| **Default** | `#6366F1` | `#818CF8` | `#F59E0B` | - | `#1A1A1A` |

### Gradient Generation

**File**: `src/lib/ai/stream/stream-pipeline.ts` (lines 334-337)

```typescript
gradient: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`

// For light backgrounds:
gradientHero: `linear-gradient(160deg, ${mixHex(primary, "#ffffff", 0.9)} 0%, ${mixHex(accent, "#ffffff", 0.88)} 100%)`

// For dark backgrounds:
gradientHero: `radial-gradient(ellipse 80% 60% at 50% -10%, ${rgba(primary, 0.32)} 0%, transparent 70%)`
```

**Color Mixing Function**:
```typescript
function mixHex(hexA: string, hexB: string, weight: number): string {
  // Converts hex to RGB, blends, converts back
  const aR = parseInt(hexA.slice(1, 3), 16);
  const aG = parseInt(hexA.slice(3, 5), 16);
  const aB = parseInt(hexA.slice(5, 7), 16);
  
  const bR = parseInt(hexB.slice(1, 3), 16);
  // ... blend logic
}
```

### Component Template Mapping

**File**: `src/lib/ai/engine/batch-generator.ts` (lines 491-550+)

Pattern-based template insertion:

```typescript
if (/nav|header|navbar/.test(fileName)) return `
  export default function Navbar() {
    // Navigation template with {primary}, {accent} placeholders
  }
`

if (/hero/.test(fileName)) return `
  export default function Hero() {
    // Hero section with gradient backgrounds
  }
`

// Matches:
// - /feature/ → Feature showcase cards
// - /pricing/ → Pricing table
// - /testimonial|review/ → Social proof
// - /stat|metric|count/ → Statistics
```

---

## 4. RATE LIMITING & THROTTLING

### Request-Level Rate Limiting (RL)

**File**: `src/lib/ai/llm/editor.ts` (lines 30-100)

```typescript
const RL_MAX_RPM = 5;        // 5 requests per minute max
const RL_WINDOW = 62_000;    // 62 second rolling window
const PING_INTERVAL_MS = 7_000;

class RateLimiter {
  private requests: number[] = [];
  
  async waitAndLog(label: string) {
    while (this.requests.filter(t => Date.now() - t < RL_WINDOW).length >= RL_MAX_RPM) {
      const waitMs = 62_000 - (Date.now() - this.requests[0]);
      console.log(`[editor/RL] Waiting ${(ms / 1000).toFixed(1)}s for ${label}`);
      await sleep(1000);
    }
    this.requests.push(Date.now());
  }
}
```

### Request Configuration

```typescript
const MAX_RETRIES = 2;              // Attempts per model
const REQUEST_TIMEOUT = 120_000;    // 2 minutes per attempt
const PING_INTERVAL_MS = 7_000;     // Client health check frequency
const MIN_CONTENT_CHARS = 30;       // Reject files < 30 chars
```

---

## 5. TOKEN BUDGET ENFORCEMENT

### File Bundling Strategy

**File**: `src/lib/ai/llm/editor.ts` (lines 38-42)

```typescript
const MAX_FILE_SIZE = 5_000;        // chars per file in context
const MAX_BUNDLE_SIZE = 16_000;     // total chars sent to LLM
```

**Algorithm**:
1. Sort files by dependency order
2. Add files to bundle until `MAX_BUNDLE_SIZE` reached
3. If file > `MAX_FILE_SIZE`, split into chunks
4. Each chunk sent as separate LLM request
5. Rejected if < `MIN_CONTENT_CHARS` (30)

### Model Token Budgets

| Stage | Max Tokens | Purpose |
|-------|-----------|---------|
| Planning | 4096 | Architecture + file list |
| Code Generation (per batch) | 6000 | Batch of 3 files |
| Editing | 8000 | Post-gen refinement |

---

## 6. IMAGE PROCESSING PIPELINE

### Download & Processing

**File**: `src/lib/ai/downloadImage.ts` (lines 1-400+)

**Flow**:
```
URL Array
  ↓
[Validate URLs]
  - Check domain whitelist
  - Verify HTTPS
  ↓
[Parallel Downloads]
  - 3 concurrent requests
  - 30 second timeout per download
  ↓
[Size Validation]
  - Individual: < 10MB
  - Total batch: < 50MB
  ↓
[Format Detection & Conversion]
  - WEBP preferred
  - PNG fallback
  - JPEG if necessary
  ↓
[Base64 Encoding]
  - Inline in generated components
```

**Configuration**:
```typescript
const MAX_CONCURRENT_DOWNLOADS = 3;
const DOWNLOAD_TIMEOUT = 30_000;
const MAX_SIZE_PER_IMAGE = 10_485_760;  // 10MB
const MAX_BATCH_SIZE = 52_428_800;      // 50MB (line 237)
```

**Size Reporting**:
```typescript
result.stats.totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
```

---

## 7. FAILURE & ERROR HANDLING

### Failure Classification

**File**: `src/lib/ai/engine/batch-generator.ts` (lines 85-95)

```typescript
const FAILURE_THRESHOLD = 3;  // Abort batch if 3+ consecutive files fail

interface FileResult {
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  retryCount: number;
}
```

### Error Recovery

**Retry Strategy**:
1. **Parse error** → Temp fix corruption → Retry (up to 2x)
2. **Token overflow** → Reduce file list → Replan
3. **Rate limit** → Wait + exponential backoff → Retry
4. **Timeout** → Mark as failed → Move to next batch

**Token Corruption Detection**:
```typescript
const fixed = fixTokenCorruption(raw);  // Auto-fix common LLM artifacts
const edits = parseEdits(fixed);        // Extract code chunks
```

---

## 8. PERSISTENCE & STORAGE

### File Tree Service

**File**: `src/lib/ai/persistence/file-tree.service.ts`

**Operations**:
- Build in-memory tree during generation
- Reconcile imports as files are added
- Create stubs for missing dependencies
- Sort imports alphabetically for stability

**WebContainer Integration**:
```typescript
const fs = await webcontainerInstance.fs;

// Write generated files
await fs.writeFile(filePath, content, 'utf-8');

// Build bundle
const result = await webcontainerInstance.spawn('npm', ['run', 'build']);
```

### Snapshot Generation

**File**: `public/snapshot/base.json`

```json
{
  "projectType": "saas",
  "files": {
    "src/components/Header.tsx": "...",
    "src/components/Hero.tsx": "..."
  },
  "designTokens": {
    "primary": "#6366F1",
    "accent": "#06B6D4"
  },
  "metadata": {
    "generatedAt": "2024-12-...",
    "fileCount": 5
  }
}
```

---

## 9. KNOWN ARCHITECTURAL PATTERNS

### 1. Complexity-Based Scaling
- **Simple projects**: 2-4 files, single stage planning
- **Complex projects**: 5-12+ files, detailed architecture breakdown
- **Decision Point**: Regex matching on keywords (database, auth, admin, etc.)

### 2. Parallel Batch Processing
- **Batch size**: 3 files per LLM call
- **Reason**: Balance between token efficiency and parallelism
- **Constraint**: Must respect `PARALLEL_BATCH_SIZE = 3` limit

### 3. Streaming for Real-Time Feedback
- **Why**: Users see file generation as it happens
- **How**: Write events streamed via SSE/WebSocket
- **Health checks**: Every 7 seconds to detect stalled connections

### 4. Token Budget Isolation
- **Each stage** has separate budget (planner, batch codegen)
- **Files** are chunked if they exceed `MAX_FILE_SIZE`
- **Fallback**: Defaults to safe values if parsing fails

### 5. Design Token Inference
- **Automatic detection** via prompt keyword matching
- **Provides consistency** across entire generated project
- **Extendable**: Add new project types by adding regex + color palette

---

## 10. TECHNICAL DEBT & LIMITATIONS

### 1. Hardcoded Design Tokens
**Issue**: Color palettes are static regex-driven  
**Impact**: Cannot handle mid-project color changes  
**Solution**: Could externalize to database or config file  
**Priority**: Medium

### 2. Fixed File Count Strategy
**Issue**: Min/max bounds are hardcoded (1-4 for simple, n±2 for complex)  
**Impact**: Cannot generate 15+ file projects even if needed  
**Solution**: Make bounds configurable based on prompt analysis  
**Priority**: Medium

### 3. Template String Injection
**Issue**: Component templates use regex string replacement  
**Impact**: Fragile if template format changes  
**Solution**: Use proper template engine (Handlebars, EJS, Liquid)  
**Priority**: Low

### 4. Import Reconciliation Overhead
**Issue**: Post-processing step reconciles all imports serially  
**Impact**: Scales O(n²) with file count  
**Solution**: Build import map during generation (streaming)  
**Priority**: Low (not bottleneck for < 20 files)

### 5. Error Messages in Production
**Issue**: LLM error responses not consistently captured  
**Impact**: Silent failures or cryptic errors to users  
**Solution**: Add structured error logging + user feedback layer  
**Priority**: High

### 6. Rate Limit Hardcoding
**Issue**: 5 RPM fixed in code  
**Impact**: Cannot quickly scale for higher-tier users  
**Solution**: Make configurable per user tier  
**Priority**: Medium

---

## 11. CONFIGURATION & TUNING PARAMETERS

### Easy-to-Tune (Single File Edit)

```typescript
// src/lib/ai/stream/stream-pipeline.ts
const PARALLEL_BATCH_SIZE = 3;        // Change: affects generation speed
const MAX_FILE_RETRIES = 3;           // Change: affects tolerance
const CODEGEN_MAX_TOKENS = 6000;      // Change: impacts file size

// src/lib/ai/engine/batch-generator.ts
const RL_MAX_RPM = 5;                 // Change: affects rate limit
const MAX_FILE_CHARS = 14_000;        // Change: max file size
```

### Moderate-to-Tune (Multi-File Changes)

- **Design token palettes**: Add entries to `DESIGN_TOKENS` object
- **Complexity keywords**: Extend regex in `determineFileCount()`
- **Component templates**: Add conditions in `getComponentTemplate()`
- **File count strategy**: Adjust `minFileCount`, `maxFileCount` logic

### Hard-to-Tune (Architecture Changes)

- **Streaming protocol**: Requires client/server coordination
- **Rate limiting algorithm**: Affects request batching
- **Import reconciliation**: Impacts file tree correctness

---

## 12. MONITORING & OBSERVABILITY

### Key Metrics

**Logged Events**:
- `[editor/RL]` - Rate limiting waits
- `[batch-generator][RL]` - Batch rate limiting
- `[stream]` - Streaming pipeline events
- `[websocket]` - Connection status

**Failure Tracking**:
- Files generated: `stats.fileCount`
- Total chars: `stats.totalChars`
- Download stats: `downloadedCount`, `failedCount`, `totalUrls`
- Success rate: `(downloadedCount / totalUrls) * 100%`

### Suggested Enhancements

- [ ] Add structured logging (pino, winston)
- [ ] Track generation latency by stage
- [ ] Monitor token usage per project type
- [ ] Alert on > 30% file generation failure rate
- [ ] Dashboard for real-time pipeline health

---

## 13. DEPLOYMENT CONSIDERATIONS

### Production Checklist

- [x] Rate limiting enabled
- [x] Token budgets enforced
- [x] Error handling with retries
- [x] Import reconciliation
- [ ] Structured logging
- [ ] Alert system for failures
- [ ] User-facing error messages
- [ ] Performance profiling baseline

### Scaling Recommendations

1. **For 100s of concurrent users**: Implement queue system (Bull, RabbitMQ)
2. **For custom color palettes**: Move design tokens to database
3. **For larger projects**: Implement hierarchical file splitting
4. **For faster generation**: Experiment with batch size tuning (4-5 files)

---

## APPENDIX: File Reference Guide

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/ai/stream/stream-pipeline.ts` | 1-500 | Main orchestration, streaming logic |
| `src/lib/ai/engine/batch-generator.ts` | 1-900 | Batch LLM calls, design tokens |
| `src/lib/ai/llm/editor.ts` | 1-550 | Code generation, rate limiting |
| `src/lib/ai/llm/planner.ts` | 1-300 | Architecture planning |
| `src/lib/ai/persistence/file-tree.service.ts` | 1-800 | File tree management |
| `src/lib/ai/downloadImage.ts` | 1-400 | Image download pipeline |
| `src/lib/ai/processImages.ts` | 1-300 | Image processing |
| `src/lib/webcontainer/` | Various | WebContainer integration |

---

**End of Assessment**  
For questions about specific implementation details, refer to the file line numbers listed above.
