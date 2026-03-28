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

  const { setProject, setFiles, addMessage, projectId, files } =
    useAIBuilderStore();

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const prompt = input.trim();
    const isEditMode = !!(projectId && files && files.length > 0);

    addMessage({ role: "user", content: prompt });
    addMessage({
      role: "assistant",
      content: isEditMode
        ? "Applying your changes... ⏳"
        : "Generating your project... ⏳",
    });

    setInput("");
    setLoading(true);

    try {
      const endpoint = isEditMode ? "/api/ai/edit" : "/api/ai/generate";

      const body = isEditMode
        ? { subaccountId, projectId, instructions: prompt }
        : { subaccountId, prompt, name: "AI Generated Project" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data?.projectId && data?.files?.length) {
        // Update store — LivePreview's useEffect picks up the diff and
        // writes only changed files into the running WebContainer via HMR.
        setProject(data.projectId);
        setFiles(data.files);

        addMessage({
          role: "assistant",
          content: isEditMode
            ? `Done! Changes applied to ${data.files.length} file(s) ✨`
            : "Project generated successfully 🚀",
        });
      } else {
        addMessage({
          role: "assistant",
          content: "AI returned an empty result ❌",
        });
      }
    } catch (error) {
      console.error("AI Error:", error);
      addMessage({
        role: "assistant",
        content: "Something went wrong. Please try again ❌",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b text-sm font-medium">
        AI Chat{" "}
        {projectId && (
          <span className="text-xs text-muted-foreground ml-2">
            (Editing Mode)
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        <MessageList />
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded-md px-2 py-1 text-sm bg-background"
          placeholder={
            projectId
              ? "Describe changes you want..."
              : "Describe the app you want to build..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <Button size="sm" onClick={handleSend} disabled={loading}>
          {loading ? "Processing..." : projectId ? "Edit" : "Generate"}
        </Button>
      </div>
    </div>
  );
};

export default ChatSidebar;