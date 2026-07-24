import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header.tsx";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { HelpPage } from "@/components/help-page.tsx";
import { NoteEditor } from "@/components/note-editor.tsx";
import { NotesProvider, useNavigation } from "@/components/notes-provider.tsx";
import { PageContext } from "@/components/page-context.tsx";
import { PageView } from "@/components/page-view.tsx";
import { SettingsPage } from "@/components/settings-page.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import {
  type AppearanceSettings,
  applyAppearanceSettings,
  saveAppearanceSettings,
} from "@/lib/appearance.ts";

const SETTINGS_PATH = "/settings";
const HELP_PATH = "/help";

function AppContent({
  appearance,
  path,
  onClosePage,
  onPathChange,
  onSaveAppearance,
}: {
  appearance: AppearanceSettings;
  path: string;
  onClosePage(): void;
  onPathChange(path: string): void;
  onSaveAppearance(settings: AppearanceSettings): boolean;
}) {
  const { activePageView, saveNow } = useNavigation();

  const openAppPage = async (nextPath: string) => {
    if (!(await saveNow())) return false;
    history.pushState({ dynoPage: true }, "", nextPath);
    onPathChange(nextPath);
    return true;
  };

  if (path === HELP_PATH) return <HelpPage onClose={onClosePage} />;
  if (path === SETTINGS_PATH) {
    return (
      <SettingsPage
        appearance={appearance}
        onClose={onClosePage}
        onSave={onSaveAppearance}
      />
    );
  }

  return (
    <div className="grid h-screen grid-cols-1 grid-rows-[3.25rem_minmax(0,1fr)] overflow-hidden bg-background text-foreground md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_16rem]">
      <AppHeader
        onOpenHelp={() => openAppPage(HELP_PATH)}
        onOpenSettings={() => openAppPage(SETTINGS_PATH)}
      />
      <AppSidebar
        onOpenHelp={() => void openAppPage(HELP_PATH)}
        onOpenSettings={() => void openAppPage(SETTINGS_PATH)}
      />
      {activePageView ? (
        <PageView key={activePageView.id} view={activePageView} />
      ) : (
        <>
          <NoteEditor />
          <PageContext />
        </>
      )}
    </div>
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

  const closeAppPage = () => {
    if (history.state?.dynoPage) {
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
    <>
      <TooltipProvider>
        <NotesProvider>
          <AppContent
            appearance={appearance}
            path={path}
            onClosePage={closeAppPage}
            onPathChange={setPath}
            onSaveAppearance={saveAppearance}
          />
        </NotesProvider>
      </TooltipProvider>
      <Toaster theme={appearance.scheme} position="bottom-right" />
    </>
  );
}

export default App;
