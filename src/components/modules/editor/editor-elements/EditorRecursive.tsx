import React from "react";

import EditorText from "./EditorText";
import EditorContainer from "./EditorContainer";
import EditorVideo from "./EditorVideo";
import EditorLink from "./EditorLink";
import EditorContact from "./EditorContact";
import EditorPayment from "./EditorPayment";
import EditorImage from "./EditorImage";
import EditorSection from "./EditorSection";

import type { EditorElement } from "@/lib/types/editor";

type Props = {
  element: EditorElement;
};

const EditorRecursive = ({ element }: Props) => {
  if (!element) return null;

  switch (element.type) {
    case "text":
      return <EditorText element={element} />;
    case "image":
      return <EditorImage element={element} />;
    case "container":
    case "__body":
    case "2Col":
    case "3Col":
      return <EditorContainer element={element} />;
    case "section":
      return <EditorSection element={element} />;
    case "video":
      return <EditorVideo element={element} />;
    case "link":
      return <EditorLink element={element} />;
    case "contactForm":
      return <EditorContact element={element} />;
    case "paymentForm":
      return <EditorPayment element={element} />;
    default:
      return null;
  }
};

export default EditorRecursive;