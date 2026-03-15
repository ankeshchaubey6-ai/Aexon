// src/components/modules/ai-builder/chat/MessageList.tsx (FINAL - basic message history ready)
"use client";

import React from "react";

const MessageList: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-md border p-2 bg-muted/40">
        <span className="font-medium">AI:</span>{" "}
        Describe the app (e.g. "SaaS landing page with pricing and auth")
        and I will generate the full project structure, files, and preview.
      </div>
    </div>
  );
};

export default MessageList;