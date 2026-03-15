// src/components/modules/ai-builder/preview/PreviewErrorOverlay.tsx (FINAL - debug overlay)
"use client";

import React from "react";

const PreviewErrorOverlay: React.FC = () => {
  return (
    <div className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/90 backdrop-blur px-2 py-1 rounded border shadow-sm">
      Sandbox: Active
    </div>
  );
};

export default PreviewErrorOverlay;