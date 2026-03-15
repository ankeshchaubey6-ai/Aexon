// src/app/(main)/subaccount/[subaccountId]/ai-builder/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AIBuilderPageProps {
  params: {
    subaccountId: string;
  };
}

const AIBuilderPage = async ({ params }: AIBuilderPageProps) => {
  const { subaccountId } = params;

  if (!subaccountId) {
    redirect("/subaccount/unauthorized");
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    redirect("/agency/sign-in");
  }

  const authUser = await getAuthUserDetails();
  if (!authUser || !authUser.agency) {
    redirect("/agency/sign-in");
  }

  const role = clerkUser.privateMetadata.role as Role | undefined;
  if (!role) {
    redirect("/subaccount/unauthorized");
  }

  const isOwnerOrAdmin =
    role === Role.AGENCY_OWNER || role === Role.AGENCY_ADMIN;

  if (!isOwnerOrAdmin) {
    const hasPermission = authUser.permissions.find(
      (permission) =>
        permission.access &&
        permission.subAccountId === subaccountId
    );

    if (!hasPermission) {
      redirect("/subaccount/unauthorized");
    }
  }

  const newProjectId = crypto.randomUUID();

  return (
    <div className="w-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Builder
          </h1>
          <p className="text-muted-foreground">
            Generate, edit and deploy AI apps inside this subaccount.
          </p>
        </div>

        <Link
          href={`/subaccount/${subaccountId}/ai-builder/${newProjectId}`}
        >
          <Button>Create New Project</Button>
        </Link>
      </div>

      <div className="rounded-xl border bg-background p-10 flex flex-col items-center justify-center text-center gap-3">
        <h2 className="text-lg font-semibold">
          No AI Projects Yet
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Start by creating a new AI project. The builder will
          generate files, live preview, and editable code workspace.
        </p>

        <Link
          href={`/subaccount/${subaccountId}/ai-builder/${newProjectId}`}
        >
          <Button size="lg" className="mt-2">
            Launch AI Builder
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default AIBuilderPage;