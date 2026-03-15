import React from "react";
import { EditorContext } from "@/components/providers/EditorProvider";

export const useEditor = () => {
  const context = React.useContext(EditorContext);

  if (!context) {
    throw new Error("useEditor must be used within EditorProvider");
  }

  return context;
};