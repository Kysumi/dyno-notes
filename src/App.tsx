import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header.tsx";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { HelpPage } from "@/components/help-page.tsx";
import { WorkspaceProvider } from "@/components/notes-provider.tsx";
import { Onboarding } from "@/components/onboarding.tsx";
import { SettingsPage } from "@/components/settings-page.tsx";
import { TabsProvider, useTabs } from "@/components/tabs-provider.tsx";
import { TabsView } from "@/components/tabs-view.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import {
  type AppearanceSettings,
  applyAppearanceSettings,
  saveAppearanceSettings,
} from "@/lib/appearance.ts";
import type { AppConfigInfo } from "@/lib/contracts.ts";
import { desktop } from "@/lib/desktop.ts";

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
  const { flushAll } = useTabs();

  const openAppPage = async (nextPath: string) => {
    if (!(await flushAll())) return false;
    history.pushState({ dynoPage: true }, "", nextPath);
    onPathChange(nextPath);
    return true;
  };

  return (
    <>
      {/* Tabs must stay mounted behind Settings/Help so switching pages never
          drops a tab's draft, navigation history, or TipTap instance. */}
      <div
        className={
          path === "/"
            ? "grid h-screen grid-rows-[auto_minmax(0,1fr)] grid-cols-1 overflow-hidden bg-background text-foreground md:grid-cols-[14rem_minmax(0,1fr)]"
            : "hidden"
        }
      >
        <AppHeader
          onOpenHelp={() => openAppPage(HELP_PATH)}
          onOpenSettings={() => openAppPage(SETTINGS_PATH)}
        />
        <AppSidebar
          onOpenHelp={() => void openAppPage(HELP_PATH)}
          onOpenSettings={() => void openAppPage(SETTINGS_PATH)}
        />
        <TabsView />
      </div>
      {path === HELP_PATH ? <HelpPage onClose={onClosePage} /> : null}
      {path === SETTINGS_PATH ? (
        <SettingsPage
          appearance={appearance}
          onClose={onClosePage}
          onSave={onSaveAppearance}
        />
      ) : null}
    </>
  );
}

function App({ initialAppearance }: { initialAppearance: AppearanceSettings }) {
  const [path, setPath] = useState(location.pathname);
  const [appearance, setAppearance] = useState(initialAppearance);
  const [appConfig, setAppConfig] = useState<AppConfigInfo | undefined>();

  useEffect(() => {
    let cancelled = false;
    void desktop.appConfigGet().then((config) => {
      if (!cancelled) setAppConfig(config);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!appConfig) return null;

  if (!appConfig.notesPath) {
    return (
      <>
        <Onboarding
          initialAppearance={appearance}
          suggestedPath={appConfig.suggestedPath}
          onSaveAppearance={saveAppearance}
          onComplete={(notesPath) =>
            setAppConfig((current) => ({ ...current!, notesPath }))
          }
        />
        <Toaster theme={appearance.scheme} position="bottom-right" />
      </>
    );
  }

  return (
    <>
      <TooltipProvider>
        <WorkspaceProvider>
          <TabsProvider>
            <AppContent
              appearance={appearance}
              path={path}
              onClosePage={closeAppPage}
              onPathChange={setPath}
              onSaveAppearance={saveAppearance}
            />
          </TabsProvider>
        </WorkspaceProvider>
      </TooltipProvider>
      <Toaster theme={appearance.scheme} position="bottom-right" />
    </>
  );
}

export default App;
