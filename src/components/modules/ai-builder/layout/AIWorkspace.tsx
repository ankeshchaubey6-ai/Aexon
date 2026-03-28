"use client";

import { useParams } from "next/navigation";

import ProjectSidebar from "../chat/ProjectSidebar";
import ChatPanel from "../chat/ChatPanel";
import LivePreview from "../preview/LivePreview";

const AIWorkspace = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;

  return (
    <div className="w-full h-screen flex bg-background">

      {/* 📁 PROJECTS */}
      <div className="w-64 border-r">
        <ProjectSidebar subaccountId={subaccountId} />
      </div>

      {/* 💬 CHAT */}
      <div className="w-[400px] border-r">
        <ChatPanel />
      </div>

      {/* 👀 LIVE PREVIEW (REAL BUILDER) */}
      <div className="flex-1">
        <LivePreview />
      </div>

    </div>
  );
};

export default AIWorkspace;