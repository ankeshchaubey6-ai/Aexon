import { redirect } from "next/navigation";
import { getAuthUserDetails } from "@/queries/auth";
import { constructMetadata } from "@/lib/utils";
import AllSubAccountsClient from "./AllSubAccountsClient";

interface PageProps {
  params: {
    agencyId: string;
  };
}

export const metadata = constructMetadata({
  title: "Subaccounts - Aexon",
});

export default async function AllSubAccountsPage({ params }: PageProps) {
  const { agencyId } = params;

  if (!agencyId) {
    redirect("/agency/unauthorized");
  }

  const user = await getAuthUserDetails();

  if (!user) {
    redirect("/agency/sign-in");
  }

  const subAccounts = user.agency?.subAccounts ?? [];

  return (
    <AllSubAccountsClient
      agencyId={agencyId}
      user={user}
      subAccounts={subAccounts}
    />
  );
}