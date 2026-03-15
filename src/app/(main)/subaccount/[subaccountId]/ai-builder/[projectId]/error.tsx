// src/app/(main)/subaccount/[subaccountId]/ai-builder/[projectId]/error.tsx
"use client";

import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

const Error = ({ error, reset }: ErrorProps) => {
  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-4 p-10 text-center">
      <h2 className="text-xl font-semibold">
        AI Builder Workspace Error
      </h2>

      <p className="text-sm text-muted-foreground max-w-md">
        {error?.message ||
          "Something went wrong while loading the AI Builder."}
      </p>

      <Button variant="outline" onClick={reset}>
        Retry Workspace
      </Button>
    </div>
  );
};

export default Error;