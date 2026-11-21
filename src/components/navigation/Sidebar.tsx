// src/components/navigation/Sidebar.tsx
import React from "react";
import {
  type AgencySidebarOption,
  type SubAccountSidebarOption,
  Role,
} from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import MenuOptions from "./MenuOptions";

type AuthUserDetails = NonNullable<
  Awaited<ReturnType<typeof getAuthUserDetails>>
>;

interface SidebarProps {
  id: string;
  type: "agency" | "subaccount";
  user?: AuthUserDetails;
}

const Sidebar: React.FC<SidebarProps> = async ({
  id,
  type,
  user: initialUser,
}) => {
  const user = initialUser ?? (await getAuthUserDetails());

  if (!user || !user.agency) return null;

  const details =
    type === "agency"
      ? user.agency
      : user.agency.subAccounts.find((subAccount) => subAccount.id === id);

  if (!details) return null;

  const isWhiteLabelAgency = user.agency.whiteLabel;

  let sideBarLogo: string =
    user.agency.agencyLogo || "/assets/aexon-logo.svg";

  if (!isWhiteLabelAgency && type === "subaccount") {
    const subAccountLogo = user.agency.subAccounts.find(
      (subAccount) => subAccount.id === id
    )?.subAccountLogo;

    sideBarLogo = subAccountLogo || user.agency.agencyLogo;
  }

  let sidebarOptions: AgencySidebarOption[] | SubAccountSidebarOption[] = [];

  if (type === "agency") {
    sidebarOptions = user.agency.sidebarOptions || [];
  } else {
    const subAccount = user.agency.subAccounts.find(
      (subaccount) => subaccount.id === id
    );

    const existingOptions = subAccount?.sidebarOptions || [];

    // Inject AI Builder dynamically (ONLY for subaccount)
    const aiBuilderLink = `/subaccount/${id}/ai-builder`;
    const hasAiBuilder = existingOptions.some(
      (opt) => opt.link === aiBuilderLink
    );

    const aiBuilderOption: SubAccountSidebarOption = {
      id: "ai-builder-static",
      name: "AI Builder",
      link: aiBuilderLink,
      icon: "chip",
      subAccountId: id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    sidebarOptions = hasAiBuilder
      ? existingOptions
      : [...existingOptions, aiBuilderOption];
  }

  const isOwnerOrAdmin =
    user.role === Role.AGENCY_OWNER || user.role === Role.AGENCY_ADMIN;

  const subAccounts = isOwnerOrAdmin
    ? user.agency.subAccounts
    : user.agency.subAccounts.filter((subAccount) =>
        user.permissions.find(
          (permission) =>
            permission.subAccountId === subAccount.id &&
            permission.access === true
        )
      );

  return (
    <MenuOptions
      defaultOpen={true} // single sidebar only (desktop + mobile handled inside)
      details={details}
      id={id}
      sideBarLogo={sideBarLogo}
      sideBarOptions={sidebarOptions}
      subAccount={subAccounts}
      user={user}
    />
  );
};

export default Sidebar;