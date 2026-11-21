"use client";

import React from "react";
import { EyeOff } from "lucide-react";
import { type FunnelPage } from "@prisma/client";

import EditorRecursive from "./editor-elements/EditorRecursive";
import { useEditor } from "@/hooks/use-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FunnelEditorProps {
  funnelPageId: string;
  liveMode?: boolean;
  funnelPageDetails: FunnelPage;
}

const FunnelEditor: React.FC<FunnelEditorProps> = ({
  funnelPageId,
  liveMode,
  funnelPageDetails,
}) => {
  const { editor, dispatch } = useEditor();

  React.useEffect(() => {
    if (!funnelPageDetails) return;

    let elements: any[] = [];

    try {
      elements = funnelPageDetails.content
        ? JSON.parse(funnelPageDetails.content)
        : [];
    } catch {
      elements = [];
    }

    if (!elements.length) {
      elements = [
        {
          id: "__body",
          name: "Body",
          type: "__body",
          styles: { backgroundColor: "white" },
          content: [
            {
              id: "section-1",
              name: "Section",
              type: "section",
              styles: {},
              content: [],
            },
          ],
        },
      ];
    }

    dispatch({
      type: "LOAD_DATA",
      payload: {
        elements,
        withLive: !!liveMode,
      },
    });

    dispatch({
      type: "SET_FUNNELPAGE_ID",
      payload: {
        funnelPageId,
      },
    });
  }, [funnelPageDetails, funnelPageId, liveMode, dispatch]);

  const handleClickElement = () => {
    dispatch({
      type: "CHANGE_CLICKED_ELEMENT",
      payload: {},
    });
  };

  const handlePreview = () => {
    dispatch({ type: "TOGGLE_LIVE_MODE" });
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
  };

  return (
    <div
      className={cn(
        "w-full overflow-x-hidden bg-background relative",
        editor.editor.liveMode
          ? "min-h-screen h-auto overflow-y-visible"
          : "h-full overflow-y-hidden",
        {
          "p-0": editor.editor.previewMode || editor.editor.liveMode,
          "!w-[850px] mx-auto": editor.editor.device === "Tablet",
          "!w-[420px] mx-auto": editor.editor.device === "Mobile",
        }
      )}
      onClick={handleClickElement}
    >
      {editor.editor.previewMode && editor.editor.liveMode && (
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 left-4 z-[100]"
          onClick={handlePreview}
        >
          <EyeOff className="w-4 h-4" />
        </Button>
      )}

      {Array.isArray(editor.editor.elements) &&
        editor.editor.elements.map((element) => (
          <EditorRecursive key={element.id} element={element} />
        ))}
    </div>
  );
};

export default FunnelEditor;
