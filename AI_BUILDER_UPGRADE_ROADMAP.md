# AI Builder System - Comprehensive Upgrade Roadmap

**Date**: April 2026  
**Goal**: Remove hardcoded generation values (colors, design tokens, file counts) and improve prompt quality for production-level generation

---

## EXECUTIVE SUMMARY

The AI Builder currently has **3 major categories of hardcoding**:

1. **Hardcoded Design Tokens** (Colors, Gradients, Shadows)
   - 11 project types with fixed color palettes
   - Regex-based detection (not configurable)
   - No user override capability

2. **Hardcoded File Count Strategy**
   - Fixed bounds: minimal (2-4), standard (4-9), complex (8-11), large (13-20)
   - No dynamic adjustment based on project complexity
   - Cannot generate custom file counts without code changes

3. **Hardcoded Prompts & LLM Instructions**
   - Planner prompt lacks quality-level directives
   - No production vs. prototype mode distinction
   - Missing code review checklist injection
   - Limited domain-specific guidance

**Files Requiring Upgrade**: **7 core files + 1 new configuration system**

---

## PART 1: FILES THAT NEED UPGRADING

### 1️⃣ **`src/lib/ai/engine/batch-generator.ts`** ⭐ CRITICAL
**Current Lines**: 1-900+  
**Issue Category**: Hardcoded Design Tokens + Hardcoded Prompts

#### Problems:

```typescript
// LINE ~207-300: 11 Project types hardcoded with exact colors
if (isMarketplace) return {
  projectType: "marketplace",
  primary: "#E11D48",              // ← HARDCODED
  primaryLight: "#FB7185",          // ← HARDCODED
  accent: "#F59E0B",                // ← HARDCODED
  // ... 20+ more hardcoded values
};
```

**Status**: These color palettes are duplicated from `stream-pipeline.ts` (code smell)

#### What Needs to Change:

1. **Remove** all inline `isMarketplace`, `isTravel`, `isPortfolio` checks with hardcoded color returns
2. **Create** new file: `src/lib/ai/config/design-token-registry.ts`
3. **Replace** with: `const tokens = await designTokenRegistry.resolveTokens(plan)`
4. **Add** support for:
   - User-provided color overrides via `params.userColors`
   - Custom palette from database
   - Brand color extraction from uploaded logo

#### Lines to Extract:
- Lines 207-320: All `if (is...)` color detection blocks

---

### 2️⃣ **`src/lib/ai/engine/project-planner-v2.ts`** ⭐ CRITICAL
**Current Lines**: 1-500+  
**Issue Category**: Hardcoded File Counts + Hardcoded Prompts

#### Problems:

```typescript
// LINE ~280-330: File count bounds hardcoded
if (isMinimal && !isComplex) return {
  mode: "minimal",
  targetFileCount: 2,         // ← HARDCODED
  minFileCount: 1,            // ← HARDCODED
  maxFileCount: 4,            // ← HARDCODED
};

if (isComplex) return {
  mode: "complex",
  targetFileCount: 8,         // ← HARDCODED
  minFileCount: 4,            // ← HARDCODED
  maxFileCount: 11,           // ← HARDCODED
};
```

**Status**: User cannot request a project with 25+ files

#### What Needs to Change:

1. **Extract** file count bounds to: `src/lib/ai/config/complexity-config.ts`
2. **Make configurable**:
   ```typescript
   // New structure:
   export const COMPLEXITY_BOUNDS = {
     minimal: { target: 2, min: 1, max: 4 },
     standard: { target: 6, min: 4, max: 9 },
     complex: { target: 8, min: 4, max: 11 },
     large: { target: 16, min: 13, max: 20 },
     custom: { target: ?, min: ?, max: ? }  // ← NEW: User-defined
   };
   ```
3. **Update** `detectComplexityMode()` to check for: `params.fileCountOverride` or `params.targetSize`

#### Lines to Extract:
- Lines 265-335: All mode detection logic

#### Prompt Quality Issues (Lines ~340-450):

```typescript
// CURRENT: Generic planner prompt
"Generate 4–6 component files for a well-structured website."

// NEEDED: Production-aware prompt
```

---

### 3️⃣ **`src/lib/ai/stream/stream-pipeline.ts`** ⭐ CRITICAL
**Current Lines**: 1-1000+  
**Issue Category**: Hardcoded Design Tokens (duplicate) + Hardcoded Token Budgets

