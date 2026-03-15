// src/components/modules/ai-builder/preview/PreviewPanel.tsx (FINAL - dynamic preview call)
"use client";

import React, { useState } from "react";
import RuntimeStatus from "./RuntimeStatus";
import DeviceToggle from "./DeviceToggle";
import PreviewErrorOverlay from "./PreviewErrorOverlay";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useParams } from "next/navigation";

const PreviewPanel: React.FC = () => {
  const { projectId } = useAIBuilderStore();
  const params = useParams();
  const subaccountId = params?.subaccountId as string;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadPreview = async () => {
    if (!projectId) return;

    try {
      const res = await fetch("/api/ai/preview", {
        method: "POST",
        body: JSON.stringify({
          subaccountId,
          projectId,
        }),
      });

      const data = await res.json();
      if (data?.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
    } catch (e) {
      console.error("Preview load failed", e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">
          Live Preview
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPreview}
            className="text-xs px-2 py-1 border rounded hover:bg-muted"
            disabled={!projectId}
          >
            Refresh
          </button>
          <DeviceToggle />
        </div>
      </div>

      <div className="flex-1 relative bg-muted/20">
        {previewUrl ? (
          <iframe
            title="preview"
            className="w-full h-full border-0 bg-white"
            src={previewUrl}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Generate a project and click Refresh to load preview.
          </div>
        )}
        <PreviewErrorOverlay />
      </div>

      <RuntimeStatus />
    </div>
  );
};

export default PreviewPanel;