import {
  Command,
  Menu,
  MoreHorizontal,
  PanelRight,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

type IconButtonProps = {
  label: string;
  children: ReactNode;
};

function IconButton({ label, children }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className="[-webkit-app-region:no-drag]"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppHeader() {
  return (
    <header className="col-span-full grid grid-cols-[1fr_auto] items-center gap-4 border-b bg-stone-50/95 px-3 [-webkit-app-region:drag] sm:grid-cols-[1fr_minmax(16rem,34rem)_1fr]">
      <div className="flex items-center gap-2">
        <IconButton label="Toggle sidebar">
          <Menu />
        </IconButton>
        <span className="grid size-7 place-items-center rounded-lg bg-emerald-900 font-serif text-base font-bold text-stone-50">
          D
        </span>
        <span className="hidden font-semibold tracking-tight sm:inline">
          Dyno Notes
        </span>
      </div>

      <label className="relative hidden items-center sm:flex">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input
          aria-label="Search notes"
          placeholder="Search notes or run a command…"
          className="h-8 bg-white/70 pr-16 pl-9 text-xs shadow-xs [-webkit-app-region:no-drag]"
        />
        <Badge
          variant="outline"
          className="pointer-events-none absolute right-2 gap-1 bg-stone-50 px-1.5 font-mono text-[10px] text-muted-foreground"
        >
          <Command className="size-2.5" /> K
        </Badge>
      </label>

      <div className="flex items-center justify-end gap-1">
        <IconButton label="Open page context">
          <PanelRight />
        </IconButton>
        <IconButton label="More options">
          <MoreHorizontal />
        </IconButton>
      </div>
    </header>
  );
}
