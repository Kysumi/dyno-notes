import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Tldraw, createTLStore, loadSnapshot, getSnapshot } from "tldraw";
import { useEffect, useState, useRef, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

export function TldrawNodeView({ node, updateAttributes }: NodeViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [store] = useState(() => {
    const newStore = createTLStore();
    try {
      if (node.attrs.source) {
        const snapshot = JSON.parse(node.attrs.source);
        loadSnapshot(newStore, snapshot);
      }
    } catch (err) {
      console.error("Failed to load tldraw snapshot", err);
    }
    return newStore;
  });

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unlisten = store.listen(() => {
      if (saveTimeout.current !== null) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(() => {
        try {
          const snapshot = getSnapshot(store);
          updateAttributes({
            source: JSON.stringify(snapshot),
          });
        } catch (err) {
          console.error("Failed to serialize tldraw snapshot", err);
        }
      }, 500);
    });
    return () => {
      unlisten();
      if (saveTimeout.current !== null) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [store, updateAttributes]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const CustomSharePanel = useCallback(
    () => (
      <div className="flex items-center pointer-events-auto mr-2">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    ),
    [isFullscreen],
  );

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className={
          isFullscreen
            ? "fixed inset-0 z-50 bg-white"
            : "relative z-0 my-4 h-[600px] w-full overflow-hidden rounded-lg border"
        }
      >
        <Tldraw store={store} components={{ SharePanel: CustomSharePanel }} />
      </div>
    </NodeViewWrapper>
  );
}
