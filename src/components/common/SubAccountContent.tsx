"use client";

import React from "react";
import { usePathname } from "next/navigation";
import InfoBar from "@/components/common/InfoBar";
import { NotificationsWithUser } from "@/lib/types";
import { Role } from "@prisma/client";

interface Props {
  children: React.ReactNode;
  notifications: NotificationsWithUser;
  role: Role;
  subAccountId: string;
}

const SubAccountContent: React.FC<Props> = ({
  children,
  notifications,
  role,
  subAccountId,
}) => {
  const pathname = usePathname();

  const isEditorPage = pathname.includes("/editor/");

  return (
    <div className="layout-content h-full relative">
      {!isEditorPage && (
        <div className="layout-infobar fixed top-0 z-[20]">
          <InfoBar
            notifications={notifications}
            role={role}
            subAccountId={subAccountId}
          />
        </div>
      )}

      <div
        className={`relative h-full overflow-auto ${
          isEditorPage ? "" : "pt-[64px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default SubAccountContent;