// src/lib/ai/stream/stream-pipeline.ts

import { planProject } from "@/lib/ai/llm/pipeline";
import { generateOneFile, type ProjectSpec, type FileSpec } from "@/lib/ai/llm/deepseek-generator";

type FileType = {
  path: string;
  content: string;
};

// ─────────────────────────────────────────────────────────────
// FIXED STREAM PIPELINE
//
// Root cause of ERR_INVALID_STATE + premature close:
// The original 3-worker approach used queue.shift() in a while loop
// across concurrent async workers — a classic race where all 3 workers
// see an empty queue simultaneously and Promise.all resolves BEFORE
// the last generateOneFile call actually completes.
//
// Fix: use a proper atomic index counter instead of shift(), so each
// file slot is claimed exactly once. Workers pick the next unclaimed
// index atomically. Promise.all only resolves after ALL workers exit,
// which is only after ALL files are processed.
// ─────────────────────────────────────────────────────────────

const CONCURRENCY = 3;

export async function streamProjectPipeline({
  prompt,
  onFile,
  onDone,
}: {
  prompt: string;
  onFile: (file: FileType) => Promise<void>;
  onDone: () => void;
}) {
  console.log("🚀 [STREAM PIPELINE] Starting for prompt:", prompt.slice(0, 60));

  const spec = await planProject(prompt);

  if (!spec || !spec.files || spec.files.length === 0) {
    console.error("❌ [STREAM PIPELINE] Planning returned null or empty files");
    onDone();
    return;
  }

  console.log(`✅ [STREAM PIPELINE] Plan has ${spec.files.length} files`);

  const allPaths = spec.files.map((f) => f.path);
  const files = spec.files;
  const total = files.length;

  // ✅ Atomic index — each worker claims the next unclaimed slot
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      // Claim the next file atomically
      const idx = nextIndex++;
      if (idx >= total) break;

      const fileSpec: FileSpec = files[idx];

      try {
       async function generateWithRetry(
  spec: ProjectSpec,
  fileSpec: FileSpec,
  allPaths: string[],
  retries = 2
) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await generateOneFile(spec, fileSpec, allPaths);
    } catch (err) {
      console.warn(`⚠️ Retry ${i + 1} for ${fileSpec.path}`);
      if (i === retries) throw err;
    }
  }
}
const generated = await generateWithRetry(spec as ProjectSpec, fileSpec, allPaths);
       // 🔒 Ensure file is valid BEFORE emitting
if (
  !generated?.content ||
  generated.content.trim().length < 20
) {
  console.error(`❌ Skipping invalid file: ${fileSpec.path}`);
  return;
}

// Optional: enforce critical files must exist
if (fileSpec.path === "src/App.jsx" && !generated.content.includes("export default")) {
  console.error("❌ App.jsx invalid — skipping");
  return;
}

await onFile({
  path: generated.path,
  content: generated.content,
});

        console.log(`📄 [STREAM PIPELINE] Generated: ${generated.path}`);
      } catch (err) {
        console.error(`❌ [STREAM PIPELINE] Failed to generate ${fileSpec.path}:`, err);
        // Don't rethrow — let other files continue
      }
    }
  };

  // Run CONCURRENCY workers, all sharing the same atomic index
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log("✅ [STREAM PIPELINE] All files done");
  onDone();
}