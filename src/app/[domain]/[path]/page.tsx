import React from "react";
import { notFound } from "next/navigation";

import { getDomainContent } from "@/queries/domain";
import { updateFunnelPageVisits } from "@/queries/funnels";

import EditorProvider from "@/components/providers/EditorProvider";
import FunnelEditor from "@/components/modules/editor/FunnelEditor";

interface DomainPathPageProps {
  params: {
    domain: string;
    path: string;
  };
}

const DomainPathPage: React.FC<DomainPathPageProps> = async ({ params }) => {
  const { domain, path } = params;

  if (!domain || !path) notFound();

  const domainData = await getDomainContent(domain);

  if (!domainData) notFound();

  const pageData = domainData.funnelPages.find(
    (page) => page.pathName === path
  );

  if (!pageData) notFound();

  await updateFunnelPageVisits(pageData.id);

  let parsedContent: any[] = [];

  try {
    parsedContent = pageData.content ? JSON.parse(pageData.content) : [];
  } catch {
    parsedContent = [];
  }

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
      pageDetails={safePageData}
      funnelId={domainData.id}
    >
      <FunnelEditor
        funnelPageDetails={safePageData}
        funnelPageId={safePageData.id}
        liveMode
      />
    </EditorProvider>
  );
};

export default DomainPathPage;