import { NoteEditor } from "@/components/note-editor.tsx";
import { TabProvider, useNavigation } from "@/components/notes-provider.tsx";
import { PageContext } from "@/components/page-context.tsx";
import { PageView } from "@/components/page-view.tsx";
import { useTabs } from "@/components/tabs-provider.tsx";

function TabContent() {
  const { activePageView } = useNavigation();
  return activePageView ? (
    <PageView key={activePageView.id} view={activePageView} />
  ) : (
    <>
      <NoteEditor />
      <PageContext />
    </>
  );
}

export function TabsView() {
  const { tabs, activeTabId } = useTabs();

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
            <TabContent />
          </TabProvider>
        </div>
      ))}
    </div>
  );
}
