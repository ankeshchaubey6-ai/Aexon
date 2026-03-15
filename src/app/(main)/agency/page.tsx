import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { type Plan, Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { verifyInvintation } from "@/queries/invitations";

import AgencyDetails from "@/components/forms/AgencyDetails";
import Unauthorized from "@/components/common/Unauthorized";
import { constructMetadata } from "@/lib/utils";

interface AgencyPageProps {
  searchParams: {
    plan: Plan | undefined;
    state: string | undefined;
    code: string | undefined;
  };
}

const AgencyPage: React.FC<AgencyPageProps> = async ({ searchParams }) => {
  // 🔥 STEP 1: Wait for Clerk session (CRITICAL FIX)
  const authUser = await currentUser();

  // If session not ready yet → redirect to sign-in instead of infinite loop
  if (!authUser) {
    redirect("/agency/sign-in");
  }

  // 🔥 STEP 2: Safe DB calls (user may not exist yet on email signup)
  const agencyId = await verifyInvintation();
  const user = await getAuthUserDetails();

  // 🔥 STEP 3: If user record not created yet (VERY common on email signup)
  if (!user) {
    return (
      <div className="flex justify-center items-center mt-4">
        <div className="max-w-[850px] flex flex-col gap-8">
          <AgencyDetails
            data={{
              companyEmail:
                authUser.emailAddresses?.[0]?.emailAddress || "",
            }}
          />
        </div>
      </div>
    );
  }

  const isSubAccountUser =
    user.role === Role.SUBACCOUNT_GUEST ||
    user.role === Role.SUBACCOUNT_USER;

  const isAgencyUser =
    user.role === Role.AGENCY_OWNER ||
    user.role === Role.AGENCY_ADMIN;

  // 🔥 STEP 4: Redirection logic (only AFTER user exists)
  if (agencyId) {
    if (isSubAccountUser) {
      redirect("/subaccount");
    }

    if (isAgencyUser) {
      if (searchParams.plan) {
        redirect(`/agency/${agencyId}/billing?plan=${searchParams.plan}`);
      }

      if (searchParams.state) {
        const [statePath, stateAgencyId] =
          searchParams.state.split("___");

        if (!stateAgencyId) return <div>Not authorized.</div>;

        redirect(
          `/agency/${stateAgencyId}/${statePath}?code=${searchParams.code}`
        );
      }

      redirect(`/agency/${agencyId}`);
    }

    return <Unauthorized />;
  }

  // 🔥 STEP 5: New user (first signup flow)
  return (
    <div className="flex justify-center items-center mt-4">
      <div className="max-w-[850px] flex flex-col gap-8">
        <AgencyDetails
          data={{
            companyEmail:
              authUser.emailAddresses?.[0]?.emailAddress || "",
          }}
        />
      </div>
    </div>
  );
};

export default AgencyPage;

export const metadata = constructMetadata({
  title: "Agency - Aexon",
});