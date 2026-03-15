import React from "react";
import { verifyInvintation } from "@/queries/invitations";
import { redirect } from "next/navigation";
import { getAuthUserDetails } from "@/queries/auth";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import Unauthorized from "@/components/common/Unauthorized";
import { constructMetadata } from "@/lib/utils";

interface SubAccountPageProps {
  searchParams: {
    code: string | undefined;
    state: string | undefined;
  };
}

const SubAccountPage: React.FC<SubAccountPageProps> = async ({
  searchParams,
}) => {
  const { code, state } = searchParams;

  const agencyId = await verifyInvintation();
  if (!agencyId) redirect(`/subaccount/unauthorized`);

  const clerkUser = await currentUser();
  if (!clerkUser) redirect(`/agency/sign-in`);

  const user = await getAuthUserDetails();
  if (!user) redirect(`/agency/sign-in`);

  const role = clerkUser.privateMetadata.role as Role | undefined;

  // 🔥 FIX 1: Handle OAuth state redirect (keep your logic)
  if (state) {
    const statePath = state.split("___")[0];
    const stateSubAccountId = state.split("___")[1];

    if (!stateSubAccountId) redirect(`/agency/unauthorized`);

    redirect(
      `/subaccount/${stateSubAccountId}/${statePath}?code=${code}`
    );
  }

  // 🔥 FIX 2: OWNER & ADMIN should access ALL subaccounts
  if (
    role === Role.AGENCY_OWNER ||
    role === Role.AGENCY_ADMIN
  ) {
    const firstSubAccount = user.agency?.subAccounts?.[0];

    if (firstSubAccount) {
      redirect(`/subaccount/${firstSubAccount.id}`);
    }

    return <Unauthorized />;
  }

  // 🔥 FIX 3: Permission-based users (SUBACCOUNT_USER / GUEST)
  const firstSubAccountWithAccess = user.permissions.find(
    (permission) => permission.access === true
  );

  if (firstSubAccountWithAccess) {
    redirect(
      `/subaccount/${firstSubAccountWithAccess.subAccountId}`
    );
  }

  return <Unauthorized />;
};

export default SubAccountPage;

export const metadata = constructMetadata({
  title: "Subaccount - Aexon",
});