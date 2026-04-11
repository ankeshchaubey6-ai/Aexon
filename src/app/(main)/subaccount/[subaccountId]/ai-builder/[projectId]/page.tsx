// src/app/(main)/subaccount/[subaccountId]/ai-builder/[projectId]/page.tsx
//
// FIX: height was `calc(100vh - 64px)` which collapses to 0 inside the
// subaccount shell layout that already sets its own full-height flex container.
// Use `h-full` instead — the layout wrapper provides the correct height.

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
        permission.access && permission.subAccountId === subaccountId
    );
    if (!hasPermission) {
      redirect("/subaccount/unauthorized");
    }
  }

  // FIX: `h-full` — the layout shell (sidebar + main content area) is already
  // a flex column with `flex-1 overflow-hidden`. Use `h-full` so AIWorkspace
  // fills whatever height the shell provides, rather than trying to subtract
  // a hardcoded offset that may differ across layout nesting levels.
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <AIWorkspace />
    </div>
  );
};

export default AIProjectPage;