#### Problems:

```typescript
// LINE ~215-290: Design token resolution (DUPLICATE of batch-generator.ts)
const PLAN_MAX_TOKENS = 5000;        // ← Should be configurable
const CODEGEN_MAX_TOKENS = 8000;     // ← Should be configurable
const PARALLEL_BATCH_SIZE = 2;       // ← Should be configurable
const MAX_FILE_RETRIES = 3;          // ← Should be configurable

// Design token detection logic (exact copy of batch-generator)
if (isSaas) return { primary: "#6366F1", ... };
if (isFinance) return { primary: "#10B981", ... };
// ... duplicated 11 times
```

**Status**: Same token logic exists in 2 files (maintenance nightmare)

#### What Needs to Change:

1. **Delete** all color detection logic from this file
2. **Replace** with single call: `const tokens = await getDesignTokens(plan, mode)`
3. **Extract** token budgets to config:
   ```typescript
   // src/lib/ai/config/generation-budget.ts
   export const GENERATION_BUDGET = {
     planner: {
       maxTokens: 5000,
       temperature: 0.7,
     },
     codegen: {
       maxTokens: 8000,
       temperature: 0.7,
       batchSize: 2,
     },
     retries: {
       maxFileRetries: 3,
       maxRegenPerFile: 2,
     }
   };
   ```

#### Lines to Extract:
- Lines 200-320: Design token detection duplicates
- Lines 142-150: All hardcoded constants

---

### 4️⃣ **`src/lib/ai/llm/editor.ts`** 🟡 MEDIUM PRIORITY
**Current Lines**: 1-550+  
**Issue Category**: Hardcoded Prompts + Token Limits

#### Problems:

```typescript
// LINE ~37-50: Hardcoded limits
const PING_INTERVAL_MS = 7_000;       // ← What if user has slow connection?
const MAX_FILE_SIZE = 5_000;          // ← Cannot adjust for large files
const MAX_BUNDLE_SIZE = 16_000;       // ← Fragile with newer models
const MAX_RETRIES = 2;                // ← No fallback strategy
const REQUEST_TIMEOUT = 120_000;      // ← 2min might be insufficient

// LINE ~300-450: Code generation prompt (HARDCODED system prompt)
const systemPrompt = `You are a React expert...`  // ← Not parameterized
```

#### What Needs to Change:

1. **Extract** all magic numbers to `src/lib/ai/config/editor-config.ts`
2. **Make** system prompt injectable: `buildCodegenSystemPrompt(designTokens, role, quality)`
3. **Add** quality-level directives to prompt:
   ```typescript
   // NEW: Quality levels affect prompt
   interface CodegenContext {
     qualityLevel: 'draft' | 'production';
     codeReviewChecklist: string[];
     performanceTargets: string[];
   }
   ```

#### Lines to Extract:
- Lines 37-50: All constants
- Lines 300-450: System prompt building

---

### 5️⃣ **`src/lib/ai/llm/plan-project.ts`** 🟡 MEDIUM PRIORITY
**Current Lines**: 1-20  
**Issue Category**: Thin wrapper, but needs prompt enhancement

#### Problems:

```typescript
// Delegates to project-planner-v2, but doesn't pass context about:
// - Quality level (draft vs production)
// - User expertise (beginner vs expert)
// - Code style preferences
```

#### What Needs to Change:

1. **Add** parameter: `qualityLevel?: 'draft' | 'production' | 'premium'`
2. **Pass** quality context to planner: `planProjectV2(prompt, designSystem, mode, qualityLevel)`
3. **Inject** quality checklist into plan

---

### 6️⃣ **`src/lib/ai/engine/design-system.ts`** 🟡 MEDIUM PRIORITY
**Current Lines**: 1-150  
**Issue Category**: Simplistic color detection (not using design token registry)

#### Problems:

```typescript
// LINE ~10-25: Naive color detection
const isRed = /red|crimson|scarlet|ruby|maroon/i.test(prompt);
const isPurple = /purple|violet|indigo/i.test(prompt);

const primaryColor = isRed ? "#DC2626"
  : isPurple ? "#8B5CF6"
  : isGreen ? "#10B981"
  : "#6366F1";  // ← Default fallback, no user preference
```

**Status**: Limited to 5 color options, no accessibility checks

