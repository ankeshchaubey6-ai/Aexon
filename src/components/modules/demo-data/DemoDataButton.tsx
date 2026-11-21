"use client";

import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { seedAgencyDemoData } from "@/queries/demo-data";

export default function DemoDataButton() {
  const [isPending, setIsPending] = useState(false);

  const handleSeed = async () => {
    setIsPending(true);

    try {
      const { counts } = await seedAgencyDemoData();
      const created = Object.values(counts).reduce(
        (total, count) => total + count,
        0
      );

      if (created === 0) {
        toast.success("Demo records already exist; no data was changed.");
        return;
      }

      toast.success(
        `${created} demonstration records added. Existing records were left unchanged.`
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not add demonstration data."
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleSeed}
      disabled={isPending}
      aria-label="Add demonstration data to this agency"
      className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Database className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {isPending ? "Adding demo data..." : "Add demo data"}
    </Button>
  );
}
