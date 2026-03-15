// src/components/modules/ai-builder/chat/ChatSidebar.tsx (FINAL - generate wired)
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageList from "./MessageList";
import { useParams } from "next/navigation";
import { useAIBuilderStore } from "../state/ai-builder.store";

const ChatSidebar: React.FC = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const subaccountId = params?.subaccountId as string;

  const { setProject, setFiles } = useAIBuilderStore();

  const handleSend = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          subaccountId,
          prompt: input,
          name: "AI Generated Project",
        }),
      });

      const data = await res.json();

      if (data?.projectId) {
        setProject(data.projectId);
        setFiles(data.files || []);
      }

      setInput("");
    } catch (e) {
      console.error("AI generation failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b text-sm font-medium">
        AI Chat
      </div>

      <ScrollArea className="flex-1 p-3">
        <MessageList />
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded-md px-2 py-1 text-sm bg-background"
          placeholder="Describe the app you want to build..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? "Generating..." : "Send"}
        </Button>
      </div>
    </div>
  );
};

export default ChatSidebar;