#### What Needs to Change:

1. **Implement** color accessibility validation (WCAG AA minimum)
2. **Add** support for brand color extraction
3. **Generate** complementary colors from primary dynamically
4. **Integrate** with design token registry

---

### 7️⃣ **`src/lib/ai/engine/project-planner-v2.ts`** (Planner Prompts) 🟡 MEDIUM PRIORITY
**Current Lines**: 340-450  
**Issue Category**: Hardcoded Planner System Prompt (lacks quality directives)

#### Problems:

```typescript
// CURRENT prompt (line ~340-420):
// Generic instructions without quality guidance

// MISSING:
// - Code review checklist
// - Production requirements
// - Accessibility guidelines
// - Performance targets
// - Security considerations
```

#### What Needs to Change:

1. **Inject** quality checklist into prompt based on mode:
   ```typescript
   function buildPlannerSystemPrompt(mode: ModeConfig, quality: QualityLevel): string {
     let prompt = `You are a world-class React architect...`;
     
     // Add quality directives
     if (quality === 'production') {
       prompt += `\n\nPRODUCTION REQUIREMENTS:\n`;
       prompt += `- All components must have error boundaries\n`;
       prompt += `- Must include loading states\n`;
       prompt += `- Must handle edge cases\n`;
     }
     
     return prompt;
   }
   ```
2. **Add** domain-specific guidance for different project types
3. **Include** accessibility checklist (WCAG 2.1 Level AA)

---

## PART 2: NEW FILES TO CREATE (CONFIGURATION SYSTEM)

### New: `src/lib/ai/config/design-token-registry.ts` ⭐

**Purpose**: Centralized design token management

```typescript
export interface DesignTokenSet {
  id: string;
  name: string;
  projectType: string;
  primary: string;
  primaryLight: string;
  accent: string;
  bg: string;
  bgAlt: string;
  bgCard: string;
  text: string;
  textMuted: string;
  border: string;
  gradient: string;
  gradientHero: string;
  glass: string;
  glassBorder: string;
  shadow: string;
  shadowLg: string;
  radius: string;
  radiusLg: string;
  displayFont: string;
  bodyFont: string;
  animEase: string;
}

export class DesignTokenRegistry {
  private tokens: Map<string, DesignTokenSet> = new Map();
  private patterns: Array<{
    regex: RegExp;
    tokenSetId: string;
  }> = [];

  // Load from database or JSON file
  async loadTokens(): Promise<void> { }
  
  // Resolve tokens based on prompt + user overrides
  async resolveTokens(
    plan: ProjectPlan,
    userOverrides?: Partial<DesignTokenSet>
  ): Promise<DesignTokenSet> { }
  
  // Get all available token sets
  async getAllTokenSets(): Promise<DesignTokenSet[]> { }
  
  // Validate token accessibility (WCAG AA)
  validateAccessibility(tokens: DesignTokenSet): ValidationResult { }
}

export const designTokenRegistry = new DesignTokenRegistry();
```

---

### New: `src/lib/ai/config/complexity-config.ts`

**Purpose**: Centralized file count configuration

```typescript
export interface ComplexityBounds {
  target: number;
  min: number;
  max: number;
  description: string;
}

export const COMPLEXITY_BOUNDS = {
  minimal: {
    target: 2,
    min: 1,
    max: 4,
    description: "1-3 focused components"
  },
  standard: {
    target: 6,
    min: 4,
    max: 9,
    description: "4-9 well-structured components"
  },
  complex: {
    target: 8,
    min: 4,
    max: 11,
    description: "8-11 comprehensive components"
  },
  large: {
    target: 16,
    min: 13,
    max: 20,
    description: "13-20 production-grade components"
  }
};

// Allow runtime extension
export function registerCustomComplexityBounds(
  name: string,
  bounds: ComplexityBounds
): void {
  COMPLEXITY_BOUNDS[name] = bounds;
}
```

---

### New: `src/lib/ai/config/generation-budget.ts`

**Purpose**: Centralized LLM token budget configuration

