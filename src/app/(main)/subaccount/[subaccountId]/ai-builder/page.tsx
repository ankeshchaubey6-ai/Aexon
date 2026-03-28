// src/app/(main)/subaccount/[subaccountId]/ai-builder/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { getAuthUserDetails } from "@/queries/auth";
import { db } from "@/lib/db";
import AIBuilderClient from "./AIBuilderClient";

interface AIBuilderPageProps {
  params: { subaccountId: string };
}

const AIBuilderPage = async ({ params }: AIBuilderPageProps) => {
  const { subaccountId } = params;

  if (!subaccountId) redirect("/subaccount/unauthorized");

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/agency/sign-in");

  const authUser = await getAuthUserDetails();
  if (!authUser || !authUser.agency) redirect("/agency/sign-in");

  const role = clerkUser.privateMetadata.role as Role | undefined;
  if (!role) redirect("/subaccount/unauthorized");

  const isOwnerOrAdmin =
    role === Role.AGENCY_OWNER || role === Role.AGENCY_ADMIN;

  if (!isOwnerOrAdmin) {
    const hasPermission = authUser.permissions.find(
      (p) => p.access && p.subAccountId === subaccountId
    );
    if (!hasPermission) redirect("/subaccount/unauthorized");
  }

  const projects = await db.aIProject.findMany({
    where: { subAccountId: subaccountId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return <AIBuilderClient subaccountId={subaccountId} initialProjects={projects} />;
};

export default AIBuilderPage;