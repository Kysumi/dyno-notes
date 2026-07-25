import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { useTabs } from "@/components/tabs-provider.tsx";
import { cn } from "@/lib/utils.ts";

export function TabsStrip() {
  const { tabs, activeTabId, tabInfo, openNewTab, closeTab, setActiveTab } =
    useTabs();

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 pt-1.5 [-webkit-app-region:drag]">
      {tabs.map((tab) => {
        const info = tabInfo[tab.id];
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="button"
            tabIndex={0}
            aria-label={`Tab: ${info?.title ?? "New Tab"}`}
            aria-current={active ? "true" : undefined}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActiveTab(tab.id);
              }
            }}
            className={cn(
              "group flex h-8 max-w-48 min-w-24 shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-xs [-webkit-app-region:no-drag]",
              active
                ? "border-border bg-background font-medium"
                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
          >
            {info && info.status !== "saved" ? (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-primary"
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate">
              {info?.title ?? "New Tab"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-4 shrink-0 rounded-sm p-0 text-muted-foreground opacity-0 hover:bg-transparent hover:text-foreground focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
              aria-label="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 [-webkit-app-region:no-drag]"
        aria-label="New tab"
        onClick={() => openNewTab()}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
