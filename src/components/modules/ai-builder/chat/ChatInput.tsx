"use client";

import { useState } from "react";

const ChatInput = ({ onSend, loading }: any) => {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
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