// src/components/modules/ai-builder/preview/RuntimeStatus.tsx (FINAL - production ready)
"use client";

import React from "react";
import { useWebContainer } from "../state/use-webcontainer";

const RuntimeStatus: React.FC = () => {
  const { status } = useWebContainer();

  const color =
    status === "ready"
      ? "text-green-600"
      : status === "booting"
      ? "text-yellow-600"
      : status === "error"
      ? "text-red-600"
      : "text-muted-foreground";

  return (
    <div className="border-t px-3 py-2 text-xs flex items-center justify-between">
      <span className="text-muted-foreground">
        Runtime Status
      </span>
      <span className={color}>{status}</span>
    </div>
  );
};

export default RuntimeStatus;