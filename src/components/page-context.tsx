import { ChevronRight, FileText, Link, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";

function ContextSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        <span>{title}</span>
        {count === undefined
          ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${title} options`}
            >
              <MoreHorizontal />
            </Button>
          )
          : (
            <Badge variant="secondary" className="px-1.5 text-[10px]">
              {count}
            </Badge>
          )}
      </div>
      {children}
    </section>
  );
}

function BacklinkCard({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  children: string;
}) {
  return (
    <Card className="gap-0 py-0 shadow-none transition-colors hover:border-emerald-800/40">
      <Button
        asChild
        variant="ghost"
        className="h-auto w-full justify-start whitespace-normal p-0 text-left"
      >
        <a href={href}>
          <CardContent className="w-full space-y-1.5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Icon className="size-3.5 text-emerald-800" /> {title}
            </div>
            <p className="font-serif text-xs leading-5 text-muted-foreground">
              {children}
            </p>
          </CardContent>
        </a>
      </Button>
    </Card>
  );
}

export function PageContext() {
  return (
    <aside className="hidden min-h-0 border-l bg-stone-100/60 xl:block">
      <ScrollArea className="h-full">
        <div className="space-y-7 p-4">
          <ContextSection title="Outline">
            <nav className="grid" aria-label="Page outline">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
              >
                <a href="#focus">
                  <ChevronRight />Focus<Badge
                    variant="ghost"
                    className="ml-auto"
                  >
                    3
                  </Badge>
                </a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
              >
                <a href="#thoughts">
                  <ChevronRight />Morning thoughts<Badge
                    variant="ghost"
                    className="ml-auto"
                  >
                    3
                  </Badge>
                </a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
              >
                <a href="#desk">
                  <ChevronRight />On the desk<Badge
                    variant="ghost"
                    className="ml-auto"
                  >
                    1
                  </Badge>
                </a>
              </Button>
            </nav>
          </ContextSection>

          <Separator />

          <ContextSection title="Linked references" count={2}>
            <BacklinkCard href="#weekly" icon={FileText} title="Weekly review">
              “…return to today’s journal and choose the one thing that
              matters.”
            </BacklinkCard>
            <BacklinkCard
              href="#project-orbit"
              icon={Link}
              title="Project Orbit"
            >
              “Daily notes are where rough project ideas begin.”
            </BacklinkCard>
          </ContextSection>

          <Separator />

          <ContextSection title="Page">
            <dl className="grid gap-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>Today</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Words</dt>
                <dd>86</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Links</dt>
                <dd>3</dd>
              </div>
            </dl>
          </ContextSection>
        </div>
      </ScrollArea>
    </aside>
  );
}
