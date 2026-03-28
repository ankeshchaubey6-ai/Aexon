"use client";

export type AIMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  status: "PENDING" | "DONE" | "ERROR";
  createdAt: string;
};

const ChatMessage = ({ message }: { message: AIMessage }) => {
  const isUser = message.role === "USER";

  return (
    <div
      className={`w-full px-4 py-2 flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-white"
            : "bg-muted text-foreground"
        }`}
      >
        <div>{message.content}</div>

        {message.status === "PENDING" && (
          <div className="text-xs opacity-60 mt-1">Thinking...</div>
        )}

        {message.status === "ERROR" && (
          <div className="text-xs text-red-400 mt-1">Error</div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;