```typescript
export const GENERATION_BUDGET = {
  planner: {
    maxTokens: 5000,
    temperature: 0.7,
    topP: 0.9,
    timeout: 120_000,
  },
  codegen: {
    maxTokens: 8000,
    temperature: 0.7,
    topP: 0.9,
    timeout: 120_000,
    batchSize: 2,
  },
  retries: {
    maxFileRetries: 3,
    maxRegenPerFile: 2,
    backoffMs: (attempt: number) => Math.min(1200 * Math.pow(2, attempt), 20_000),
  },
  fileSize: {
    min: 50,
    max: 14_000,
    bundleMax: 16_000,
  },
  rateLimit: {
    maxRequestsPerMinute: 10,
    windowMs: 60_000,
  },
  health: {
    modelFailureThreshold: 3,
    pingIntervalMs: 7_000,
  }
};

// Quality-level overrides
export const QUALITY_OVERRIDES = {
  draft: {
    maxTokens: 5000,
    temperature: 0.8,
    batchSize: 3,
  },
  production: {
    maxTokens: 10000,
    temperature: 0.5,
    batchSize: 2,
    maxFileRetries: 5,
  },
  premium: {
    maxTokens: 12000,
    temperature: 0.3,
    batchSize: 1,
    maxFileRetries: 6,
  }
};
```

---

### New: `src/lib/ai/config/prompt-templates.ts`

**Purpose**: Parameterized prompt templates instead of hardcoded strings

```typescript
export interface PromptContext {
  mode: ComplexityMode;
  qualityLevel: 'draft' | 'production' | 'premium';
  domain?: string;
  codeStyle?: 'functional' | 'class-based' | 'hooks';
  accessibilityLevel?: 'basic' | 'wcag-aa' | 'wcag-aaa';
  performanceTargets?: string[];
}

export function buildPlannerSystemPrompt(context: PromptContext): string {
  let prompt = `You are a world-class React architect.`;
  
  // Add quality directives
  prompt += qualityDirective(context.qualityLevel);
  
  // Add domain guidance
  if (context.domain) {
    prompt += domainGuidance(context.domain);
  }
  
  // Add accessibility requirements
  if (context.accessibilityLevel) {
    prompt += accessibilityGuidance(context.accessibilityLevel);
  }
  
  return prompt;
}

function qualityDirective(level: string): string {
  const directives = {
    draft: `
Generate quick, functional prototypes. Focus on:
- Visual completeness
- Core user flows
- Sample data
Quality checklist: ["has-basic-structure", "has-sample-data"]`,
    production: `
Generate production-ready code. Focus on:
- Error handling
- Loading states
- Edge case management
- Accessibility (WCAG AA)
- Type safety
Quality checklist: ["has-error-handling", "has-loading-states", "wcag-aa-compliant", "has-types", "has-edge-cases"]`,
    premium: `
Generate premium, highly polished code. Focus on:
- Comprehensive error handling
- Advanced loading/error UI patterns
- Complete accessibility (WCAG AAA)
- Performance optimization
- Security best practices
- Comprehensive testing strategy
Quality checklist: ["has-comprehensive-error-handling", "has-advanced-loading-ui", "wcag-aaa-compliant", "has-performance-optimization", "has-security-measures", "has-test-strategy"]`
  };
  return directives[level] || directives.draft;
}

function domainGuidance(domain: string): string {
  // Return domain-specific guidance
}

function accessibilityGuidance(level: string): string {
  // Return accessibility requirements
}
```

---

### New: `src/lib/ai/config/project-type-registry.ts`

**Purpose**: Configurable project type detection

```typescript
export interface ProjectTypeDefinition {
  id: string;
  name: string;
  keywords: RegExp[];
  designTokenSetId: string;
  defaultFileCount: ComplexityBounds;
  uiPatterns: string[];
  domainEntities: string[];
  codeStyle: 'functional' | 'class-based';
}

export const PROJECT_TYPES: Record<string, ProjectTypeDefinition> = {
  saas: {
    id: 'saas',
    name: 'SaaS Application',
    keywords: [/saas/, /dashboard/, /crm/, /admin/],
    designTokenSetId: 'saas-indigo',
    defaultFileCount: COMPLEXITY_BOUNDS.complex,
    uiPatterns: ['sidebar-nav', 'data-table', 'form-inputs', 'modal-dialogs'],
    domainEntities: ['User', 'Organization', 'Subscription'],
    codeStyle: 'functional',
  },
  // ... other types
};

export class ProjectTypeRegistry {
  detectProjectType(prompt: string): ProjectTypeDefinition {
    // Return matching project type
  }
  
  registerProjectType(type: ProjectTypeDefinition): void {
    PROJECT_TYPES[type.id] = type;
  }
}
```

