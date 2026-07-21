import {
  Calendar,
  CheckSquare,
  FileText,
  Hash,
  Inbox,
  Network,
  Plus,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";

type SidebarLinkProps = {
  href: string;
  icon: LucideIcon;
  children: string;
  count?: number;
  active?: boolean;
};

function SidebarLink({
  href,
  icon: Icon,
  children,
  count,
  active = false,
}: SidebarLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={active
        ? "w-full justify-start bg-stone-200 text-emerald-950 hover:bg-stone-200"
        : "w-full justify-start text-stone-700"}
    >
      <a href={href}>
        <Icon />
        <span>{children}</span>
        {count === undefined
          ? null
          : (
            <Badge variant="secondary" className="ml-auto px-1.5 text-[10px]">
              {count}
            </Badge>
          )}
      </a>
    </Button>
  );
}

function SidebarHeading({ children }: { children: string }) {
  return (
    <div className="px-2 pt-5 pb-1 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden min-h-0 border-r bg-stone-100/80 md:flex md:flex-col">
      <div className="p-3">
        <Button
          size="sm"
          className="w-full justify-start bg-emerald-900 shadow-none hover:bg-emerald-800"
        >
          <Plus /> New page
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2">
        <nav className="grid gap-0.5" aria-label="Main navigation">
          <SidebarLink href="#journal" icon={Calendar} active>
            Journal
          </SidebarLink>
          <SidebarLink href="#pages" icon={FileText}>All pages</SidebarLink>
          <SidebarLink href="#tasks" icon={CheckSquare} count={3}>
            Tasks
          </SidebarLink>
          <SidebarLink href="#inbox" icon={Inbox} count={5}>Inbox</SidebarLink>
          <SidebarLink href="#graph" icon={Network}>Graph</SidebarLink>
        </nav>

        <SidebarHeading>Favorites</SidebarHeading>
        <nav className="grid gap-0.5" aria-label="Favorite pages">
          <SidebarLink href="#field-notes" icon={Hash}>Field notes</SidebarLink>
          <SidebarLink href="#reading" icon={Hash}>Reading list</SidebarLink>
        </nav>

        <SidebarHeading>Recent</SidebarHeading>
        <nav className="grid gap-0.5 pb-4" aria-label="Recent pages">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-between font-normal"
          >
            <a href="#project-orbit">
              <span>Project Orbit</span>
              <span className="text-[10px] text-muted-foreground">8m</span>
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-between font-normal"
          >
            <a href="#books">
              <span>Books to revisit</span>
              <span className="text-[10px] text-muted-foreground">1h</span>
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-between font-normal"
          >
            <a href="#weekly">
              <span>Weekly review</span>
              <span className="text-[10px] text-muted-foreground">Mon</span>
            </a>
          </Button>
        </nav>
      </ScrollArea>

      <div className="p-2">
        <Separator className="mb-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-stone-700"
        >
          <Settings /> Settings
        </Button>
      </div>
    </aside>
  );
}
