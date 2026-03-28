"use client";

import { useAIBuilderStore } from "../state/ai-builder.store";

const MessageList = () => {
  const { messages } = useAIBuilderStore();

  return (
    <div className="flex flex-col gap-3 text-sm">
      {messages.length === 0 && (
        <div className="rounded-md border p-2 bg-muted/40 text-muted-foreground">
          Describe the app (e.g. "SaaS landing page with pricing and auth")
          and I will generate the full project 🚀
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={i}
          className={
            msg.role === "user"
              ? "flex justify-end"
              : "flex justify-start"
          }
        >
          <div
            className={
              msg.role === "user"
                ? "bg-primary text-white px-3 py-2 rounded-md max-w-[80%]"
                : "bg-muted px-3 py-2 rounded-md max-w-[80%]"
            }
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;