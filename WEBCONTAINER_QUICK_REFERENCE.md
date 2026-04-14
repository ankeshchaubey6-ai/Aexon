# WebContainer Snapshot Fix — Quick Reference & Testing

## ✅ WHAT WAS FIXED

### Problem
```
ERROR: "@esbuild/win32-x64 present but @esbuild/linux-x64 required"
```
Vite dev server crashes in WebContainer due to wrong binaries.

### Root Cause
npm install defaulted to Windows platform → included win32 binaries → WebContainer (Linux) couldn't find linux-x64.

### Solution
- **Build-time**: Force npm install with `--platform=linux --arch=x64`
- **Cleanup**: Remove non-Linux binaries before snapshot generation
- **Validation**: Fail if anything except linux-x64 found
- **Runtime**: Validate snapshot has correct binaries
- **No hacks**: Removed ESBUILD_BINARY_PATH workaround

---

## 📋 FILES CHANGED

### 1. scripts/build-snapshot.js (v7.0)
**Status**: ✅ Production Ready

**Changes**:
- npm install now uses `--platform=linux --arch=x64`
- Added filesystem cleanup for non-Linux esbuild binaries
- Added strict post-build validation
- Added optional dependency filtering
- Enhanced logging with platform detection
- Final validation report

### 2. src/components/modules/ai-builder/state/use-webcontainer.ts
**Status**: ✅ Production Ready

**Changes**:
- ❌ REMOVED: ESBUILD_BINARY_PATH hack
- ✅ ADDED: Strict snapshot validation for linux-x64
- ✅ ADDED: Detection of non-Linux binaries
- ✅ ADDED: Clear error messages

### 3. WEBCONTAINER_SNAPSHOT_FIX.md (NEW)
Comprehensive documentation of the entire fix.

---

## 🧪 TESTING CHECKLIST

### Test 1: Verify Snapshot Doesn't Contain Windows Binaries
```powershell
# At project root:
# Should return NOTHING
Select-String -Pattern "win32" public/sandbox/snapshot/node_modules.json

# Should return NOTHING  
Select-String -Pattern "darwin" public/sandbox/snapshot/node_modules.json

# Should return results with linux-x64
Select-String -Pattern "linux-x64" public/sandbox/snapshot/node_modules.json
```

**Expected**: 
- win32 search: 0 results
- darwin search: 0 results
- linux-x64 search: Multiple results

### Test 2: Rebuild Snapshot with Proper Output
```bash
cd c:\Projects\Aexon
node scripts/build-snapshot.js
```

**Expected output includes**:
```
Step 0c: Cleaning non-Linux esbuild binaries from filesystem...
  [DETECTION] Reading @esbuild directory:
  ✅ Found correct platform: @esbuild/linux-x64

Step 5: Strict validation (ONLY linux-x64 esbuild)...
  ✓ Only @esbuild/linux-x64 present (no other platforms)

📊 FINAL SNAPSHOT VALIDATION REPORT
===================================
✅ ESBUILD BINARIES:
  ✓ @esbuild/linux-x64 PRESENT
  ✓ No invalid platforms (win32, darwin, etc.)

✅ Snapshot built successfully for WebContainer (Linux x64)
```

### Test 3: Runtime Validation (Manual)

When you start a WebContainer session in the application:

**Open browser console and look for**:
```
[WC][SNAPSHOT] ✅ @esbuild/linux-x64 validated
[WC][SNAPSHOT] ✓ node_modules mounted
```

**Should NOT see**:
```
❌ INVALID: Found non-Linux esbuild binaries
ESBUILD_BINARY_PATH injected
```

### Test 4: Live Preview Works
1. Open AI Builder
2. Generate or load a project
3. Verify Vite dev server starts
4. Make a code change
5. Changes should render in real-time

**Expected**: 
- No esbuild/platform errors
- Live preview updates work
- Console shows normal Vite output

---

## 🔍 DEBUG: How to Inspect Snapshot

