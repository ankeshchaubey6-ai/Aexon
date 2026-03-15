// src/components/modules/ai-builder/editor/MonacoEditor.tsx (FINAL - active file driven editor)
"use client";

import React, { useEffect, useState } from "react";
import { useAIBuilderStore } from "../state/ai-builder.store";

const MonacoEditor: React.FC = () => {
  const {
    files,
    activeFilePath,
    updateFile,
  } = useAIBuilderStore();

  const activeFile = files.find(
    (f) => f.path === activeFilePath
  );

  const [content, setContent] = useState("");

  useEffect(() => {
    if (activeFile) {
      setContent(activeFile.content);
    } else {
      setContent("");
    }
  }, [activeFilePath, activeFile?.content]);

  const handleChange = (val: string) => {
    setContent(val);
    if (activeFilePath) {
      updateFile(activeFilePath, val);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b text-sm font-medium flex items-center justify-between">
        <span>Code Editor</span>
        <span className="text-xs text-muted-foreground">
          {activeFilePath || "No file selected"}
        </span>
      </div>

      <div className="flex-1 p-3">
        {activeFile ? (
          <textarea
            className="w-full h-full rounded-md border bg-background p-3 text-xs font-mono outline-none resize-none"
            value={content}
            onChange={(e) =>
              handleChange(e.target.value)
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Generate a project and select a file to start editing.
          </div>
        )}
      </div>
    </div>
  );
};

export default MonacoEditor;