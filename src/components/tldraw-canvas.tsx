import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTLStore, getSnapshot, loadSnapshot, Tldraw } from "tldraw";
import "tldraw/tldraw.css";

import { useEditorRuntime } from "@/components/notes-provider.tsx";
import { Button } from "@/components/ui/button.tsx";

const SERIALIZATION_ERROR =
  "The whiteboard could not be saved. Try editing it again.";

export default function TldrawCanvas({
  source,
  updateSource,
}: {
  source: string | null;
  updateSource(source: string): void;
}) {
  const { registerBeforeSave, reportError } = useEditorRuntime();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const loadFailed = useRef(false);
  const [store] = useState(() => {
    const newStore = createTLStore();
    try {
      if (source?.trim()) loadSnapshot(newStore, JSON.parse(source));
    } catch {
      loadFailed.current = true;
    }
    return newStore;
  });
  const pending = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loadFailed.current) {
      reportError("This whiteboard's saved drawing could not be loaded.");
    }
  }, [reportError]);

  const commit = useCallback(() => {
    if (!pending.current) return true;
    if (saveTimeout.current !== null) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    try {
      updateSource(JSON.stringify(getSnapshot(store)));
      pending.current = false;
      return true;
    } catch {
      reportError(SERIALIZATION_ERROR);
      return false;
    }
  }, [reportError, store, updateSource]);

  useEffect(() => {
    const unlisten = store.listen(() => {
      pending.current = true;
      if (saveTimeout.current !== null) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => void commit(), 500);
    });
    return () => {
      unlisten();
      commit();
    };
  }, [commit, store]);

  useEffect(
    () =>
      registerBeforeSave(() => {
        if (!commit()) throw new Error(SERIALIZATION_ERROR);
      }),
    [commit, registerBeforeSave],
  );

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const CustomSharePanel = useCallback(
    () => (
      <div className="pointer-events-auto mr-2 flex items-center">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setIsFullscreen((current) => !current)}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    ),
    [isFullscreen],
  );

  return (
    <div
      contentEditable={false}
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "relative z-0 my-4 h-[600px] w-full overflow-hidden rounded-lg border"
      }
    >
      <Tldraw store={store} components={{ SharePanel: CustomSharePanel }} />
    </div>
  );
}
