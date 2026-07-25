import { ChevronLeft, ChevronRight } from "lucide-react";

import { useNavigation } from "@/components/notes-provider.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { dateValue, journalTitle, shiftDate, weekDates } from "@/lib/dates.ts";

const weekdayFormat = new Intl.DateTimeFormat("en-NZ", { weekday: "short" });
const compactDateFormat = new Intl.DateTimeFormat("en-NZ", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function displayDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function focusEditor(): void {
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        '[aria-label="Note body"], [aria-label="Markdown source"]',
      )
      ?.focus(),
  );
}

export function JournalRibbon({ date }: { date: string }) {
  const { notes, openJournal } = useNavigation();
  const today = dateValue();

  const open = async (value: string) => {
    if (!(await openJournal(value))) return;
    focusEditor();
  };

  return (
    <div className="shrink-0 border-b bg-muted/20 px-6 py-2 sm:px-10">
      <nav
        aria-label="Journal dates"
        className="mx-auto flex w-full max-w-3xl min-w-0 items-center justify-center gap-1"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous week"
              onClick={() => void open(shiftDate(date, -7))}
            >
              <ChevronLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous week</TooltipContent>
        </Tooltip>

        <span className="min-w-24 text-center text-xs font-medium md:hidden">
          {compactDateFormat.format(displayDate(date))}
        </span>
        <div className="hidden min-w-0 flex-1 grid-cols-7 gap-1 md:grid">
          {weekDates(date).map((value) => {
            const selected = value === date;
            const isToday = value === today;
            const hasEntry = notes.some(
              (note) => note.id === `journals/${value}.md`,
            );
            return (
              <Button
                key={value}
                type="button"
                variant="ghost"
                className={
                  selected
                    ? "h-11 min-w-0 flex-col gap-0 rounded-md bg-primary px-1 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    : isToday
                      ? "h-11 min-w-0 flex-col gap-0 rounded-md px-1 text-primary"
                      : "h-11 min-w-0 flex-col gap-0 rounded-md px-1 text-muted-foreground"
                }
                aria-label={`${journalTitle(value)}${isToday ? ", today" : ""}${
                  hasEntry ? ", has journal entry" : ""
                }`}
                aria-current={selected ? "date" : undefined}
                onClick={() => void open(value)}
              >
                <span className="text-[11px] leading-none font-semibold tracking-wider uppercase">
                  {isToday ? "Today" : weekdayFormat.format(displayDate(value))}
                </span>
                <span className="font-serif text-base leading-5">
                  {Number(value.slice(-2))}
                </span>
                <span
                  aria-hidden="true"
                  className={
                    hasEntry
                      ? selected
                        ? "size-1.5 rounded-full bg-primary-foreground/75"
                        : "size-1.5 rounded-full bg-primary"
                      : "size-1.5"
                  }
                />
              </Button>
            );
          })}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next week"
              onClick={() => void open(shiftDate(date, 7))}
            >
              <ChevronRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next week</TooltipContent>
        </Tooltip>
      </nav>
    </div>
  );
}
