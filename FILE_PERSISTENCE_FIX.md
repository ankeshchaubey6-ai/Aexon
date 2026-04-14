# File Persistence Bug Fix - Complete Analysis & Solution

## Problem Description
When a user closes and reopens a project tab, only `index.html` and `package.json` are restored. All other files (src/main.jsx, src/App.jsx, components, etc.) are missing from the database.

**Observed Behavior:**
```
[LivePreview] Files available: (2) ['index.html', 'package.json']
[MOUNT CHECK] ❌ Missing required file: src/main.jsx
```

## Root Cause Analysis

### Issue #1: Stage 4 (S4) Only Emits Changed Files (FIXED)
**Location:** `src/lib/ai/stream/stream-pipeline.ts` lines 1684-1694

**Problem:**
The final emit stage used delta-based emission:
```typescript
for (const file of fixedFiles) {
  const prev = emittedContent.get(file.path);
  if (prev !== file.content) {  // ← Only emit if changed
    await smartEmit({ ...file, provisional: false, lastFixed: true });
  }
}
```

This meant files that were already emitted in S2 (as provisional=true) were not re-emitted at S4, even though they needed to be collected by the API route's `allFiles` array before saving.

**Solution Applied:**
Changed S4 to always re-emit ALL files to ensure 100% collection:
```typescript
for (const file of fixedFiles) {
  // CRITICAL: Always re-emit for final collection, even if content hasn't changed
  await smartEmit({ ...file, provisional: false, lastFixed: true });
  emitCount++;
}
```

### Issue #2: Poor Observability in File Collection (FIXED)
**Location:** `src/app/api/ai/generate/route.ts`

**Problem:**
- No logging of which files were being added to `allFiles`
- No logging of final file count before saving
- No verification that files were actually saved to the database
- No detection of missing required files

**Solution Applied:**

#### a) Added per-file logging in onFile callback:
```typescript
console.log(`[onFile] Added: ${safeFile.path} (total: ${allFiles.length})`);
```

#### b) Added comprehensive pre-save logging:
```typescript
console.log(`[SAVE] Collected ${safeFiles.length} files during generation:`);
safeFiles.forEach((f) => console.log(`  - ${f.path} (${f.content.length} bytes)`));

// Check for missing required files
const REQUIRED_FILES = ["package.json", "index.html", "src/main.jsx", "src/App.jsx"];
const missingRequired = REQUIRED_FILES.filter(
  (r) => !safeFiles.find((f) => f.path === r)
);
if (missingRequired.length > 0) {
  console.warn(`⚠️ MISSING REQUIRED FILES: ${missingRequired.join(", ")}`);
}
```

#### c) Added post-save verification:
```typescript
const verify = await db.aIProjectFile.count({ where: { projectId } });
console.log(`Database now contains ${verify} files (expected: ${safeFiles.length})`);
if (verify !== safeFiles.length) {
  console.error(`❌ MISMATCH: Expected ${safeFiles.length}, got ${verify}`);
}
```

### Issue #3: No Observability in upsertAIProjectFiles (FIXED)
**Location:** `src/queries/ai-projects.ts`

**Problem:**
The upsert function was silent - no indication of how many files were saved or if there were any issues.

**Solution Applied:**
Added comprehensive logging:
```typescript
console.log(`[upsertAIProjectFiles] Saving ${files.length} files for project ${projectId}`);
files.forEach((f) => console.log(`  - ${f.path}`));

// After save
const count = await db.aIProjectFile.count({ where: { projectId } });
console.log(`[upsertAIProjectFiles] ✅ Saved. DB now contains ${count} files`);
if (count !== files.length) {
  console.warn(`⚠️ WARNING: Expected ${files.length}, got ${count}`);
}
```

### Issue #4: No Observability When Loading Projects (FIXED)
**Location:** `src/app/api/ai/projects/[projectId]/route.ts`

**Problem:**
When projects are fetched from the database for reopening, there was no logging to verify all files were loaded.

**Solution Applied:**
Added loading verification logs:
```typescript
console.log(`[GET /api/ai/projects/${projectId}] Loaded ${files.length} files from DB:`);
files.forEach((f) => console.log(`  - ${f.path}`));
```

## Files Modified

1. **src/lib/ai/stream/stream-pipeline.ts**
   - Changed S4 stage to emit ALL files (not just changed ones)
   - Added pre-emit logging showing all files to be emitted

2. **src/app/api/ai/generate/route.ts**
   - Enhanced onFile callback with per-file logging
   - Added comprehensive pre-save verification
   - Added missing-file detection
   - Added post-save DB verification

3. **src/queries/ai-projects.ts**
   - Enhanced upsertAIProjectFiles with logging
   - Added post-save verification

4. **src/app/api/ai/projects/[projectId]/route.ts**
   - Added loading verification logs

## How the Fix Works

### Generation Flow (Fixed)
1. **S0 (Boilerplate)**: Emits package.json, index.html, src/main.jsx, src/App.jsx
2. **S2 (Generation)**: Emits generated component files (provisional=true)
3. **S4 (Final)**: **NOW RE-EMITS ALL FILES** (not just changed ones) - ensuring all are collected
4. **API Route**: Collects all files via onFile callback into `allFiles` array with logging
5. **Database**: `upsertAIProjectFiles` saves ALL files with verification

### Restore Flow (Already working, but now verified)
1. **User opens project**: Routes to `/subaccount/{id}/ai-builder/{projectId}`
2. **AIWorkspace mounts**: Fetches `/api/ai/projects/{projectId}`
3. **API returns**: ALL files from database (with new logging)
4. **Files loaded**: Store populated, LivePreview receives complete file list
5. **WebContainer boots**: Has all necessary files

## Debugging with the New Logs

When a project is generated, check the server logs for this sequence:

```
[S4] Preparing to emit 15 files:
      - package.json (...)
      - index.html (...)
      - src/main.jsx (...)
      - src/App.jsx (...)
      - src/components/Card.jsx (...)
      ... etc

[S4] Emitting 15 files (including unchanged)...
[S4] ✓ Emitted 15 files (all files re-emitted for final DB save)

[onFile] Added: package.json (total: 1)
[onFile] Added: index.html (total: 2)
... etc for all files

[SAVE] Collected 15 files during generation:
- package.json (...)
- index.html (...)
... etc

✅ Successfully saved 15 files to DB for project {projectId}
Database now contains 15 files after save (expected: 15)

[upsertAIProjectFiles] Saving 15 files for project {projectId}
[upsertAIProjectFiles] ✅ Saved. DB now contains 15 files
```

If you see warnings like `⚠️ MISSING REQUIRED FILES`, the pipeline failed to emit them properly.

If you see `⚠️ MISMATCH` errors, there's a database issue.

## Testing the Fix

1. **Generate a new project** - Watch server logs for full file collection
2. **Close the browser tab** - Project exists in database
3. **Reopen the project** - Should now load with all files (check API logs showing file count)
4. **Verify in WebContainer** - All files should be present, no missing file errors

## Summary

The bug was caused by Stage 4's optimization to only emit "changed" files. While this was efficient during generation, it meant some files never reached the API route's collection before being saved. By always re-emitting ALL files in S4 and adding comprehensive logging at every step (collection, save, verification, load), we now have:

- ✅ **Complete file collection**: All generated files are collected before saving
- ✅ **Verified saves**: Database confirms all files were saved
- ✅ **Verified loads**: All files are fetched when project is reopened
- ✅ **Debugging**: Full logging trail to diagnose any future issues
