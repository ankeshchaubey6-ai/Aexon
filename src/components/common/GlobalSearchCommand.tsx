"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Command as CommandIcon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface GlobalSearchCommandProps {
  agencyId: string;
  sidebarOptions?: {
    name: string;
    link: string;
  }[];
  subAccounts?: {
    id: string;
    name: string;
  }[];
}

const GlobalSearchCommand: React.FC<GlobalSearchCommandProps> = ({
  agencyId,
  sidebarOptions = [],
  subAccounts = [],
}) => {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // 🔥 Native Ctrl + K / Cmd + K (NO external library)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // 🔥 Core global routes (entire app searchable)
  const coreRoutes = [
    {
      label: "Agency Dashboard",
      href: `/agency/${agencyId}`,
      group: "Navigation",
    },
    {
      label: "All Sub Accounts",
      href: `/agency/${agencyId}/all-subaccounts`,
      group: "Navigation",
    },
    {
      label: "Settings",
      href: `/agency/${agencyId}/settings`,
      group: "System",
    },
  ];

  // Sidebar DB routes (VERY IMPORTANT for your Prisma sidebarOptions)
  const sidebarRoutes = sidebarOptions.map((item) => ({
    label: item.name,
    href: item.link,
    group: "Sidebar",
  }));

  // Subaccount routes (from your Prisma SubAccount model)
  const subAccountRoutes = subAccounts.map((sub) => ({
    label: sub.name,
    href: `/subaccount/${sub.id}`,
    group: "Sub Accounts",
  }));

  const allRoutes = [
    ...coreRoutes,
    ...sidebarRoutes,
    ...subAccountRoutes,
  ];

  // Grouping for clean UI
  const groupedRoutes = allRoutes.reduce<Record<string, typeof allRoutes>>(
    (acc, route) => {
      if (!acc[route.group]) acc[route.group] = [];
      acc[route.group].push(route);
      return acc;
    },
    {}
  );

  return (
    <>
      {/* 🔍 SEARCH TRIGGER (Clean design — no scissors icon issue) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-[320px] h-10 px-4 rounded-xl border border-border/40 bg-muted/30 hover:bg-muted/50 transition-all text-left"
      >
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Search anything (pages, subaccounts, navigation)...
        </span>
        <Badge
          variant="secondary"
          className="ml-auto text-[10px] font-mono"
        >
          <CommandIcon className="w-3 h-3 mr-1" />K
        </Badge>
      </button>

      {/* 🔥 GLOBAL COMMAND PALETTE */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search across the entire Aexon dashboard..." />

        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {Object.entries(groupedRoutes).map(([group, routes]) => (
            <CommandGroup key={group} heading={group}>
              {routes.map((route) => (
                <CommandItem
                  key={route.href}
                  value={route.label}
                  onSelect={() => {
                    setOpen(false);
                    router.push(route.href);
                  }}
                  className="cursor-pointer"
                >
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  {route.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default GlobalSearchCommand;