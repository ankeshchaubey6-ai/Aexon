// src/components/modules/ai-builder/explorer/FileExplorer.tsx (FINAL - active file selection)
"use client";

import React from "react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { cn } from "@/lib/utils";

const FileExplorer: React.FC = () => {
  const { files, activeFilePath, setActiveFile } =
    useAIBuilderStore();

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b text-sm font-medium">
        Files
      </div>

      <div className="flex-1 overflow-auto p-2 text-xs">
        {files.length === 0 ? (
          <div className="text-muted-foreground">
            No files generated yet.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => setActiveFile(file.path)}
                className={cn(
                  "text-left px-2 py-1 rounded border transition",
                  activeFilePath === file.path
                    ? "bg-primary text-white border-primary"
                    : "hover:bg-muted border-transparent hover:border-border"
                )}
                title={file.path}
              >
                {file.path}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;