---

## PART 3: UPGRADE IMPLEMENTATION STRATEGY

### Phase 1: Configuration System (Week 1)
1. Create all 4 new config files
2. Migrate hardcoded values from batch-generator, stream-pipeline, editor to config
3. Add database layer for design tokens (future-proof)
4. Write unit tests for config loading

### Phase 2: Design Token Extraction (Week 2)
1. **File**: `src/lib/ai/engine/batch-generator.ts`
   - Remove lines 207-320 (all color detection)
   - Replace with: `const tokens = await designTokenRegistry.resolveTokens(plan)`

2. **File**: `src/lib/ai/engine/project-planner-v2.ts`
   - Add call to design token registry in `planProjectV2()`

3. **File**: `src/lib/ai/stream/stream-pipeline.ts`
   - Delete all color detection logic (duplicate removal)
   - Replace with centralized call

### Phase 3: File Count Configuration (Week 2)
1. **File**: `src/lib/ai/engine/project-planner-v2.ts`
   - Replace hardcoded bounds in `detectComplexityMode()` with config lookup
   - Add `params.fileCountOverride` support

2. **File**: `src/lib/ai/stream/stream-pipeline.ts`
   - Use `COMPLEXITY_BOUNDS` from config instead of inline values

### Phase 4: Prompt Quality Enhancement (Week 3)
1. **File**: `src/lib/ai/engine/project-planner-v2.ts`
   - Replace `buildPlannerSystemPrompt()` with parameterized version
   - Add quality level injection

2. **File**: `src/lib/ai/llm/editor.ts`
   - Create `buildCodegenSystemPrompt()` function
   - Add quality + domain guidance

3. **File**: `src/lib/ai/llm/plan-project.ts`
   - Add `qualityLevel` parameter
   - Pass to planner with context

### Phase 5: Testing & Validation (Week 4)
1. Unit tests for config loading
2. Integration tests for token resolution
3. LLM prompt quality benchmarks
4. End-to-end generation tests

---

## PART 4: DETAILED UPGRADE CHECKLIST

### ✅ File-by-File Change Summary

| File | Changes | Priority | Effort |
|------|---------|----------|--------|
| `batch-generator.ts` | Remove 11x color detection blocks (~114 lines) | ⭐⭐⭐ | 4h |
| `project-planner-v2.ts` | Extract file count bounds + enhance planner prompt | ⭐⭐⭐ | 6h |
| `stream-pipeline.ts` | Remove duplicate color logic (~120 lines) + use config | ⭐⭐⭐ | 3h |
| `editor.ts` | Extract constants + enhance codegen prompt | ⭐⭐ | 4h |
| `design-system.ts` | Integrate with design token registry | 🟡 | 3h |
| `plan-project.ts` | Add quality level parameter + pass context | 🟡 | 2h |
| **NEW**: `design-token-registry.ts` | Create centralized token management | ⭐⭐⭐ | 8h |
| **NEW**: `complexity-config.ts` | Create file count configuration | ⭐⭐ | 2h |
| **NEW**: `generation-budget.ts` | Create LLM budget configuration | ⭐⭐ | 2h |
| **NEW**: `prompt-templates.ts` | Create parameterized prompts | ⭐⭐ | 5h |
| **NEW**: `project-type-registry.ts` | Create project type system | 🟡 | 4h |

**Total Estimated Effort**: 43 hours

---

## PART 5: MIGRATION EXAMPLES

### Example 1: Removing Hardcoded Colors

**BEFORE** (batch-generator.ts, line 207):
```typescript
if (isSaas) return {
  projectType: "saas",
  primary: "#6366F1",
  primaryLight: "#818CF8",
  accent: "#06B6D4",
  // ... 20 more hardcoded lines
};
```

**AFTER**:
```typescript
const tokens = await designTokenRegistry.resolveTokens(plan, {
  projectType: 'saas',
  userOverrides: params.userColors
});
```

---

### Example 2: Making File Count Configurable

**BEFORE** (project-planner-v2.ts, line 280):
```typescript
if (isMinimal && !isComplex) return {
  mode: "minimal",
  targetFileCount: 2,
  minFileCount: 1,
  maxFileCount: 4,
};
```

