"use client";

import React from "react";
import {
  type Plan,
  type Agency,
  type Contact,
  type User,
} from "@prisma/client";
import type { PriceList, TicketDetails } from "@/lib/types";

export interface ModalData {
  user?: User;
  agency?: Agency;
  contact?: Contact;
  ticket?: TicketDetails[0];
  plans?: {
    defaultPriceId: Plan;
    plans: PriceList["data"];
  };
}

interface ModalContextType {
  data: ModalData;
  isOpen: boolean;
  // 🔥 CRITICAL FIX: modal must be ReactNode NOT string
  setOpen: (modal: React.ReactNode, fetch?: () => Promise<any>) => void;
  setClose: () => void;
}

export const ModalContext = React.createContext<ModalContextType>({
  data: {},
  isOpen: false,
  setOpen: () => {},
  setClose: () => {},
});

export const ModalProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [data, setData] = React.useState<ModalData>({});
  const [currentModal, setCurrentModal] =
    React.useState<React.ReactNode>(null); // ✅ must be ReactNode

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const setOpen: ModalContextType["setOpen"] = async (modal, fetch) => {
    try {
      if (fetch) {
        const newData = (await fetch()) as Partial<ModalData>;
        setData((prev) => ({
          ...prev,
          ...newData,
        }));
      }

      // 🔥 THIS IS WHAT RENDERS YOUR MODAL
      setCurrentModal(modal);
      setIsOpen(true);
    } catch (error) {
      console.error("MODAL OPEN ERROR:", error);
    }
  };

  const setClose = () => {
    setIsOpen(false);
    setCurrentModal(null); // cleanup
    setData({});
  };

  if (!isMounted) return null;

  return (
    <ModalContext.Provider value={{ data, setOpen, setClose, isOpen }}>
      {children}
      {/* 🔥 CRITICAL: This actually renders the modal */}
      {currentModal}
    </ModalContext.Provider>
  );
};