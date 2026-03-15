// src/components/modules/ai-builder/preview/DeviceToggle.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";

const DeviceToggle: React.FC = () => {
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline">
        Desktop
      </Button>
      <Button size="sm" variant="outline">
        Mobile
      </Button>
    </div>
  );
};

export default DeviceToggle;