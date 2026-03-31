"use client";

import { useState } from "react";

type Props = {
  subAccountId: string;
  addFileToState: (file: { path: string; content: string }) => void;
};

const ChatInput = ({ subAccountId, addFileToState }: Props) => {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!value.trim() || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt: value,
          subAccountId,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });

        const parts = buffer.split("\n\n");

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const json = part.replace("data: ", "");
          const data = JSON.parse(json);

          if (data.type === "file") {
            addFileToState(data.file);
          }

          if (data.type === "done") {
            setLoading(false);
          }
        }

        buffer = parts[parts.length - 1];
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }

    setValue("");
  };

  return (
    <div className="mt-auto flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Describe your app..."
        className="flex-1 border rounded px-3 py-2 text-sm"
      />
      <button
        onClick={handleSend}
        disabled={loading}
        className="px-4 py-2 bg-primary text-white rounded"
      >
        {loading ? "..." : "Send"}
      </button>
    </div>
  );
};

export default ChatInput;