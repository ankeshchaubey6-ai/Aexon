import React from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import { getAgencyDetails } from "@/queries/agency";
import { getAuthUserGroup } from "@/queries/auth";
import { constructMetadata } from "@/lib/utils";

import TeamClient from "./TeamClient";

interface TeamPageProps {
  params: { agencyId: string | undefined };
}

const TeamPage: React.FC<TeamPageProps> = async ({ params }) => {
  const { agencyId } = params;
  const authUser = await currentUser();

  if (!authUser) redirect("/agency/sign-in");
  if (!agencyId) redirect("/agency/unauthorized");

  const teamMembers = await getAuthUserGroup(agencyId);
  if (!teamMembers) redirect("/agency/sign-in");

  const agencyDetails = await getAgencyDetails(agencyId);
  if (!agencyDetails) redirect("/agency/unauthorized");

  return (
    <TeamClient
      agencyId={agencyId}
      authUser={{
        id: authUser.id,
        firstName: authUser.firstName ?? "",
        lastName: authUser.lastName ?? "",
        email: authUser.emailAddresses[0]?.emailAddress ?? "",
        imageUrl: authUser.imageUrl,
      }}
      teamMembers={teamMembers}
      agencyDetails={agencyDetails}
    />
  );
};

export default TeamPage;

export const metadata = constructMetadata({ title: "Team - Aexon" });