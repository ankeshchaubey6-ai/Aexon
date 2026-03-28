"use client";

import { useEffect, useRef, useState } from "react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";

const LivePreview = () => {
  const { files } = useAIBuilderStore();
  const { mountAndRun, writeFiles, url, status } = useWebContainer();

  const [iframeKey, setIframeKey] = useState(0);

  // Track whether the container has been fully booted and the dev server is up
  const isBootedRef = useRef(false);

  // Track the last set of files we mounted/wrote so we can diff
  const prevFilesRef = useRef<typeof files>([]);

  // =========================
  // 🚀 INITIAL BOOT
  // Only runs once when the first batch of files arrives
  // =========================
  useEffect(() => {
    if (!files.length || isBootedRef.current) return;

    isBootedRef.current = true;
    prevFilesRef.current = files;
    mountAndRun(files);
  }, [files]);

  // =========================
  // ✏️ HOT FILE UPDATE
  // Runs on every subsequent files change after boot.
  // Writes only changed/new files — Vite HMR handles the rest.
  // =========================
  useEffect(() => {
    // Skip if container isn't booted yet or there are no files
    if (!isBootedRef.current || !files.length) return;

    // Skip the very first run (handled by the boot effect above)
    const prev = prevFilesRef.current;
    if (prev === files) return;

    // Find files that actually changed or are new
    const prevMap = new Map(prev.map((f) => [f.path, f.content]));
    const changedFiles = files.filter(
      (f) => prevMap.get(f.path) !== f.content
    );

    if (changedFiles.length === 0) return;

    console.log(
      `✏️ Writing ${changedFiles.length} changed file(s):`,
      changedFiles.map((f) => f.path)
    );

    prevFilesRef.current = files;
    writeFiles(changedFiles);
  }, [files]);

  // Refresh iframe when URL first becomes available
  useEffect(() => {
    if (url) {
      setIframeKey((prev) => prev + 1);
    }
  }, [url]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b text-sm font-medium">
        Preview ({status})
      </div>

      {url ? (
        <iframe
          key={iframeKey}
          className="flex-1 w-full"
          src={url}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {status || "Booting container..."}
        </div>
      )}
    </div>
  );
};

export default LivePreview;