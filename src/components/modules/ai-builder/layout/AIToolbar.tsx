// src/components/modules/ai-builder/layout/AIToolbar.tsx (FINAL - API wired)
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useParams } from "next/navigation";

const AIToolbar: React.FC = () => {
  const { projectId } = useAIBuilderStore();
  const params = useParams();
  const subaccountId = params?.subaccountId as string;
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!projectId) return;
    setLoading(true);

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
        window.open(data.previewUrl, "_blank");
      }
    } catch (e) {
      console.error("Preview failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!projectId) return;
    setLoading(true);

    try {
      const res = await fetch("/api/ai/export-zip", {
        method: "POST",
        body: JSON.stringify({
          subaccountId,
          projectId,
        }),
      });

      const data = await res.json();

      if (data?.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full border-b px-4 py-3 flex items-center justify-between bg-background">
      <h2 className="text-sm font-semibold">
        AI Builder Workspace
      </h2>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={!projectId || loading}
        >
          Preview
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!projectId || loading}
        >
          Export ZIP
        </Button>

        <Button size="sm" disabled={!projectId}>
          Deploy
        </Button>
      </div>
    </div>
  );
};
export default AIToolbar;