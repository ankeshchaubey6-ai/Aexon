// src/app/(main)/subaccount/[subaccountId]/ai-builder/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
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

  // ✅ auth() reads JWT locally — no outbound Clerk API call
  const { userId } = auth();
  if (!userId) redirect("/agency/sign-in");

  const authUser = await getAuthUserDetails();
  if (!authUser || !authUser.agency) redirect("/agency/sign-in");

  // ✅ role from DB, not clerkUser.privateMetadata (which is always undefined here)
  const role = authUser.role as Role;

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