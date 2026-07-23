import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header.tsx";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { NoteEditor } from "@/components/note-editor.tsx";
import { NotesProvider, useNavigation } from "@/components/notes-provider.tsx";
import { PageContext } from "@/components/page-context.tsx";
import { SettingsPage } from "@/components/settings-page.tsx";
import { TaskView } from "@/components/task-view.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import {
  type AppearanceSettings,
  applyAppearanceSettings,
  saveAppearanceSettings,
} from "@/lib/appearance.ts";

const SETTINGS_PATH = "/settings";

function AppContent() {
  const { activeTaskView } = useNavigation();
  return activeTaskView
    ? <TaskView key={activeTaskView.id} view={activeTaskView} />
    : (
      <>
        <NoteEditor />
        <PageContext />
      </>
    );
}

function App({ initialAppearance }: { initialAppearance: AppearanceSettings }) {
  const [path, setPath] = useState(location.pathname);
  const [appearance, setAppearance] = useState(initialAppearance);

  useEffect(() => {
    const updatePath = () => setPath(location.pathname);
    addEventListener("popstate", updatePath);
    return () => removeEventListener("popstate", updatePath);
  }, []);

  useEffect(() => {
    const preferredScheme = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyAppearanceSettings(appearance);
    apply();
    if (appearance.scheme !== "system") return;
    preferredScheme.addEventListener("change", apply);
    return () => preferredScheme.removeEventListener("change", apply);
  }, [appearance]);

  const openSettings = () => {
    history.pushState({ dynoSettings: true }, "", SETTINGS_PATH);
    setPath(SETTINGS_PATH);
  };

  const closeSettings = () => {
    if (history.state?.dynoSettings) {
      history.back();
    } else {
      history.replaceState(null, "", "/");
      setPath("/");
    }
  };

  const saveAppearance = (settings: AppearanceSettings): boolean => {
    try {
      saveAppearanceSettings(settings);
      setAppearance(settings);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <TooltipProvider>
      <NotesProvider>
        {path === SETTINGS_PATH
          ? (
            <SettingsPage
              appearance={appearance}
              onClose={closeSettings}
              onSave={saveAppearance}
            />
          )
          : (
            <div className="grid h-screen grid-cols-1 grid-rows-[3.25rem_minmax(0,1fr)] overflow-hidden bg-background text-foreground md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_16rem]">
              <AppHeader />
              <AppSidebar onOpenSettings={openSettings} />
              <AppContent />
            </div>
          )}
      </NotesProvider>
    </TooltipProvider>
  );
}

export default App;
