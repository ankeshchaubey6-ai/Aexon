"use client";

import React from "react";
import { useModal } from "@/hooks/use-modal";

const GlobalModalRenderer = () => {
  const { isOpen } = useModal();

  // ModalProvider already stores the modal node internally
  // So we DO NOT render anything extra here.
  // This component just forces proper client boundary.
  return null;
};

export default GlobalModalRenderer;