### View esbuild binaries in snapshot
```bash
# Show structure of @esbuild in snapshot
$content = Get-Content public/sandbox/snapshot/node_modules.json | ConvertFrom-Json
$esbuild = $content.node_modules.directory."@esbuild".directory
$esbuild | Get-Member -Type NoteProperty | Select-Object -ExpandProperty Name
```

**Expected output**: 
```
linux-x64
```

Nothing else!

### Check snapshot size
```powershell
ls -lh public/sandbox/snapshot/node_modules.json
```

### View full snapshot structure (first level)
```bash
$content = Get-Content public/sandbox/snapshot/node_modules.json | ConvertFrom-Json
$content.node_modules.directory | Get-Member -Type NoteProperty | Select-Object -ExpandProperty Name | Sort-Object
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying:

- [ ] Rebuild snapshot: `node scripts/build-snapshot.js`
- [ ] Check console output for "✅ Snapshot built successfully"
- [ ] Verify win32 not in snapshot: `Select-String -Pattern "win32" public/sandbox/snapshot/node_modules.json`
- [ ] Verify linux-x64 in snapshot: `Select-String -Pattern "linux-x64" public/sandbox/snapshot/node_modules.json`
- [ ] Test live preview in WebContainer
- [ ] Verify browser console shows runtime validation success
- [ ] Clear any browser cache if needed

---

## ⚠️ TROUBLESHOOTING

### Issue: Vite crashes with "@esbuild/win32-x64 present"

**Solution**:
1. Delete public/sandbox/snapshot/node_modules.json
2. Run: `node scripts/build-snapshot.js`
3. Check output for validation errors
4. Clear browser cache completely
5. Reload WebContainer

### Issue: Snapshot validation fails at runtime

**Solution**:
1. Check browser console for specific error message
2. Rebuild snapshot
3. Check build log for "Found wrong platform"
4. If persists, check node_modules on disk for stray binaries:
   ```powershell
   ls -Recurse sandbox-templates/vite-react-base/node_modules/@esbuild/
   ```

### Issue: Sandbox template node_modules missing

**Solution**:
1. Install dependencies in template:
   ```bash
   cd sandbox-templates/vite-react-base
   npm install --platform=linux --arch=x64
   ```
2. Rebuild snapshot:
   ```bash
   cd ..\..\
   node scripts/build-snapshot.js
   ```

---

## 📚 UNDERSTANDING THE FIX

### Why --platform=linux --arch=x64?
- npm's `--platform` and `--arch` flags tell it what OS/architecture you're targeting
- Without them, npm uses your machine's platform (Windows)
- This causes it to download win32 binaries instead of linux-x64
- WebContainer runs on Linux x64, so it needs the linux-x64 binaries

### Why remove binaries after install?
- Belt and suspenders approach
- Even with correct flags, some packages might ship extra binaries
- Explicit removal ensures snapshot only has what's needed
- Cleaner, more deterministic

### Why runtime validation?
- Defense in depth (layered validation)
- Catches corrupted snapshots before they crash WebContainer
- Clear error messages help with troubleshooting
- Shows validation succeeded in logs

### Why no ESBUILD_BINARY_PATH hack?
- The hack was masking the real problem (wrong binary in snapshot)
- Runtime workarounds are fragile and hard to debug
- Better to fix at build time (the root cause)
- Production code should be clean and deterministic

---

## 📞 SUPPORT

If the fix doesn't work:

1. **Check the detailed documentation**:
   - File: `WEBCONTAINER_SNAPSHOT_FIX.md`

2. **Review build output carefully**:
   - Look for cleanup/validation steps
   - Check for any errors or warnings

3. **Inspect the snapshot directly**:
   - Use the debug commands above
   - Verify linux-x64 is only binary

4. **Clear all cache**:
   - Browser cache, service workers, local storage
   - Rebuild snapshot from scratch

---

**Version**: 1.0
**Last Updated**: April 2026
**Status**: ✅ Production Ready
