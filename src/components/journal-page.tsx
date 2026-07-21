import { BookOpen, Calendar, ChevronRight, Circle, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Separator } from "@/components/ui/separator.tsx";

const today = new Intl.DateTimeFormat("en-NZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

type JournalSectionProps = {
  id: string;
  status: string;
  title: string;
  children: ReactNode;
};

function JournalSection({ id, status, title, children }: JournalSectionProps) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="flex items-center gap-2 font-mono text-base font-semibold">
        <span className="text-amber-700">*</span>
        <Badge
          variant="outline"
          className="border-emerald-800/20 bg-emerald-50 text-[10px] text-emerald-900"
        >
          {status}
        </Badge>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OutlineBlock({
  children,
  nested = false,
}: {
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <div
      className={nested ? "ml-7 flex gap-3 leading-6" : "flex gap-3 leading-6"}
    >
      <Circle className="mt-2 size-2 shrink-0 fill-stone-800" />
      <div>{children}</div>
    </div>
  );
}

type TaskProps = {
  id: string;
  children: string;
  checked?: boolean;
  tag?: string;
};

function Task({ id, children, checked = false, tag }: TaskProps) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <Checkbox id={id} defaultChecked={checked} />
      <label htmlFor={id}>{children}</label>
      {tag
        ? (
          <Badge
            variant="secondary"
            className="ml-auto text-[10px] text-emerald-900"
          >
            {tag}
          </Badge>
        )
        : null}
    </div>
  );
}

export function JournalPage() {
  return (
    <main id="journal" className="min-w-0 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-24 sm:px-10 sm:pt-16">
        <header className="space-y-3">
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-800/20 bg-emerald-50 text-emerald-900 uppercase"
          >
            <Calendar className="size-3" /> Journal
          </Badge>
          <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            {today}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            A quiet place to think, link, and get things done.
          </p>
        </header>

        <Separator className="my-7" />

        <article className="space-y-9 text-sm">
          <JournalSection id="focus" status="TODO" title="Focus">
            <OutlineBlock>
              Draft the opening note for{" "}
              <Button
                asChild
                variant="link"
                className="h-auto p-0 text-emerald-800"
              >
                <a href="#project-orbit">[[Project Orbit]]</a>
              </Button>
              <p className="font-mono text-[11px] text-amber-700">
                SCHEDULED: &lt;today 09:30&gt;
              </p>
            </OutlineBlock>
            <Task id="review-task" tag="#daily">
              Review yesterday’s loose ends
            </Task>
            <Task id="inbox-task" checked>Clear the capture inbox</Task>
          </JournalSection>

          <JournalSection id="thoughts" status="NOTE" title="Morning thoughts">
            <OutlineBlock>
              Good tools should feel like a workbench: everything close at hand,
              nothing asking for attention until it is needed.
            </OutlineBlock>
            <OutlineBlock nested>
              Keep capture friction low; structure can emerge through links.
            </OutlineBlock>
            <OutlineBlock nested>
              Prefer plain text concepts: headings, tasks, tags, and references.
            </OutlineBlock>
          </JournalSection>

          <JournalSection id="desk" status="NEXT" title="On the desk">
            <Card className="gap-0 bg-stone-50 py-0 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <BookOpen className="size-5 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif font-semibold">
                    Designing Data-Intensive Applications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resume chapter 10 · 42% complete
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </JournalSection>

          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs text-muted-foreground"
          >
            <Plus /> Type “/” for commands
          </Button>
        </article>
      </div>
    </main>
  );
}
