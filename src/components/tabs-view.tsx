import { JournalRibbon } from "@/components/journal-ribbon.tsx";
import { NoteEditor } from "@/components/note-editor.tsx";
import { TabProvider, useNavigation } from "@/components/notes-provider.tsx";
import { PageContext } from "@/components/page-context.tsx";
import { PageView } from "@/components/page-view.tsx";
import { useTabs } from "@/components/tabs-provider.tsx";
import { journalDateFromId } from "@/lib/dates.ts";
import { useEffect, useState } from "react";

function TabContent({ findRequest }: { findRequest: number }) {
  const { activePageView, noteId } = useNavigation();
  const journalDate = journalDateFromId(noteId ?? "");
  return activePageView ? (
    <PageView key={activePageView.id} view={activePageView} />
  ) : (
    <>
      <div className="flex min-h-0 min-w-0 flex-col">
        {journalDate ? <JournalRibbon date={journalDate} /> : null}
        <NoteEditor findRequest={findRequest} />
      </div>
      <PageContext />
    </>
  );
}

export function TabsView() {
  const { tabs, activeTabId, tabInfo } = useTabs();
  const [findRequests, setFindRequests] = useState<Record<string, number>>({});

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = /Mac|iPhone|iPad/.test(navigator.platform)
        ? event.metaKey
        : event.ctrlKey;
      const active = tabInfo[activeTabId];
      if (
        !modifier ||
        event.key.toLowerCase() !== "f" ||
        !active?.noteId ||
        active.activePageView
      ) {
        return;
      }
      event.preventDefault();
      setFindRequests((requests) => ({
        ...requests,
        [activeTabId]: (requests[activeTabId] ?? 0) + 1,
      }));
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, tabInfo]);

  return (
    <div className="relative min-h-0 min-w-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={
            tab.id === activeTabId
              ? "absolute inset-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem]"
              : "hidden"
          }
        >
          <TabProvider
            tabId={tab.id}
            initialNoteId={tab.initialNoteId}
            initialPageViewId={tab.initialPageViewId}
          >
            <TabContent findRequest={findRequests[tab.id] ?? 0} />
          </TabProvider>
        </div>
      ))}
    </div>
  );
}
