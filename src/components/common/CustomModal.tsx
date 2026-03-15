"use client";

import React from "react";
import { useModal } from "@/hooks/use-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";

interface CustomModalProps {
  title: string;
  subTitle?: string;
  children: React.ReactNode;
  scrollShadow?: boolean;
}

const CustomModal: React.FC<CustomModalProps> = ({
  children,
  subTitle,
  title,
  scrollShadow = true,
}) => {
  const { isOpen, setClose } = useModal();

  return (
    <Dialog open={isOpen} onOpenChange={setClose}>
      <DialogContent
        className="bg-card max-w-xl"
        aria-describedby={subTitle ? "modal-description" : undefined}
      >
        {/* 🔥 IMPORTANT: Header MUST be direct child (Radix requirement) */}
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-bold">
            {title || "Modal"}
          </DialogTitle>

          {subTitle && (
            <DialogDescription id="modal-description">
              {subTitle}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Scroll ONLY body, not header */}
        <ScrollArea
          scrollShadow={scrollShadow}
          className="max-h-[70vh] pr-2"
        >
          <div className="flex flex-col gap-4">
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CustomModal;