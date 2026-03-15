import React from "react";
import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";

import { getFunnels } from "@/queries/funnels";
import { getSubAccountDetails } from "@/queries/subaccount";
import FunnelDetails from "@/components/forms/FunnelDetails";
import BlurPage from "@/components/common/BlurPage";
import FunnelsDataTable from "./data-table";
import { columns } from "./columns";
import { constructMetadata } from "@/lib/utils";

interface FunnelsPageProps {
  params: { subaccountId: string };
}

const FunnelsPage: React.FC<FunnelsPageProps> = async ({ params }) => {
  const { subaccountId } = params;
  
  if (!subaccountId) redirect("/subaccount/unauthorized");

  // Fetch both funnels and subaccount details in parallel
  const [funnels, subaccount] = await Promise.all([
    getFunnels(subaccountId),
    getSubAccountDetails(subaccountId)
  ]);

  if (!funnels) return null;

  // Calculate stats
  const totalFunnels = funnels.length;
  const publishedFunnels = funnels.filter(f => f.published).length;
  const draftFunnels = totalFunnels - publishedFunnels;

  const stats = {
    totalFunnels,
    publishedFunnels,
    draftFunnels,
  };

  return (
    <BlurPage>
      <FunnelsDataTable
        subaccountId={subaccountId}
        subaccountName={subaccount?.name || "Subaccount"}
        stats={stats}
        actionButtonText={
          <>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Funnel
          </>
        }
        modalChildren={<FunnelDetails subAccountId={subaccountId} />}
        filterValue="name"
        columns={columns}
        data={funnels}
      />
    </BlurPage>
  );
};

export default FunnelsPage;

export const metadata = constructMetadata({
  title: "Funnels - Aexon",
});