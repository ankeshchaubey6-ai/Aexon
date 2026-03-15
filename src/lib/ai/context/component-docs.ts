// src/lib/ai/context/component-docs.ts
export interface ComponentDoc {
  name: string;
  description: string;
  props?: Record<string, string>;
}

export const COMPONENT_DOCS: ComponentDoc[] = [
  {
    name: "Button",
    description: "Reusable UI button component",
    props: {
      variant: "primary | secondary | outline | ghost",
      size: "sm | md | lg | icon",
    },
  },
  {
    name: "Card",
    description: "Container component for grouped content",
  },
  {
    name: "Modal",
    description: "Overlay dialog component for forms and actions",
  },
];

export const getComponentDoc = (name: string) =>
  COMPONENT_DOCS.find(
    (doc) => doc.name.toLowerCase() === name.toLowerCase()
  );