import React from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { getNotification } from "@/queries/notifications";

import Sidebar from "@/components/navigation/Sidebar";
import BlurPage from "@/components/common/BlurPage";
import InfoBar from "@/components/common/InfoBar";

interface AgencyIdLayoutProps extends React.PropsWithChildren {
  params: {
    agencyId: string | undefined;
  };
}

const AgencyIdLayout: React.FC<AgencyIdLayoutProps> = async ({
  params,
  children,
}) => {
  const { agencyId } = params;

  if (!agencyId) redirect("/agency");

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/agency/sign-in");

  const authUser = await getAuthUserDetails();
  if (!authUser || !authUser.agency) {
    redirect("/agency/sign-in");
  }

  if (authUser.agency.id !== agencyId) {
    redirect("/agency/unauthorized");
  }

  const role = clerkUser.privateMetadata.role as Role | undefined;

  if (
    role !== Role.AGENCY_OWNER &&
    role !== Role.AGENCY_ADMIN
  ) {
    redirect("/agency/unauthorized");
  }

  const notifications = await getNotification(agencyId);

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      {/* Sidebar (fixed on left) */}
      <Sidebar id={agencyId} type="agency" user={authUser} />

      {/* 🔥 CONTENT WRAPPER — NO HARD PADDING */}
      <div className="layout-content h-full relative">
        {/* 🔥 InfoBar synced with sidebar width */}
        <div className="layout-infobar fixed top-0 z-[20]">
          <InfoBar
            notifications={notifications || []}
            subAccountId={agencyId}
            role={role!}
          />
        </div>

        {/* Page Content */}
        <div className="relative h-full pt-[64px]">
          <BlurPage>{children}</BlurPage>
        </div>
      </div>
    </div>
  );
};

export default AgencyIdLayout;