**AFTER**:
```typescript
if (isMinimal && !isComplex) {
  const config = COMPLEXITY_BOUNDS['minimal'];
  
  // Support override
  if (params.customFileCount) {
    config.target = params.customFileCount;
    config.max = params.customFileCount + 2;
  }
  
  return {
    mode: "minimal",
    ...config
  };
}
```

---

### Example 3: Adding Quality Directives to Prompts

**BEFORE** (project-planner-v2.ts):
```typescript
function buildPlannerSystemPrompt(mode: ModeConfig): string {
  return `You are a world-class React architect...
  Generate ${mode.targetFileCount} components...
  `;
}
```

**AFTER**:
```typescript
function buildPlannerSystemPrompt(
  mode: ModeConfig,
  qualityLevel: 'draft' | 'production' = 'standard'
): string {
  let prompt = `You are a world-class React architect...`;
  
  // Inject quality level
  if (qualityLevel === 'production') {
    prompt += `
PRODUCTION REQUIREMENTS:
- All components must have error boundaries
- Must include loading states
- Must handle null/undefined gracefully
- Must follow WCAG AA accessibility standards
- Must include prop validation
- Must include JSDoc documentation
`;
  }
  
  prompt += `Generate ${mode.targetFileCount} components...`;
  return prompt;
}
```

---

## PART 6: DATA STRUCTURE FOR DESIGN TOKENS

### Design Token Database Schema (JSON/TypeScript)

```typescript
{
  "tokens": [
    {
      "id": "saas-indigo",
      "name": "SaaS - Indigo Theme",
      "projectType": "saas",
      "colors": {
        "primary": "#6366F1",
        "primaryLight": "#818CF8",
        "primaryDark": "#4F46E5",
        "accent": "#06B6D4",
        "accentLight": "#22D3EE",
        "bg": "#030712",
        "bgAlt": "#0F172A",
        "bgCard": "#111827",
        "text": "#F9FAFB",
        "textPrimary": "#F9FAFB",
        "textSecondary": "#D1D5DB",
        "textMuted": "#6B7280",
        "border": "#1F2937",
        "success": "#10B981",
        "warning": "#F59E0B",
        "danger": "#EF4444",
        "info": "#3B82F6"
      },
      "gradients": {
        "default": "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)",
        "hero": "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%)",
        "card": "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(6,182,212,0.04) 100%)"
      },
      "effects": {
        "glass": "rgba(255,255,255,0.03)",
        "glassBorder": "rgba(255,255,255,0.08)",
        "shadow": "0 4px 24px rgba(99,102,241,0.15)",
        "shadowLg": "0 20px 60px rgba(99,102,241,0.25)"
      },
      "typography": {
        "displayFont": "'Syne', sans-serif",
        "bodyFont": "'DM Sans', sans-serif",
        "codeFont": "'Space Mono', monospace"
      },
      "animation": {
        "duration": "300ms",
        "ease": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      "spacing": {
        "xs": "0.25rem",
        "sm": "0.5rem",
        "md": "1rem",
        "lg": "1.5rem",
        "xl": "2rem",
        "2xl": "3rem"
      },
      "borderRadius": {
        "sm": "4px",
        "md": "8px",
        "lg": "12px",
        "xl": "20px",
        "full": "9999px"
      },
      "accessibility": {
        "contrastRatio": 4.5,
        "wcagLevel": "AA",
        "validated": true,
        "validatedAt": "2024-12-01T00:00:00Z"
      }
    },
    // ... more token sets
  ]
}
```

---

## PART 7: NEW API SURFACE

### Updated Function Signatures

```typescript
// OLD
function resolveTokens(plan: ProjectPlan): DesignTokens

// NEW
function resolveTokens(
  plan: ProjectPlan,
  options?: {
    userOverrides?: Partial<DesignTokenSet>,
    qualityLevel?: 'draft' | 'production' | 'premium',
    customPaletteName?: string
  }
): Promise<DesignTokenSet>

// OLD
function detectComplexityMode(prompt: string): ModeConfig

// NEW
function detectComplexityMode(
  prompt: string,
  options?: {
    fileCountOverride?: number,
    customModes?: Record<string, ModeConfig>,
    preferredMode?: ComplexityMode
  }
): ModeConfig

// OLD
function planProjectV2(
  prompt: string,
  designSystem: DesignSystem,
  onPing?: () => void
): Promise<ProjectPlan | null>

// NEW
function planProjectV2(
  prompt: string,
  designSystem: DesignSystem,
  options?: {
    mode?: ComplexityMode,
    qualityLevel?: 'draft' | 'production' | 'premium',
    domain?: string,
    onPing?: () => void
  }
): Promise<ProjectPlan | null>
```

