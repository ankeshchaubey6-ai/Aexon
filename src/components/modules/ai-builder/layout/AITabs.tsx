// src/components/modules/ai-builder/layout/AITabs.tsx
"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AITabsProps {
  defaultValue?: "builder" | "files" | "preview" | "logs";
  onValueChange?: (value: string) => void;
  className?: string;
}

/**
 * AITabs – Production‑ready tab switcher for the AI Builder.
 * Built on shadcn/ui Tabs for accessibility and keyboard navigation.
 */
const AITabs: React.FC<AITabsProps> = ({
  defaultValue = "builder",
  onValueChange,
  className,
}) => {
  return (
    <div className={className}>
      <Tabs defaultValue={defaultValue} onValueChange={onValueChange} className="w-full">
        <TabsList className="h-10 bg-transparent p-0 gap-2">
          <TabsTrigger
            value="builder"
            className="data-[state=active]:bg-muted data-[state=active]:shadow-none"
          >
            Builder
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="data-[state=active]:bg-muted data-[state=active]:shadow-none"
          >
            Files
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="data-[state=active]:bg-muted data-[state=active]:shadow-none"
          >
            Preview
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="data-[state=active]:bg-muted data-[state=active]:shadow-none"
          >
            Logs
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default AITabs;