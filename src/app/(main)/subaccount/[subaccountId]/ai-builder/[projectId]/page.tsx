// src/app/(main)/subaccount/[subaccountId]/ai-builder/[projectId]/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import AIWorkspace from "@/components/modules/ai-builder/layout/AIWorkspace";

interface AIProjectPageProps {
  params: {
    subaccountId: string;
    projectId: string;
  };
}

const AIProjectPage = async ({ params }: AIProjectPageProps) => {
  const { subaccountId, projectId } = params;

  if (!subaccountId || !projectId) {
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

  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <AIWorkspace />
    </div>
  );
};

export default AIProjectPage;