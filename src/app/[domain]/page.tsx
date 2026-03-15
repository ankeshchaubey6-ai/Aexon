import React from "react";
import { notFound } from "next/navigation";

import { getDomainContent } from "@/queries/domain";
import { updateFunnelPageVisits } from "@/queries/funnels";

import EditorProvider from "@/components/providers/EditorProvider";
import FunnelEditor from "@/components/modules/editor/FunnelEditor";

interface DomainPageProps {
  params: {
    domain: string | undefined;
  };
}

const DomainPage: React.FC<DomainPageProps> = async ({ params }) => {
  const { domain } = params;

  if (!domain) notFound();

  console.log("🌍 DOMAIN:", domain);

  const domainData = await getDomainContent(domain);

  if (!domainData) notFound();

  const pageData = domainData.funnelPages.find((page) => !page.pathName);

  if (!pageData) notFound();

  await updateFunnelPageVisits(pageData.id);

  /**
   * SAFELY PARSE FUNNEL CONTENT
   */
  let parsedContent: any[] = [];

  try {
    parsedContent = pageData.content
      ? JSON.parse(pageData.content)
      : [];
  } catch {
    parsedContent = [];
  }

  /**
   * AUTO FIX EMPTY FUNNEL PAGE
   */
  if (!parsedContent.length) {
    parsedContent = [
      {
        id: "__body",
        name: "Body",
        type: "__body",
        styles: { backgroundColor: "white" },
        content: [
          {
            id: "section-1",
            name: "Section",
            type: "section",
            styles: {},
            content: [],
          },
        ],
      },
    ];
  }

  const safePageData = {
    ...pageData,
    content: JSON.stringify(parsedContent),
  };

  return (
    <EditorProvider
      subAccountId={domainData.subAccountId}
      funnelId={domainData.id}
      pageDetails={safePageData}
    >
      <FunnelEditor
        funnelPageId={safePageData.id}
        funnelPageDetails={safePageData}
        liveMode
      />
    </EditorProvider>
  );
};

export default DomainPage;