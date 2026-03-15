"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeftCircle,
  Clock,
  Eye,
  Laptop,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import { type FunnelPage } from "@prisma/client";

import { upsertFunnelPage } from "@/queries/funnels";
import { saveActivityLogsNotification } from "@/queries/notifications";

import { useEditor } from "@/hooks/use-editor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/common/ModeToggle";

import { cn } from "@/lib/utils";
import { type DeviceTypes } from "@/lib/types/editor";

interface FunnelEditorNavigationProps {
  funnelId: string;
  subAccountId: string;
  funnelPageDetails: FunnelPage;
}

const FunnelEditorNavigation: React.FC<FunnelEditorNavigationProps> = ({
  funnelId,
  funnelPageDetails,
  subAccountId,
}) => {
  const router = useRouter();
  const { editor, dispatch } = useEditor();
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    dispatch({
      type: "SET_FUNNELPAGE_ID",
      payload: { funnelPageId: funnelPageDetails.id },
    });
  }, [funnelPageDetails]);

  const handleBlurTitleChange = async (
    event: React.FocusEvent<HTMLInputElement, Element>
  ) => {
    if (event.target.value === funnelPageDetails.name) return;
    if (event.target.value) {
      await upsertFunnelPage(subAccountId, funnelId, {
        id: funnelPageDetails.id,
        name: event.target.value,
        order: funnelPageDetails.order,
      });
      toast.success("Success", { description: "Saved funnel page title" });
      router.refresh();
    } else {
      toast.error("Oops!", { description: "You need to have a title!" });
    }
  };

  const handlePreviewClick = () => {
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
    dispatch({ type: "TOGGLE_LIVE_MODE" });
  };

  const handleUndo = () => dispatch({ type: "UNDO" });
  const handleRedo = () => dispatch({ type: "REDO" });

  const handleSave = async () => {
    setIsLoading(true);
    const content = JSON.stringify(editor.editor.elements);
    try {
      const response = await upsertFunnelPage(subAccountId, funnelId, {
        ...funnelPageDetails,
        content,
      });
      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Updated a funnel page | ${response?.name}`,
        subAccountId,
      });
      dispatch({ type: "CLEAR_HISTORY" });
      toast.success("Success", { description: "Saved content" });
      router.refresh();
    } catch {
      toast.error("Oops!", { description: "Could not save content" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); handleSave();
    } else if (event.key === "z" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); handleUndo();
    } else if (event.key === "y" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); handleRedo();
    } else if (event.key === "p" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); handlePreviewClick();
    }
  };

  React.useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const unsavedCount = editor.history.history.length;
  const saveLabel = unsavedCount > 1
    ? `Save (${unsavedCount <= 50 ? unsavedCount : "50+"})`
    : "Save";

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn(
          "editor-nav",
          { "editor-nav--hidden": editor.editor.previewMode }
        )}
      >
        {/* ── LEFT: back + page info ── */}
        <div className="editor-nav__left">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/subaccount/${subAccountId}/funnels/${funnelId}`}
                className="editor-nav__back"
                aria-label="Back to funnels"
              >
                <ArrowLeftCircle className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">Back to funnels</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <span className="editor-nav__divider" aria-hidden="true" />

          <div className="editor-nav__page-info">
            <Input
              defaultValue={funnelPageDetails.name}
              onBlur={handleBlurTitleChange}
              className="editor-nav__title-input"
              aria-label="Page title"
            />
            <div className="editor-nav__meta">
              <span className="editor-nav__path">
                /{funnelPageDetails.pathName || ""}
              </span>
              <span className="editor-nav__dot" aria-hidden="true">·</span>
              <span className="editor-nav__time">
                <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                {format(new Date(funnelPageDetails.updatedAt), "dd/MM/yyyy hh:mm a")}
              </span>
            </div>
          </div>
        </div>

        {/* ── CENTER: device switcher ── */}
        <div className="editor-nav__center">
          <Tabs
            defaultValue="Desktop"
            value={editor.editor.device}
            onValueChange={(value) =>
              dispatch({
                type: "CHANGE_DEVICE",
                payload: { device: value as DeviceTypes },
              })
            }
          >
            <TabsList className="editor-nav__tabs">
              {[
                { value: "Desktop", icon: <Laptop className="w-4 h-4" />, label: "Desktop" },
                { value: "Tablet",  icon: <Tablet  className="w-4 h-4" />, label: "Tablet"  },
                { value: "Mobile",  icon: <Smartphone className="w-4 h-4" />, label: "Mobile" },
              ].map(({ value, icon, label }) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <TabsTrigger value={value} className="editor-nav__tab" aria-label={label}>
                      {icon}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* ── RIGHT: actions ── */}
        <div className="editor-nav__right">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="editor-nav__icon-btn">
                <ModeToggle className="editor-nav__icon-btn" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle theme</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviewClick}
                className="editor-nav__icon-btn"
                aria-label="Preview"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="editor-nav__kbd-hint">
                Preview <Kbd>⌘P</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          <div className="editor-nav__separator" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndo}
                disabled={!(editor.history.currentIndex > 0)}
                className="editor-nav__icon-btn"
                aria-label="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="editor-nav__kbd-hint">Undo <Kbd>⌘Z</Kbd></span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRedo}
                disabled={
                  !(editor.history.currentIndex < editor.history.history.length - 1)
                }
                className="editor-nav__icon-btn"
                aria-label="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="editor-nav__kbd-hint">Redo <Kbd>⌘Y</Kbd></span>
            </TooltipContent>
          </Tooltip>

          <div className="editor-nav__separator" aria-hidden="true" />

          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="editor-nav__save-btn"
            aria-label={saveLabel}
          >
            {isLoading ? (
              <span className="editor-nav__save-spinner" aria-hidden="true" />
            ) : null}
            {saveLabel}
          </Button>
        </div>
      </nav>

      {/* ── Scoped styles ── */}
      <style>{`
        /* Tokens – inherit from shell or define standalone fallbacks */
        .editor-nav {
          --nav-h:        52px;
          --nav-bg:       hsl(var(--background, 222 20% 8%));
          --nav-border:   hsl(var(--border, 220 15% 16%));
          --nav-text:     hsl(var(--foreground, 220 10% 90%));
          --nav-muted:    hsl(var(--muted-foreground, 220 10% 55%));
          --nav-accent:   hsl(var(--primary, 255 70% 65%));
          --nav-accent-bg:hsl(var(--primary, 255 70% 65%) / 0.12);
          --nav-hover:    hsl(var(--muted, 220 15% 15%));
          --nav-radius:   6px;
          --nav-icon:     36px;
          --transition:   140ms ease;

          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          height: var(--nav-h);
          padding: 0 16px;
          background: var(--nav-bg);
          border-bottom: 1px solid var(--nav-border);
          color: var(--nav-text);
          font-size: 13px;
          overflow: hidden;
          transition: height var(--transition), padding var(--transition), opacity var(--transition);
        }

        .editor-nav--hidden {
          height: 0;
          padding-top: 0;
          padding-bottom: 0;
          opacity: 0;
          pointer-events: none;
        }

        /* ── LEFT ── */
        .editor-nav__left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
          max-width: 340px;
        }

        .editor-nav__back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--nav-icon);
          height: var(--nav-icon);
          border-radius: var(--nav-radius);
          color: var(--nav-muted);
          flex-shrink: 0;
          transition: color var(--transition), background var(--transition);
        }
        .editor-nav__back:hover {
          color: var(--nav-text);
          background: var(--nav-hover);
        }

        .editor-nav__divider {
          width: 1px;
          height: 24px;
          background: var(--nav-border);
          flex-shrink: 0;
        }

        .editor-nav__page-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          flex: 1;
        }

        /* Override shadcn Input to look inline */
        .editor-nav__title-input {
          height: 26px !important;
          padding: 0 4px !important;
          margin: 0 !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: var(--nav-text) !important;
          border-radius: 4px !important;
          transition: border-color var(--transition), background var(--transition) !important;
          width: 100% !important;
        }
        .editor-nav__title-input:hover {
          border-color: var(--nav-border) !important;
          background: var(--nav-hover) !important;
        }
        .editor-nav__title-input:focus-visible {
          border-color: var(--nav-accent) !important;
          background: var(--nav-accent-bg) !important;
          box-shadow: 0 0 0 2px var(--nav-accent-bg) !important;
          outline: none !important;
        }

        .editor-nav__meta {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--nav-muted);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .editor-nav__path {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 10.5px;
          color: var(--nav-accent);
          letter-spacing: 0.01em;
        }

        .editor-nav__dot {
          color: var(--nav-border);
        }

        .editor-nav__time {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
        }

        /* ── CENTER ── */
        .editor-nav__center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .editor-nav__tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          background: var(--nav-hover) !important;
          border: 1px solid var(--nav-border);
          border-radius: var(--nav-radius);
          height: auto !important;
        }

        .editor-nav__tab {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 28px;
          padding: 0;
          border-radius: 4px;
          color: var(--nav-muted);
          background: transparent;
          border: none;
          transition: color var(--transition), background var(--transition);
        }
        .editor-nav__tab:hover {
          color: var(--nav-text);
          background: var(--nav-bg);
        }
        .editor-nav__tab[data-state="active"] {
          color: var(--nav-accent);
          background: var(--nav-bg);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        /* ── RIGHT ── */
        .editor-nav__right {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .editor-nav__icon-btn {
          width: var(--nav-icon) !important;
          height: var(--nav-icon) !important;
          padding: 0 !important;
          border-radius: var(--nav-radius) !important;
          color: var(--nav-muted) !important;
          background: transparent !important;
          border: none !important;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition), background var(--transition) !important;
        }
        .editor-nav__icon-btn:hover:not(:disabled) {
          color: var(--nav-text) !important;
          background: var(--nav-hover) !important;
        }
        .editor-nav__icon-btn:disabled {
          opacity: 0.35 !important;
          cursor: not-allowed !important;
        }

        .editor-nav__separator {
          width: 1px;
          height: 20px;
          background: var(--nav-border);
          margin: 0 4px;
          flex-shrink: 0;
        }

        .editor-nav__save-btn {
          height: 32px !important;
          padding: 0 14px !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          border-radius: var(--nav-radius) !important;
          background: var(--nav-accent) !important;
          color: #fff !important;
          border: none !important;
          white-space: nowrap;
          letter-spacing: 0.02em;
          transition: opacity var(--transition), transform var(--transition) !important;
        }
        .editor-nav__save-btn:hover:not(:disabled) {
          opacity: 0.88 !important;
        }
        .editor-nav__save-btn:active:not(:disabled) {
          transform: scale(0.97) !important;
        }
        .editor-nav__save-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }

        .editor-nav__save-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: nav-spin 0.65s linear infinite;
          margin-right: 6px;
        }
        @keyframes nav-spin { to { transform: rotate(360deg); } }

        .editor-nav__kbd-hint {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
        }
      `}</style>
    </TooltipProvider>
  );
};

/** Small inline kbd badge */
const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <style>{`
      .nav-kbd {
        display: inline-flex;
        align-items: center;
        height: 18px;
        padding: 0 5px;
        border-radius: 3px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06);
        font-family: monospace;
        font-size: 10px;
        letter-spacing: 0.03em;
        color: inherit;
        opacity: 0.8;
      }
    `}</style>
    <kbd className="nav-kbd">{children}</kbd>
  </>
);

export default FunnelEditorNavigation;