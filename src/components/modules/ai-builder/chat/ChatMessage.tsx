"use client";

import React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Bot, User, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const SyntaxHighlighter = dynamic(
  () =>
    import("react-syntax-highlighter").then(
      (module) => module.Prism
    ),
  {
    ssr: false,
    loading: () => (
      <pre className="overflow-x-auto rounded bg-black/20 p-3 text-xs text-muted-foreground">
        Loading code preview...
      </pre>
    ),
  }
);

export type AIMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status: "PENDING" | "DONE" | "ERROR";
  createdAt: string;
};

interface ChatMessageProps {
  message: AIMessage;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === "USER";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "w-full px-1 py-1 flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "group relative max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: (({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <div className="relative">
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          navigator.clipboard.writeText(String(children));
                          toast.success("Code copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <code className={cn("bg-black/20 rounded px-1 py-0.5", className)} {...props}>
                      {children}
                    </code>
                  );
                }) as any,
                a: (({ children, href, ...props }: any) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                    {...props}
                  >
                    {children}
                  </a>
                )) as any,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.status === "PENDING" && !isUser && (
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse delay-150" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse delay-300" />
          </div>
        )}

        {message.status === "ERROR" && (
          <div className="text-xs text-red-400 mt-1">Failed to send</div>
        )}

        {!isUser && message.status === "DONE" && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>

      {isUser && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;