import React from "react";
import { redirect } from "next/navigation";

import { getFunnelPageDetails } from "@/queries/funnels";

import EditorProvider from "@/components/providers/EditorProvider";
import FunnelEditorNavigation from "@/components/modules/editor/FunnelEditorNavigation";
import FunnelEditorSidebar from "@/components/modules/editor/FunnelEditorSidebar";
import FunnelEditor from "@/components/modules/editor/FunnelEditor";
import { constructMetadata } from "@/lib/utils";

interface FunnelIdEditorPageProps {
  params: {
    funnelId: string | undefined;
    funnelPageId: string | undefined;
    subaccountId: string | undefined;
  };
}

const FunnelIdEditorPage: React.FC<FunnelIdEditorPageProps> = async ({
  params,
}) => {
  const { funnelId, funnelPageId, subaccountId } = params;

  if (!subaccountId) redirect("/subaccount/unauthorized");

  if (!funnelId || !funnelPageId) {
    redirect(`/subaccount/${subaccountId}/funnels`);
  }

  const funnelPageDetails = await getFunnelPageDetails(funnelPageId);

  if (!funnelPageDetails) {
    redirect(`/subaccount/${subaccountId}/funnels/${funnelId}`);
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      <EditorProvider
        subAccountId={subaccountId}
        funnelId={funnelId}
        pageDetails={funnelPageDetails}
      >
        <div className="flex flex-col h-full w-full">

          {/* Top Bar */}
          <header className="h-[52px] w-full flex-shrink-0 border-b border-border bg-card z-[30] relative">
            <div className="h-full px-4">
              <FunnelEditorNavigation
                funnelId={funnelId}
                funnelPageDetails={funnelPageDetails}
                subAccountId={subaccountId}
              />
            </div>
          </header>

          {/* Editor + Sidebar */}
          <div className="flex flex-1 w-full overflow-hidden relative">

            {/* Canvas */}
            <main className="flex-1 relative h-full bg-muted/5 overflow-y-auto overflow-x-hidden scrollbar-editor">
              <div className="min-h-full w-full">
                <FunnelEditor
                  funnelPageId={funnelPageId}
                  funnelPageDetails={funnelPageDetails}
                />
              </div>
            </main>

            {/* Sidebar */}
            <aside className="w-[400px] h-full flex-shrink-0 border-l border-border bg-card z-[20] relative">
              <FunnelEditorSidebar subAccountId={subaccountId} />
            </aside>

          </div>
        </div>
      </EditorProvider>
    </div>
  );
};

export default FunnelIdEditorPage;

export const metadata = constructMetadata({
  title: "Editor - Aexon",
});