"use client";

import React from "react";
import { Role } from "@prisma/client";
import { UserButton } from "@clerk/nextjs";
import {
  Bell, Search, Sparkles, ChevronRight, CheckCheck, Clock,
  X, Calendar, Filter, SlidersHorizontal, Star, Inbox, Zap,
  Loader2, ExternalLink, Eye, Settings2, Command,
} from "lucide-react";
import { format } from "date-fns";
import { useAutoAnimate } from "@formkit/auto-animate/react";

import GlobalSearchCommand from "@/components/common/GlobalSearchCommand";
import {
  Sheet, SheetContent, SheetDescription,
  SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ModeToggle } from "./ModeToggle";
import { Badge } from "../ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "../ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type NotificationsWithUser } from "@/lib/types";

interface InfoBarProps {
  notifications: NotificationsWithUser;
  subAccountId: string;
  role?: Role;
  className?: string;
}

const InfoBar: React.FC<InfoBarProps> = ({
  notifications, subAccountId, className, role,
}) => {
  const [allNotifications, setAllNotifications] = React.useState<NotificationsWithUser>(notifications);
  const [isShowAll, setIsShowAll]   = React.useState(true);
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [isLoading, setIsLoading]   = React.useState(false);
  const [filterBy, setFilterBy]     = React.useState("all");
  const [animatedListRef]           = useAutoAnimate();

  const notificationCount = allNotifications?.length || 0;

  const handleSwitch = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAllNotifications(
        !isShowAll
          ? notifications
          : (notifications?.filter((n) => n.subAccountId === subAccountId) ?? [])
      );
      setIsShowAll((p) => !p);
      setIsLoading(false);
    }, 300);
  };

  const getNotificationMeta = (notification: any) => {
    const type = notification.notification.split("|")[0]?.toLowerCase() || "";
    if (type.includes("payment") || type.includes("billing"))
      return { icon: <Zap className="h-3 w-3" />, color: "text-amber-400", bg: "bg-amber-400/10", dot: "bg-amber-400" };
    if (type.includes("user") || type.includes("member"))
      return { icon: <Star className="h-3 w-3" />, color: "text-violet-400", bg: "bg-violet-400/10", dot: "bg-violet-400" };
    if (type.includes("update") || type.includes("change"))
      return { icon: <Clock className="h-3 w-3" />, color: "text-sky-400", bg: "bg-sky-400/10", dot: "bg-sky-400" };
    return { icon: <Bell className="h-3 w-3" />, color: "text-primary/70", bg: "bg-primary/10", dot: "bg-primary" };
  };

  return (
    <TooltipProvider delayDuration={100}>
      {/* ─── NavBar Shell ───────────────────────────────────────────────────── */}
      <header className={cn(
        "sticky top-0 z-[40] w-full",
        "flex items-center justify-between",
        "h-[64px] px-4 gap-3",
        "relative overflow-hidden",

        // Layered glass
        "bg-background/60 backdrop-blur-[20px] backdrop-saturate-150",

        // Hairline bottom border with glow
        "border-b border-white/[0.06]",

        // Subtle inner top highlight — makes it feel "lifted"
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_32px_rgba(0,0,0,0.18)]",

        className
      )}>

        {/* ── Decorative: animated gradient beam across top edge ── */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-px overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
        </div>

        {/* ── Decorative: ambient glow puddle ── */}
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-[500px] h-20 bg-primary/10 blur-[40px] rounded-full opacity-70" />

        {/* ── Hidden: Command palette logic ── */}
        <div className="sr-only">
          <GlobalSearchCommand agencyId={subAccountId} sidebarOptions={[]} subAccounts={[]} />
        </div>

        {/* ════════════════ LEFT — SEARCH ════════════════ */}
        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[520px]">

          {/* Search pill */}
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))
            }
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onMouseEnter={() => setIsSearchFocused(true)}
            onMouseLeave={() => setIsSearchFocused(false)}
            className={cn(
              "group relative flex items-center gap-2.5",
              "w-full max-w-[380px] h-9 pl-3.5 pr-2.5",
              "rounded-[10px] border text-[13px] font-medium overflow-hidden",
              "transition-all duration-200 ease-out",
              // Resting
              "bg-white/[0.04] border-white/[0.08] text-muted-foreground/40",
              // Active
              isSearchFocused
                ? "bg-primary/[0.07] border-primary/30 text-muted-foreground/70 shadow-[0_0_0_3px_rgba(var(--primary),0.1)]"
                : "hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-muted-foreground/60"
            )}
          >
            {/* Sweep shimmer on hover */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[600ms] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none" />

            <Search className={cn(
              "w-3.5 h-3.5 shrink-0 transition-all duration-200",
              isSearchFocused ? "text-primary" : "text-muted-foreground/30"
            )} />

            <span className="truncate flex-1 text-left">Search workspace…</span>

            {/* ⌘K hint */}
            <span className="hidden sm:flex items-center gap-0.5 ml-auto shrink-0">
              <kbd className="inline-flex items-center gap-[2px] px-1.5 py-[3px] rounded-[5px] text-[9px] font-mono font-semibold leading-none bg-white/[0.06] border border-white/[0.1] text-muted-foreground/30">
                <Command className="w-[8px] h-[8px]" />K
              </kbd>
            </span>
          </button>

          {/* Filter pill buttons */}
          <div className="hidden lg:flex items-center gap-1">
            <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            {[{ Icon: Filter, tip: "Filter" }, { Icon: SlidersHorizontal, tip: "Advanced" }].map(({ Icon, tip }) => (
              <Tooltip key={tip}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-[9px] text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-all duration-150"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[11px] px-2 py-1">{tip}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* ════════════════ RIGHT — ACTIONS ════════════════ */}
        <div className="flex items-center gap-0.5 shrink-0">

          {/* ── Notification Bell ── */}
          <Sheet>
            <SheetTrigger asChild>
              <button className={cn(
                "relative h-9 w-9 rounded-[10px] flex items-center justify-center",
                "text-muted-foreground/40 transition-all duration-200",
                "hover:text-primary hover:bg-primary/10",
                "hover:shadow-[0_0_0_2px_rgba(var(--primary),0.12)]",
                "group"
              )}>
                <Bell className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />

                {/* Live dot badge */}
                {notificationCount > 0 && (
                  <span className="absolute top-[7px] right-[7px]">
                    <span className="relative flex h-[7px] w-[7px]">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/80 opacity-75" />
                      <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-destructive" />
                    </span>
                  </span>
                )}
              </button>
            </SheetTrigger>

            {/* ─────────────── Notification Drawer ─────────────── */}
            <SheetContent
              showClose={false}
              className={cn(
                "p-0 flex flex-col",
                "w-full sm:max-w-[380px]",
                "border-l border-white/[0.07]",
                "bg-[#080b14]/95 backdrop-blur-2xl",
              )}
            >
              {/* Drawer header */}
              <div className="relative flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06] overflow-hidden">
                {/* Header ambient */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent" />
                <div className="pointer-events-none absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                <SheetHeader className="text-left space-y-0">
                  <div className="flex items-center justify-between">
                    {/* Title cluster */}
                    <div className="flex items-center gap-3">
                      {/* Glowing icon */}
                      <div className="relative p-2 rounded-[10px] bg-primary/[0.12] border border-primary/20 shadow-[0_0_16px_rgba(var(--primary),0.15)]">
                        <Inbox className="h-4 w-4 text-primary" />
                        <div className="absolute inset-0 rounded-[10px] animate-pulse bg-primary/5" />
                      </div>
                      <div>
                        <SheetTitle className="text-[14px] font-bold tracking-[-0.01em] text-foreground/90">
                          Notifications
                        </SheetTitle>
                        <SheetDescription className="text-[11px] text-muted-foreground/40 mt-0.5 leading-none">
                          {notificationCount > 0 ? `${notificationCount} unread` : "You're all caught up"}
                        </SheetDescription>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setIsLoading(true); setTimeout(() => setIsLoading(false), 500); }}
                            disabled={isLoading}
                            className="h-7 w-7 rounded-[8px] flex items-center justify-center text-muted-foreground/35 hover:text-primary hover:bg-primary/10 transition-all"
                          >
                            {isLoading
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <CheckCheck className="h-3.5 w-3.5" />
                            }
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[11px]">Mark all read</TooltipContent>
                      </Tooltip>

                      <SheetClose asChild>
                        <button className="h-7 w-7 rounded-[8px] flex items-center justify-center text-muted-foreground/35 hover:text-destructive hover:bg-destructive/10 transition-all">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </SheetClose>
                    </div>
                  </div>
                </SheetHeader>

                {/* Filter strip */}
                <div className="flex items-center justify-between mt-4 gap-2">
                  {(role === Role.AGENCY_ADMIN || role === Role.AGENCY_OWNER) && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Switch
                        onCheckedChange={handleSwitch}
                        checked={!isShowAll}
                        disabled={isLoading}
                        className="data-[state=checked]:bg-primary h-4 w-7 [&>span]:h-3 [&>span]:w-3"
                      />
                      <span className="text-[11px] text-muted-foreground/40">This account only</span>
                    </label>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="ml-auto flex items-center gap-1 px-2 h-6 rounded-[7px] text-[11px] text-muted-foreground/40 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/15 transition-all">
                        <Filter className="h-2.5 w-2.5" />
                        {filterBy === "all" ? "All" : filterBy}
                        <ChevronRight className="h-2.5 w-2.5 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-28 bg-[#0d1020]/95 border-white/[0.08] backdrop-blur-xl rounded-xl text-xs">
                      {["all", "unread", "mentions", "updates"].map((f) => (
                        <DropdownMenuItem
                          key={f}
                          className="text-[11px] capitalize rounded-lg text-muted-foreground/70 hover:text-foreground focus:text-foreground focus:bg-white/[0.05]"
                          onClick={() => setFilterBy(f)}
                        >
                          {f === "all" ? "All types" : f}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* ── Notification List ── */}
              <div className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/[0.06]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
                    <p className="text-[11px] text-muted-foreground/30">Refreshing…</p>
                  </div>

                ) : allNotifications?.length ? (
                  <div ref={animatedListRef} className="flex flex-col gap-0.5">
                    {/* Date pill */}
                    <div className="flex items-center gap-2 px-2 py-2.5">
                      <div className="h-px flex-1 bg-white/[0.05]" />
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/25">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(), "MMM d, yyyy")}
                      </span>
                      <div className="h-px flex-1 bg-white/[0.05]" />
                    </div>

                    {allNotifications.map((notification, index) => {
                      const safeName = notification.user.name?.replace("null", "").trim() || "User";
                      const parts    = notification.notification.split("|");
                      const isUnread = index < 2;
                      const meta     = getNotificationMeta(notification);

                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            "group relative flex gap-3 p-3 rounded-[12px] cursor-pointer",
                            "transition-all duration-150 ease-out",
                            isUnread
                              ? "bg-primary/[0.04] border border-primary/[0.12] hover:bg-primary/[0.07]"
                              : "border border-transparent hover:bg-white/[0.03] hover:border-white/[0.07]"
                          )}
                        >
                          {/* Unread accent bar */}
                          {isUnread && (
                            <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-primary/70" />
                          )}

                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <Avatar className="h-8 w-8 rounded-[9px] ring-1 ring-white/[0.08] group-hover:ring-primary/20 transition-all">
                              <AvatarImage src={notification.user.avatarUrl} alt={safeName} />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-[9px] font-bold rounded-[9px]">
                                {safeName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {/* Type dot */}
                            <span className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-[#080b14] flex items-center justify-center",
                              meta.bg
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <p className="text-[12px] leading-[1.4] text-muted-foreground/80">
                                <span className="font-semibold text-foreground/90">{parts[0] || ""}</span>
                                {parts[1] && <> <span className="text-muted-foreground/50">{parts[1]}</span></>}
                                {parts[2] && <> <span className={cn("font-medium", meta.color)}>{parts[2]}</span></>}
                              </p>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0 mt-0.5 text-muted-foreground/15 group-hover:text-primary/40 transition-colors" />
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30">
                              <Clock className="h-2.5 w-2.5" />
                              <span>{format(new Date(notification.createdAt), "hh:mm a")}</span>
                              <span className="opacity-40">·</span>
                              <span>{format(new Date(notification.createdAt), "dd MMM")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                ) : (
                  /* ── Empty state ── */
                  <div className="flex flex-col items-center justify-center h-60 gap-4 text-center px-6">
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/[0.03] border border-primary/[0.08]">
                        <Bell className="h-6 w-6 text-primary/25" />
                      </div>
                      <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary/35 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground/50">All clear</p>
                      <p className="text-[11px] text-muted-foreground/30 mt-1">No new notifications right now</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground/25 border-white/[0.06] px-2.5 py-1">
                      Last checked {format(new Date(), "hh:mm a")}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              {!!allNotifications?.length && (
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-white/[0.05]">
                  <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground/35 hover:text-primary transition-colors px-2 py-1 rounded-[7px] hover:bg-primary/10">
                    <Eye className="h-3 w-3" /> Mark all read
                  </button>
                  <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground/35 hover:text-primary transition-colors px-2 py-1 rounded-[7px] hover:bg-primary/10">
                    <Settings2 className="h-3 w-3" /> Preferences
                  </button>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* ── Vertical rule ── */}
          <div className="w-px h-4 bg-white/[0.08] mx-2" />

          {/* ── Theme toggle ── */}
          <div className="[&>button]:h-9 [&>button]:w-9 [&>button]:rounded-[10px] [&>button]:text-muted-foreground/35 [&>button]:hover:text-primary [&>button]:hover:bg-primary/10 [&>button]:border-0 [&>button]:transition-all [&>button]:duration-150">
            <ModeToggle />
          </div>

          {/* ── Vertical rule ── */}
          <div className="w-px h-4 bg-white/[0.08] mx-2" />

          {/* ── User ── */}
          <div className="flex items-center gap-2.5">
            {/* Avatar with hover glow */}
            <div className="relative group/u">
              <div className="absolute inset-0 rounded-[11px] bg-primary/20 blur-md opacity-0 group-hover/u:opacity-100 scale-110 transition-opacity duration-300 pointer-events-none" />
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 rounded-[10px] ring-1 ring-white/[0.1] hover:ring-primary/30 transition-all duration-200",
                    userButtonPopoverCard: "bg-[#0d1020]/95 backdrop-blur-2xl border border-white/[0.07] shadow-2xl rounded-2xl",
                    userButtonPopoverActions: "p-1.5",
                    userButtonPopoverActionButton: "hover:bg-white/[0.05] hover:text-primary rounded-xl transition-all text-[13px]",
                    userButtonPopoverFooter: "hidden",
                  },
                }}
              />
            </div>

            {/* Role text */}
            <div className="hidden lg:flex flex-col gap-0 leading-none">
              <span className="text-[12px] font-semibold text-foreground/70 tracking-[-0.01em]">Active</span>
              <span className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.1em] mt-0.5">
                {role?.replace(/_/g, " ") || "User"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); opacity: 0; }
          30%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </TooltipProvider>
  );
};

export default InfoBar;