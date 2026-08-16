"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

import {
  type User,
  type AgencySidebarOption,
  type SubAccount,
  type SubAccountSidebarOption,
  type Agency,
  type Permissions,
  Role,
} from "@prisma/client";

import {
  ChevronsUpDown,
  Compass,
  Menu,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Crown,
  Star,
  Bell,
  LogOut,
  Command as CommandIcon,
  Zap,
  ShieldCheck,
  CreditCard,
  User as UserIcon,
  HelpCircle,
  MoreVertical,
  Sparkles,
  X,
  Building2,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Keyboard,
} from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
  CommandSeparator,
} from "../ui/command";
import { ScrollArea } from "../ui/scroll-area";
import CustomModal from "../common/CustomModal";
import SubAccountDetails from "../forms/SubAccountDetails";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

import { cn } from "@/lib/utils";
import { useModal } from "@/hooks/use-modal";
import { icons } from "../ui/icons";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MenuOptionsProps {
  id: string;
  defaultOpen?: boolean;
  sideBarLogo: string;
  subAccount: SubAccount[];
  sideBarOptions: AgencySidebarOption[] | SubAccountSidebarOption[];
  details: Agency | SubAccount;
  user: {
    agency: Agency | null;
    permissions: Permissions[];
  } & User;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeSlide = {
  initial: { opacity: 0, x: -10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: { duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: 0.14 },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.88 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.16, ease: [0.34, 1.56, 0.64, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.88,
    transition: { duration: 0.1 },
  },
};

const staggerList = {
  animate: {
    transition: { staggerChildren: 0.035, delayChildren: 0.04 },
  },
};

const staggerItem = {
  initial: { opacity: 0, x: -10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refined logo orb — conic gradient ring + frosted inner
 */
const LogoOrb = ({
  src,
  name,
  size = 40,
}: {
  src: string;
  name?: string;
  size?: number;
}) => {
  const borderRadius = Math.round(size * 0.3);
  const innerRadius = Math.round(size * 0.27);
  const innerSize = size - 4;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Conic gradient ring */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius,
          padding: "1.5px",
          background:
            "conic-gradient(from 225deg at 50% 50%, hsl(var(--primary)/0.9) 0%, hsl(var(--primary)/0.25) 40%, hsl(var(--primary)/0.9) 100%)",
        }}
      >
        <div
          className="w-full h-full bg-background"
          style={{ borderRadius: innerRadius }}
        />
      </div>

      {/* Inner surface */}
      <div
        className="absolute overflow-hidden flex items-center justify-center"
        style={{
          inset: 2,
          borderRadius: innerRadius,
          background:
            "linear-gradient(145deg, hsl(var(--primary)/0.10) 0%, hsl(var(--background)) 60%)",
        }}
      >
        {src ? (
          <Image
            src={src}
            alt={name ?? "Logo"}
            width={innerSize - 8}
            height={innerSize - 8}
            className="object-contain"
          />
        ) : (
          <span
            className="font-extrabold text-primary"
            style={{ fontSize: Math.round(size * 0.35) }}
          >
            {(name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Animated status dot
 */
const StatusDot = ({
  status = "online",
}: {
  status?: "online" | "away" | "offline";
}) => {
  const colors: Record<string, string> = {
    online: "bg-emerald-500",
    away: "bg-amber-400",
    offline: "bg-zinc-400",
  };
  return (
    <span className="relative flex h-[11px] w-[11px]">
      {status === "online" && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-60`}
        />
      )}
      <span
        className={`relative inline-flex h-[11px] w-[11px] rounded-full border-[1.5px] border-background ${colors[status]}`}
      />
    </span>
  );
};

/**
 * Section divider label
 */
const SectionLabel = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 px-3 py-2 mt-1">
    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/30 whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
  </div>
);

/**
 * Plan badge with shimmer
 */
const PlanBadge = ({ plan = "Pro" }: { plan?: string }) => (
  <div className="relative overflow-hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/6">
    <span
      className="absolute inset-0 translate-x-[-100%]"
      style={{
        background:
          "linear-gradient(90deg, transparent, hsl(45 100% 60% / 0.12), transparent)",
        animation: "sidebarShimmer 2.8s ease-in-out infinite",
      }}
    />
    <Zap className="h-2.5 w-2.5 text-amber-500 fill-amber-500 shrink-0 relative z-10" />
    <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider relative z-10">
      {plan}
    </span>
  </div>
);

/**
 * Inline text highlight for search match
 */
const HighlightMatch = ({
  text,
  query,
}: {
  text: string;
  query: string;
}) => {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="not-italic bg-primary/15 text-primary rounded-sm px-0.5 font-extrabold"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

/**
 * Workspace switcher row
 */
const WorkspaceRow = ({
  data,
  type,
  pathname,
  onSelect,
}: {
  data: any;
  type: "agency" | "subaccount";
  pathname: string;
  onSelect: () => void;
}) => {
  const isActive = pathname.includes(data.id);
  const logoSrc =
    type === "agency" ? data.agencyLogo : data.subAccountLogo;

  return (
    <CommandItem
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 p-2.5 cursor-pointer rounded-xl transition-all duration-150 group mb-0.5",
        isActive
          ? "bg-primary/8 text-primary"
          : "hover:bg-secondary/50 text-foreground/80 hover:text-foreground"
      )}
    >
      {/* Logo thumbnail */}
      <div
        className={cn(
          "relative h-9 w-9 rounded-xl overflow-hidden shrink-0 transition-all duration-150",
          isActive
            ? "ring-2 ring-primary/50 ring-offset-[1.5px] ring-offset-background shadow-sm shadow-primary/15"
            : "ring-1 ring-border/40 group-hover:ring-primary/25"
        )}
      >
        {logoSrc ? (
          <Image
            src={logoSrc}
            fill
            alt={data.name ?? "Account"}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/15 to-primary/4 flex items-center justify-center">
            {type === "agency" ? (
              <Building2 className="h-4 w-4 text-primary/50" />
            ) : (
              <Layers className="h-4 w-4 text-primary/50" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <span className="text-[13px] font-semibold truncate leading-snug">
          {data.name}
        </span>
        <span className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
          {data.address}
        </span>
      </div>

      {/* Active check */}
      {isActive ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-border/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </CommandItem>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const MenuOptions: React.FC<MenuOptionsProps> = ({
  details,
  id,
  sideBarLogo,
  sideBarOptions,
  subAccount,
  user,
  defaultOpen,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const { setOpen } = useModal();
  const pathname = usePathname();
  const router = useRouter();

  // ── Lifecycle ──────────────────────────────────────────────────────────────
 useEffect(() => {
  setIsMounted(true);

  const saved = localStorage.getItem("sidebar-state");
  if (saved) {
    const collapsed = JSON.parse(saved);
    setIsCollapsed(collapsed);

    // 🔥 Sync layout with sidebar state (fixes gap)
    if (collapsed) {
      document.body.classList.add("sidebar-collapsed");
    } else {
      document.body.classList.remove("sidebar-collapsed");
    }
  }
}, []);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isCollapsed) {
          setIsCollapsed(false);
          localStorage.setItem("sidebar-state", "false");
        }
        setTimeout(() => searchRef.current?.focus(), 80);
      }
      if (e.key === "Escape" && isSearchFocused) {
        setSearchQuery("");
        setIsSearchFocused(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isCollapsed, isSearchFocused]);

  // ── Helpers ────────────────────────────────────────────────────────────────
 const toggleSidebar = () => {
  const next = !isCollapsed;
  setIsCollapsed(next);
  localStorage.setItem("sidebar-state", JSON.stringify(next));

  // 🔥 CRITICAL: sync layout with sidebar state
  if (next) {
    document.body.classList.add("sidebar-collapsed");
  } else {
    document.body.classList.remove("sidebar-collapsed");
  }
};

  const isOwner = user.role === Role.AGENCY_OWNER;
  const isAdmin = user.role === Role.AGENCY_ADMIN;
  const isSubAccount = "agencyId" in details;
  const logoHref = isSubAccount
    ? `/subaccount/${details.id}`
    : `/agency/${details.id}`;

  const hasSearch = searchQuery.trim().length > 0;

  const roleLabel = user.role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

  if (!isMounted) return null;

  return (
    <TooltipProvider delayDuration={0}>
      {/* Keyframe injections */}
      <style>{`
        @keyframes sidebarShimmer {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(200%); }
          100% { transform: translateX(200%); }
        }
        @keyframes floatCrown {
          0%, 100% { transform: translateY(0px) rotate(12deg); }
          50%       { transform: translateY(-5px) rotate(14deg); }
        }
        .sb-scroll::-webkit-scrollbar        { width: 3px; }
        .sb-scroll::-webkit-scrollbar-track  { background: transparent; }
        .sb-scroll::-webkit-scrollbar-thumb  { background: hsl(var(--border)/0.35); border-radius: 2px; }
        .sb-scroll::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary)/0.35); }
      `}</style>

      <Sheet modal={false} open={defaultOpen ? true : undefined}>
        {/* ── Mobile trigger ─────────────────────────────────────────────── */}
        <SheetTrigger asChild className="md:hidden fixed top-4 left-4 z-50">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="icon"
              variant="outline"
              className="rounded-2xl shadow-2xl h-11 w-11 bg-background/80 backdrop-blur-xl border-border/50 hover:border-primary/40 transition-all"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </motion.div>
        </SheetTrigger>

        {/* ── Sidebar panel ──────────────────────────────────────────────── */}
        <SheetContent
          showClose={!defaultOpen}
          side="left"
          className={cn(
            "p-0 border-r border-border/25 bg-background/65 backdrop-blur-[28px] overflow-hidden flex flex-col transition-all duration-300",
            defaultOpen
              ? isCollapsed
                ? "w-[76px]"
                : "w-[288px]"
              : "w-full"
          )}
        >
          {/* Decorative overlays */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            <div className="absolute inset-0 opacity-[0.012]"
              style={{
                backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            {/* ═══════════════════════════════════════════════════════════════
                § 1  BRAND HEADER
            ═══════════════════════════════════════════════════════════════ */}
            <div
              className={cn(
                "px-4 pt-5 pb-3 flex items-center",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              <Link href={logoHref} className="flex items-center gap-3 group min-w-0">
                <motion.div
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                >
                  <LogoOrb src={sideBarLogo} name={details.name} size={40} />
                </motion.div>

                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.div
                      key="brand"
                      variants={fadeSlide}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col min-w-0"
                    >
                      <span className="font-extrabold text-[13px] tracking-[-0.02em] truncate max-w-[140px] leading-snug">
                        {details.name}
                      </span>
                      <div className="mt-1">
                        <PlanBadge plan="Pro" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    key="toggle-btn"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1, transition: { duration: 0.14 } }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
                    className="shrink-0"
                  >
                    <Button
                      onClick={toggleSidebar}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl hover:bg-primary/8 text-muted-foreground/50 hover:text-primary transition-all border border-transparent hover:border-primary/12"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hairline separator */}
            <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

            {/* ═══════════════════════════════════════════════════════════════
                § 2  WORKSPACE SWITCHER
            ═══════════════════════════════════════════════════════════════ */}
            <div className={cn("px-3 mb-2", isCollapsed && "flex justify-center")}>
              <Popover open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl border transition-all duration-200 cursor-pointer",
                      "border-border/35 bg-secondary/15 hover:bg-secondary/35 hover:border-border/55",
                      isWorkspaceOpen &&
                        "border-primary/28 bg-primary/4 shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]",
                      isCollapsed
                        ? "h-11 w-11 p-0 justify-center"
                        : "w-full h-[50px] px-3 justify-between"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center border transition-all duration-200",
                          "bg-background/80 border-border/35",
                          "group-hover:border-primary/18 group-hover:bg-primary/4",
                          isWorkspaceOpen && "border-primary/25 bg-primary/6"
                        )}
                      >
                        <Compass
                          className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isWorkspaceOpen
                              ? "text-primary"
                              : "text-muted-foreground/60 group-hover:text-primary"
                          )}
                        />
                      </div>

                      <AnimatePresence mode="wait">
                        {!isCollapsed && (
                          <motion.div
                            key="ws-label"
                            variants={fadeSlide}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex flex-col items-start"
                          >
                            <span className="text-xs font-bold leading-tight">
                              Workspaces
                            </span>
                            <span className="text-[10px] text-muted-foreground/55 mt-0.5">
                              {subAccount.length + 1} active accounts
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {!isCollapsed && (
                      <motion.div
                        animate={{ rotate: isWorkspaceOpen ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </motion.div>
                    )}
                  </motion.button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[316px] p-0 overflow-hidden rounded-2xl border-border/40 shadow-2xl bg-background/95 backdrop-blur-2xl"
                  align="start"
                  sideOffset={10}
                >
                  <Command>
                    <div className="flex items-center gap-2 px-3 border-b border-border/35 bg-secondary/8">
                      <Search className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                      <CommandInput
                        placeholder="Search accounts..."
                        className="border-none focus:ring-0 h-10 text-sm bg-transparent placeholder:text-muted-foreground/30"
                      />
                    </div>

                    <CommandList className="max-h-[300px] overflow-y-auto sb-scroll">
                      <CommandEmpty>
                        <div className="flex flex-col items-center gap-2.5 py-8">
                          <div className="h-10 w-10 rounded-2xl bg-secondary/50 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-muted-foreground/30" />
                          </div>
                          <span className="text-xs text-muted-foreground/50">
                            No accounts found
                          </span>
                        </div>
                      </CommandEmpty>

                      {user.agency && (
                        <CommandGroup className="p-2 pb-1">
                          <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
                            <Building2 className="h-3 w-3 text-muted-foreground/30" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                              Agency
                            </span>
                          </div>
                          <WorkspaceRow
                            data={user.agency}
                            type="agency"
                            pathname={pathname}
                            onSelect={() => {
                              setIsWorkspaceOpen(false);
                              router.push(`/agency/${user.agency!.id}`);
                            }}
                          />
                        </CommandGroup>
                      )}

                      {subAccount.length > 0 && (
                        <>
                          <CommandSeparator className="bg-border/25 mx-2" />
                          <CommandGroup className="p-2 pt-1">
                            <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
                              <Layers className="h-3 w-3 text-muted-foreground/30" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                                Sub Accounts
                              </span>
                              <Badge
                                variant="secondary"
                                className="h-4 text-[9px] px-1.5 ml-auto font-bold"
                              >
                                {subAccount.length}
                              </Badge>
                            </div>
                            {subAccount.map((sub) => (
                              <WorkspaceRow
                                key={sub.id}
                                data={sub}
                                type="subaccount"
                                pathname={pathname}
                                onSelect={() => {
                                  setIsWorkspaceOpen(false);
                                  router.push(`/subaccount/${sub.id}`);
                                }}
                              />
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>

                    {(isOwner || isAdmin) && (
                      <div className="p-2 border-t border-border/25 bg-secondary/8">
                        <Button
                          onClick={() => {
                            setIsWorkspaceOpen(false);
                            setOpen(
                              <CustomModal
                                title="Create Sub Account"
                                subTitle="Expand your reach with a new sub account"
                              >
                                <SubAccountDetails
                                  agencyDetails={user.agency!}
                                  userId={user.id}
                                  userName={user.name}
                                />
                              </CustomModal>
                            );
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-2.5 text-primary hover:bg-primary/8 rounded-xl h-9 group"
                        >
                          <div className="h-5 w-5 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                            <PlusCircle className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-bold">
                            Create Sub Account
                          </span>
                        </Button>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                § 3  SEARCH BAR
            ═══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  key="search-bar"
                  variants={fadeSlide}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="px-3 mb-1"
                >
                  <div
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border transition-all duration-250 cursor-text",
                      isSearchFocused
                        ? "border-primary/38 bg-background shadow-[0_0_0_3px_hsl(var(--primary)/0.07)]"
                        : "border-border/28 bg-secondary/18 hover:border-border/50 hover:bg-secondary/30"
                    )}
                    onClick={() => searchRef.current?.focus()}
                  >
                    <motion.div
                      animate={{
                        color: isSearchFocused
                          ? "hsl(var(--primary))"
                          : "hsl(var(--muted-foreground)/0.35)",
                      }}
                      transition={{ duration: 0.18 }}
                      className="shrink-0"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </motion.div>

                    <input
                      ref={searchRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      placeholder="Search navigation..."
                      className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground/30 text-foreground caret-primary"
                    />

                    <AnimatePresence mode="wait">
                      {searchQuery ? (
                        <motion.button
                          key="clear"
                          variants={scaleIn}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery("");
                            searchRef.current?.focus();
                          }}
                          className="h-4 w-4 rounded-full bg-muted-foreground/18 hover:bg-muted-foreground/28 flex items-center justify-center transition-colors shrink-0"
                        >
                          <X className="h-2.5 w-2.5 text-muted-foreground" />
                        </motion.button>
                      ) : (
                        <motion.div
                          key="hint"
                          variants={scaleIn}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="hidden lg:flex items-center shrink-0"
                        >
                          <kbd className="inline-flex h-4 items-center gap-0.5 rounded border border-border/45 bg-background/70 px-1.5 font-mono text-[9px] text-muted-foreground/40">
                            <CommandIcon className="h-2 w-2" />K
                          </kbd>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Search result count */}
                  <AnimatePresence>
                    {hasSearch && (
                      <motion.div
                        key="count"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="px-1 pt-1.5">
                          <span className="text-[10px] text-muted-foreground/45">
                            {
                              sideBarOptions.filter((o) =>
                                o.name.toLowerCase().includes(searchQuery.toLowerCase())
                              ).length
                            }{" "}
                            result
                            {sideBarOptions.filter((o) =>
                              o.name.toLowerCase().includes(searchQuery.toLowerCase())
                            ).length !== 1
                              ? "s"
                              : ""}{" "}
                            for{" "}
                            <span className="text-primary font-semibold">
                              &quot;{searchQuery}&quot;
                            </span>
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════════════════
                § 4  MAIN NAVIGATION
                CRITICAL: Always uses sideBarOptions.map — never replaced
            ═══════════════════════════════════════════════════════════════ */}
            <ScrollArea className="flex-1 sb-scroll">
              <div className="px-2 pt-1 pb-4">
                {!isCollapsed && !hasSearch && (
                  <SectionLabel label={isSubAccount ? "Sub Account" : "Agency"} />
                )}

                <LayoutGroup id="sidebar-nav">
                  <motion.div
                    variants={staggerList}
                    initial="animate"
                    animate="animate"
                    className="space-y-0.5"
                  >
                    {sideBarOptions.map((option) => {
                      const Icon =
                        icons.find((i) => i.value === option.icon)?.path || Star;
                      const active = pathname === option.link;
                      const isHovered = hoveredItem === option.id;

                      // Visibility for search filter (option hidden but NEVER skipped from map)
                      const isVisible =
                        !hasSearch ||
                        option.name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase());

                      return (
                        <motion.div
                          key={option.id}
                          layout
                          animate={{
                            opacity: isVisible ? 1 : 0,
                            height: isVisible ? "auto" : 0,
                            marginBottom: isVisible ? undefined : 0,
                          }}
                          transition={{
                            layout: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
                            opacity: { duration: 0.15 },
                            height: { duration: 0.18 },
                          }}
                          style={{ overflow: "hidden" }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={option.link}
                                onMouseEnter={() => setHoveredItem(option.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                                className={cn(
                                  "group relative flex items-center rounded-xl transition-colors duration-150 select-none",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-1",
                                  active
                                    ? "text-primary"
                                    : "text-muted-foreground/60 hover:text-foreground",
                                  isCollapsed
                                    ? "justify-center h-11 w-11 mx-auto gap-0"
                                    : "justify-start gap-3 px-3 py-[9px]"
                                )}
                              >
                                {/* Spring-animated active background */}
                                {active && (
                                  <motion.div
                                    layoutId="nav-active-bg"
                                    className="absolute inset-0 rounded-xl bg-primary/7 border border-primary/10"
                                    transition={{
                                      type: "spring",
                                      stiffness: 380,
                                      damping: 30,
                                    }}
                                  />
                                )}

                                {/* Hover background */}
                                <AnimatePresence>
                                  {!active && isHovered && (
                                    <motion.div
                                      key={`hover-${option.id}`}
                                      className="absolute inset-0 rounded-xl bg-secondary/45"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.1 }}
                                    />
                                  )}
                                </AnimatePresence>

                                {/* Left accent bar */}
                                {active && !isCollapsed && (
                                  <motion.div
                                    layoutId="nav-accent"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full bg-primary"
                                    transition={{
                                      type: "spring",
                                      stiffness: 380,
                                      damping: 30,
                                    }}
                                  />
                                )}

                                {/* Icon */}
                                <motion.div
                                  className={cn(
                                    "relative z-10 shrink-0 flex items-center justify-center transition-colors duration-150",
                                    active
                                      ? "text-primary"
                                      : "text-muted-foreground/45 group-hover:text-foreground"
                                  )}
                                  whileHover={{ scale: 1.12 }}
                                  whileTap={{ scale: 0.88 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 600,
                                    damping: 22,
                                  }}
                                >
                                  {/* Glow behind active icon */}
                                  {active && (
                                    <span className="absolute inset-0 blur-[10px] bg-primary/25 rounded-full scale-[1.6]" />
                                  )}
                                  <Icon
                                    size={isCollapsed ? 20 : 16}
                                    strokeWidth={active ? 2.5 : 1.75}
                                    className="relative z-10"
                                  />
                                </motion.div>

                                {/* Label */}
                                <AnimatePresence mode="wait">
                                  {!isCollapsed && (
                                    <motion.span
                                      key={`lbl-${option.id}`}
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{
                                        opacity: 1,
                                        x: 0,
                                        transition: { duration: 0.15 },
                                      }}
                                      exit={{
                                        opacity: 0,
                                        x: -6,
                                        transition: { duration: 0.1 },
                                      }}
                                      className={cn(
                                        "relative z-10 text-[13px] tracking-[-0.01em] flex-1 transition-colors duration-150 whitespace-nowrap",
                                        active ? "font-bold" : "font-medium"
                                      )}
                                    >
                                      {hasSearch ? (
                                        <HighlightMatch
                                          text={option.name}
                                          query={searchQuery}
                                        />
                                      ) : (
                                        option.name
                                      )}
                                    </motion.span>
                                  )}
                                </AnimatePresence>

                                {/* Active trailing dot */}
                                {active && !isCollapsed && (
                                  <motion.div
                                    layoutId="nav-dot"
                                    className="relative z-10 h-[6px] w-[6px] rounded-full bg-primary shrink-0"
                                    transition={{
                                      type: "spring",
                                      stiffness: 380,
                                      damping: 30,
                                    }}
                                  />
                                )}
                              </Link>
                            </TooltipTrigger>

                            {isCollapsed && (
                              <TooltipContent
                                side="right"
                                sideOffset={14}
                                className="bg-background/95 backdrop-blur-xl border-border/40 shadow-xl rounded-xl px-3 py-1.5"
                              >
                                <span className="text-xs font-semibold">
                                  {option.name}
                                </span>
                                {active && (
                                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                                )}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </LayoutGroup>

                {/* Empty search state */}
                <AnimatePresence>
                  {hasSearch &&
                    sideBarOptions.filter((o) =>
                      o.name.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 && (
                      <motion.div
                        variants={fadeUp}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-col items-center gap-3 py-8 text-center"
                      >
                        <div className="h-11 w-11 rounded-2xl bg-secondary/50 border border-border/30 flex items-center justify-center">
                          <Search className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground/60">
                            Nothing found
                          </p>
                          <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                            Try a different keyword
                          </p>
                        </div>
                        <button
                          onClick={() => setSearchQuery("")}
                          className="text-[11px] text-primary font-semibold hover:underline underline-offset-2"
                        >
                          Clear search
                        </button>
                      </motion.div>
                    )}
                </AnimatePresence>

                {/* Support section */}
                <AnimatePresence>
                  {!isCollapsed && !hasSearch && (
                    <motion.div
                      key="support"
                      variants={fadeUp}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <SectionLabel label="Support" />
                      <div className="space-y-0.5 mt-0.5">
                        {[
                          { icon: HelpCircle, label: "Help Center", ext: true },
                          { icon: ShieldCheck, label: "Security & Privacy" },
                          { icon: Keyboard, label: "Keyboard Shortcuts" },
                        ].map(({ icon: Icon, label, ext }) => (
                          <Link
                            key={label}
                            href="#"
                            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-muted-foreground/50 hover:text-foreground hover:bg-secondary/35 transition-all duration-150 group"
                          >
                            <Icon
                              size={13}
                              strokeWidth={1.75}
                              className="shrink-0 group-hover:text-primary transition-colors"
                            />
                            <span className="flex-1">{label}</span>
                            {ext && (
                              <ExternalLink
                                size={10}
                                className="opacity-0 group-hover:opacity-35 transition-opacity"
                              />
                            )}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* ═══════════════════════════════════════════════════════════════
                § 5  UPGRADE CARD
            ═══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  key="upgrade"
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="px-3 pb-3"
                >
                  <div
                    className="relative group overflow-hidden rounded-2xl border border-primary/12 p-4 transition-all duration-300 hover:border-primary/22 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                    style={{
                      background:
                        "linear-gradient(145deg, hsl(var(--primary)/0.055) 0%, hsl(var(--background)) 55%, hsl(240 70% 55% / 0.035) 100%)",
                    }}
                  >
                    {/* Sweep shimmer on hover */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-700 ease-in-out" />

                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/12 flex items-center justify-center">
                          <Sparkles size={12} className="text-primary" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                          Upgrade Plan
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground/60 leading-relaxed mb-3">
                        Unlock white-labeling, advanced automations & priority support.
                      </p>

                      <div className="flex items-center justify-between">
                        <Button
                          variant="link"
                          className="p-0 h-auto text-[11px] text-primary font-bold hover:no-underline flex items-center gap-1 group/cta"
                        >
                          View all plans
                          <ArrowUpRight
                            size={11}
                            className="group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 transition-transform duration-150"
                          />
                        </Button>
                        {/* Avatar stack decoration */}
                        <div className="flex -space-x-1.5">
                          {[
                            "bg-primary/25",
                            "bg-primary/45",
                            "bg-primary/65",
                          ].map((bg, i) => (
                            <div
                              key={i}
                              className={`h-4 w-4 rounded-full border-[1.5px] border-background ${bg}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Floating crown */}
                    <div
                      className="absolute -right-2 -bottom-1.5 text-primary opacity-[0.055] group-hover:opacity-[0.09] transition-opacity duration-300"
                      style={{ animation: "floatCrown 4.5s ease-in-out infinite" }}
                    >
                      <Crown size={66} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════════════════
                § 6  USER PROFILE FOOTER
            ═══════════════════════════════════════════════════════════════ */}
           <div
  className={cn(
    "border-t border-border/20 bg-gradient-to-b from-background to-secondary/20 backdrop-blur-xl transition-all duration-200",
    isCollapsed ? "p-2" : "p-3"
  )}
>
              <Popover open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "w-full flex items-center rounded-2xl transition-all duration-200 cursor-pointer",
                      "border border-transparent hover:border-border/25 hover:bg-secondary/35",
                      isCollapsed
                        ? "justify-center p-2"
                        : "justify-between p-2.5 gap-3"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center",
                        isCollapsed ? "gap-0" : "gap-3"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 rounded-xl ring-1 ring-border/35 shadow-sm">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/18 to-primary/4 text-primary font-extrabold rounded-xl text-[13px]">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 border-2 border-background rounded-full">
                          <StatusDot status="online" />
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
  {!isCollapsed && (
    <motion.div
      key="user-info"
      variants={fadeSlide}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col items-start min-w-0"
    >
      {/* 🔥 CLEAN NAME (NO NULL) */}
      <span className="text-[13px] font-semibold tracking-tight truncate max-w-[140px] leading-tight">
        {(user.name || "User")
          .replace("null", "")
          .replace("undefined", "")
          .trim()}
      </span>

      {/* 🔥 IMPROVED ROLE BADGE DESIGN */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-[9px] px-2 py-[2px] rounded-md bg-primary/10 text-primary font-semibold uppercase tracking-wider">
          {roleLabel}
        </span>
      </div>
    </motion.div>
  )}
</AnimatePresence>
                    </div>

                    {!isCollapsed && (
                      <MoreVertical className="h-4 w-4 text-muted-foreground/28 shrink-0" />
                    )}
                  </motion.button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[244px] p-2 rounded-2xl border-border/35 shadow-2xl bg-background/95 backdrop-blur-2xl"
                  side={isCollapsed ? "right" : "top"}
                  sideOffset={10}
                  align={isCollapsed ? "start" : "end"}
                >
                  {/* Profile header inside popover */}
                  <div className="flex items-center gap-3 px-2 py-2 mb-2">
                    <Avatar className="h-9 w-9 rounded-xl ring-1 ring-border/25">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold rounded-xl text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold truncate">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/55 truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  <Separator className="bg-border/25 mb-2" />

                  {/* Account actions */}
                  <div className="space-y-0.5">
                    {[
                      {
                        icon: UserIcon,
                        label: "My Profile",
                        sub: "View & edit details",
                        action: () => {
                          setIsProfileOpen(false);
                          router.push("/settings");
                        },
                      },
                      {
                        icon: CreditCard,
                        label: "Billing",
                        sub: "Manage subscriptions",
                        action: undefined,
                      },
                      {
                        icon: Bell,
                        label: "Notifications",
                        sub: "Alerts & preferences",
                        action: undefined,
                      },
                    ].map(({ icon: Icon, label, sub, action }) => (
                      <button
                        key={label}
                        onClick={action}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-secondary/55 transition-colors duration-150 text-left group"
                      >
                        <div className="h-7 w-7 rounded-lg bg-secondary/70 flex items-center justify-center border border-border/25 group-hover:border-primary/18 group-hover:bg-primary/5 transition-all shrink-0">
                          <Icon
                            size={13}
                            strokeWidth={1.8}
                            className="text-muted-foreground/60 group-hover:text-primary transition-colors"
                          />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-xs font-semibold leading-snug">
                            {label}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40 mt-0.5">
                            {sub}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <Separator className="bg-border/25 my-2" />

                  {/* Sign out */}
                  <button className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/15 transition-colors duration-150 group">
                    <div className="h-7 w-7 rounded-lg bg-red-100/80 dark:bg-red-950/25 flex items-center justify-center border border-red-200/40 dark:border-red-900/25 shrink-0">
                      <LogOut
                        size={13}
                        strokeWidth={1.8}
                        className="text-red-500"
                      />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold text-red-500 group-hover:text-red-600 leading-snug">
                        Sign Out
                      </span>
                      <span className="text-[9px] text-red-400/50 mt-0.5">
                        End your session
                      </span>
                    </div>
                  </button>
                </PopoverContent>
              </Popover>

              {/* Expand trigger (collapsed state) */}
              {isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.1 } }}
                  className="mt-2 flex justify-center"
                >
                  <Button
                    onClick={toggleSidebar}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-primary/7 text-muted-foreground/40 hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/12"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </div>
            {/* end profile footer */}
          </div>
          {/* end flex col */}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
};

export default MenuOptions;
