import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { PageViewDefinition } from "@/components/notes-provider.tsx";
import type { NoteId } from "@/lib/contracts.ts";
import type { SaveStatus } from "@/lib/save-coordinator.ts";

export interface TabNavigationInfo {
  title: string;
  status: SaveStatus;
  noteId: NoteId | null;
  activePageView: PageViewDefinition | null;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  openNote(id: NoteId, blockId?: string): Promise<boolean>;
  openPageView(id: string): Promise<boolean>;
  openJournal(date: string): Promise<boolean>;
  createPage(title: string): Promise<boolean>;
  saveNow(): Promise<boolean>;
}

export interface NewTabTarget {
  noteId?: NoteId;
  pageViewId?: string;
}

interface Tab {
  id: string;
  initialNoteId?: NoteId;
  initialPageViewId?: string;
}

interface TabsContextValue {
  tabs: Tab[];
  activeTabId: string;
  tabInfo: Record<string, TabNavigationInfo>;
  openNewTab(target?: NewTabTarget): void;
  closeTab(id: string): void;
  setActiveTab(id: string): void;
  publishTabInfo(id: string, info: TabNavigationInfo): void;
  removeTabInfo(id: string): void;
  flushAll(): Promise<boolean>;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const DEFAULT_TAB_INFO: TabNavigationInfo = {
  title: "New Tab",
  status: "saved",
  noteId: null,
  activePageView: null,
  canGoBack: false,
  canGoForward: false,
  goBack: () => Promise.resolve(false),
  goForward: () => Promise.resolve(false),
  openNote: () => Promise.resolve(false),
  openPageView: () => Promise.resolve(false),
  openJournal: () => Promise.resolve(false),
  createPage: () => Promise.resolve(false),
  saveNow: () => Promise.resolve(true),
};

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: crypto.randomUUID() }]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [tabInfo, setTabInfo] = useState<Record<string, TabNavigationInfo>>({});
  const tabInfoRef = useRef(tabInfo);
  tabInfoRef.current = tabInfo;

  const openNewTab = useCallback((target?: NewTabTarget) => {
    const id = crypto.randomUUID();
    setTabs((current) => [
      ...current,
      {
        id,
        initialNoteId: target?.noteId,
        initialPageViewId: target?.pageViewId,
      },
    ]);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((current) => {
      if (current.length === 1) return current;
      const index = current.findIndex((tab) => tab.id === id);
      if (index === -1) return current;
      const next = current.filter((tab) => tab.id !== id);
      setActiveTabId((activeId) =>
        activeId === id ? next[Math.min(index, next.length - 1)].id : activeId,
      );
      return next;
    });
  }, []);

  const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

  const publishTabInfo = useCallback((id: string, info: TabNavigationInfo) => {
    setTabInfo((current) =>
      current[id] === info ? current : { ...current, [id]: info },
    );
  }, []);

  const removeTabInfo = useCallback((id: string) => {
    setTabInfo((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const flushAll = useCallback(async () => {
    const results = await Promise.all(
      Object.values(tabInfoRef.current).map((info) => info.saveNow()),
    );
    return results.every(Boolean);
  }, []);

  useEffect(() => {
    globalThis.__dynoFlush = flushAll;
    return () => {
      delete globalThis.__dynoFlush;
    };
  }, [flushAll]);

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs,
      activeTabId,
      tabInfo,
      openNewTab,
      closeTab,
      setActiveTab,
      publishTabInfo,
      removeTabInfo,
      flushAll,
    }),
    [
      tabs,
      activeTabId,
      tabInfo,
      openNewTab,
      closeTab,
      setActiveTab,
      publishTabInfo,
      removeTabInfo,
      flushAll,
    ],
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error("useTabs must be used inside TabsProvider.");
  return context;
}

export function useActiveTabNavigation(): TabNavigationInfo {
  const { tabInfo, activeTabId } = useTabs();
  return tabInfo[activeTabId] ?? DEFAULT_TAB_INFO;
}
