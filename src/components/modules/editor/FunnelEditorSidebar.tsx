"use client";

import React from "react";
import { Database, PlusCircle, Settings, SquareStack } from "lucide-react";

import { useEditor } from "@/hooks/use-editor";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SettingsTab from "./editor-tabs/SettingsTab";
import MediaTab from "./editor-tabs/MediaTab";
import ComponentsTab from "./editor-tabs/components-tab/ComponentsTab";
import LayersTab from "./editor-tabs/LayersTab";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FunnelEditorSidebarProps {
  subAccountId: string;
}

type TabsName = "Settings" | "Components" | "Layers" | "Media";

const FunnelEditorSidebar: React.FC<FunnelEditorSidebarProps> = ({
  subAccountId,
}) => {
  const { editor } = useEditor();

  const handleSaveTabStorage = (tab: TabsName) => {
    localStorage.setItem("funnel-tab-name", tab);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Sheet open modal={false}>
        <Tabs
          className="w-full"
          defaultValue={localStorage.getItem("funnel-tab-name") || "Settings"}
          onValueChange={(value) => handleSaveTabStorage(value as TabsName)}
        >
          {/* ICON TOOLBAR */}
          <SheetContent
            showClose={false}
            side="right"
            className={cn(
              "top-[52px] w-[64px] z-[80] p-0 shadow-none border-l bg-background flex flex-col items-center pt-6 gap-4",
              {
                hidden: editor.editor.previewMode,
              }
            )}
          >
            <TabsList className="flex flex-col gap-4 bg-transparent h-fit">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="Settings"
                    className="w-10 h-10 p-0 data-[state=active]:bg-muted"
                  >
                    <Settings size={18} />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">Settings</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="Components"
                    className="w-10 h-10 p-0 data-[state=active]:bg-muted"
                  >
                    <PlusCircle size={18} />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">Components</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="Layers"
                    className="w-10 h-10 p-0 data-[state=active]:bg-muted"
                  >
                    <SquareStack size={18} />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">Layers</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="Media"
                    className="w-10 h-10 p-0 data-[state=active]:bg-muted"
                  >
                    <Database size={18} />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">Media</TooltipContent>
              </Tooltip>
            </TabsList>
          </SheetContent>

          {/* SETTINGS PANEL */}
          <SheetContent
            showClose={false}
            side="right"
            className={cn(
              "top-[52px] right-[64px] w-[335px] z-[70] shadow-none border-l bg-background p-0 h-[calc(100vh-52px)]",
              {
                hidden: editor.editor.previewMode,
              }
            )}
          >
            <ScrollArea className="h-full">
              <TabsContent value="Settings">
                <SettingsTab />
              </TabsContent>

              <TabsContent value="Components">
                <ComponentsTab />
              </TabsContent>

              <TabsContent value="Layers">
                <LayersTab />
              </TabsContent>

              <TabsContent value="Media">
                <MediaTab subAccountId={subAccountId} />
              </TabsContent>
            </ScrollArea>
          </SheetContent>
        </Tabs>
      </Sheet>
    </TooltipProvider>
  );
};

export default FunnelEditorSidebar;