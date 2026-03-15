// src/components/modules/ai-builder/layout/AITabs.tsx (FINAL - cleaner production tabs)
"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AITabs: React.FC = () => {
  return (
    <div className="border-b px-4 bg-background">
      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="h-10">
          <TabsTrigger value="builder">
            Builder
          </TabsTrigger>
          <TabsTrigger value="files">
            Files
          </TabsTrigger>
          <TabsTrigger value="preview">
            Preview
          </TabsTrigger>
          <TabsTrigger value="logs">
            Logs
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default AITabs;