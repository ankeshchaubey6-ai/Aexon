
import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { getNotification } from "@/queries/notifications";

import Sidebar from "@/components/navigation/Sidebar";
import SubAccountContent from "@/components/common/SubAccountContent";

import { NotificationsWithUser } from "@/lib/types";

interface SubAccountIdLayoutProps {
  children: React.ReactNode;
  params: {
    subaccountId: string | undefined;
  };
}

const SubAccountIdLayout: React.FC<SubAccountIdLayoutProps> = async ({
  children,
  params,
}) => {
  const { subaccountId } = params;

  if (!subaccountId) {
    redirect("/subaccount/unauthorized");
  }

  const { userId } = auth();

  if (!userId) {
    redirect("/agency/sign-in");
  }

  const authUser = await getAuthUserDetails();

  if (!authUser || !authUser.agency) {
    redirect("/agency/sign-in");
  }

  const role = authUser.role as Role;

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

  const allNotifications = await getNotification(
    authUser.agency.id,
    isOwnerOrAdmin ? undefined : subaccountId
  );

  let notifications: NotificationsWithUser = [];

  if (isOwnerOrAdmin) {
    notifications = allNotifications || [];
  } else {
    notifications = allNotifications || [];
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar id={subaccountId} type="subaccount" user={authUser} />

      {/* Page content wrapper */}
      <SubAccountContent
        notifications={notifications}
        role={role}
        subAccountId={subaccountId}
      >
        {children}
      </SubAccountContent>
    </div>
  );
};

export default SubAccountIdLayout;