---

## PART 8: BACKWARD COMPATIBILITY

### Strategy

1. **Keep existing functions working** with default parameters
2. **Add new optional parameters** for advanced features
3. **Use feature flags** for gradual rollout:
   ```typescript
   export const FEATURE_FLAGS = {
     USE_DESIGN_TOKEN_REGISTRY: process.env.USE_DESIGN_TOKEN_REGISTRY === 'true',
     USE_CONFIG_BASED_BUDGETS: process.env.USE_CONFIG_BASED_BUDGETS === 'true',
     ENHANCED_QUALITY_PROMPTS: process.env.ENHANCED_QUALITY_PROMPTS === 'true',
   };
   ```

4. **Provide migration guide** for users of the public API

---

## PART 9: SUCCESS METRICS

### Before Upgrade
- Hardcoded values: 200+ lines across 2 files
- Project type support: 11 static types
- File count flexibility: 0 (must modify code)
- Quality levels: 1 (default only)
- Prompt customization: 0% (all hardcoded)

### After Upgrade
- ✅ Hardcoded values: < 10 (config only)
- ✅ Project type support: 11 + unlimited custom
- ✅ File count flexibility: Fully configurable per-project
- ✅ Quality levels: 3+ (draft, production, premium)
- ✅ Prompt customization: 100% (fully parameterized)
- ✅ Code reuse: Design token logic centralized (1 location)
- ✅ User overrides: Colors, file counts, prompts all customizable
- ✅ Database-ready: Can migrate to database without code changes

---

## PART 10: ROLLOUT SCHEDULE

### Week 1-2: Setup
- [ ] Create all config files
- [ ] Write config loading logic
- [ ] Set up feature flags
- [ ] Add unit tests for config

### Week 2-3: Extraction
- [ ] Migrate design tokens to registry
- [ ] Migrate file count bounds to config
- [ ] Migrate LLM budgets to config
- [ ] Remove duplicate code

### Week 3-4: Enhancement
- [ ] Add quality level directives to planner prompt
- [ ] Add domain guidance to prompts
- [ ] Add accessibility requirements
- [ ] Create prompt template system

### Week 4-5: Testing
- [ ] Integration tests
- [ ] LLM output quality benchmarks
- [ ] Feature flag validation
- [ ] Backward compatibility tests

### Week 5-6: Deployment
- [ ] Deploy feature flags (disabled)
- [ ] Monitor for issues
- [ ] Enable for beta users
- [ ] Full rollout with feature flags enabled

---

## PART 11: RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM output quality degradation | High | A/B test new prompts, keep old system available |
| Prompt overrides break generation | Medium | Validate prompt syntax before sending to LLM |
| Config loading performance | Medium | Cache loaded config in-memory, lazy load |
| Database migration complexity | Medium | Keep file-based config as fallback |
| API breaking changes | High | Use feature flags, gradual deprecation |

---

## PART 12: LONG-TERM ROADMAP

### Phase 2 (Post-MVP)
- [ ] UI Panel for design token management
- [ ] Database migration for tokens
- [ ] Admin dashboard for prompt templates
- [ ] A/B testing framework for prompts
- [ ] User-uploaded brand guidelines integration
- [ ] AI-generated design tokens from images

### Phase 3 (Advanced)
- [ ] Machine learning for optimal file count prediction
- [ ] Prompt auto-optimization based on generation success
- [ ] Multi-language support for prompts
- [ ] User preference learning (personalized defaults)

---

## CONCLUSION

**This upgrade transforms the AI Builder from a static, hardcoded system into a flexible, configurable platform that can evolve without code changes.**

By centralizing hardcoded values into configuration files and adding quality-level directives to prompts, users will have full control over generation parameters and output quality, enabling production-level code generation for diverse use cases.

**All changes maintain backward compatibility while opening the door to advanced features and database integration in future phases.**

---

**Document Version**: 1.0  
**Last Updated**: April 2026  
**Status**: Ready for implementation
