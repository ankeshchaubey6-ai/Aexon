"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatMessage, { type AIMessage } from "./ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageListProps {
  messages: AIMessage[];
  className?: string;
}

const MessageList: React.FC<MessageListProps> = ({ messages, className }) => {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <ScrollArea className={className}>
      <div className="flex flex-col gap-2 p-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <ChatMessage message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} className="h-1" />
      </div>
    </ScrollArea>
  );
};

export default MessageList;