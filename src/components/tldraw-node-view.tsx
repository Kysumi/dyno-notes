import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { lazy, Suspense, useCallback } from "react";

const TldrawCanvas = lazy(() => import("@/components/tldraw-canvas.tsx"));

export function TldrawNodeView({ node, updateAttributes }: NodeViewProps) {
  const updateSource = useCallback(
    (source: string) => updateAttributes({ source }),
    [updateAttributes],
  );

  return (
    <NodeViewWrapper>
      <Suspense
        fallback={
          <div
            contentEditable={false}
            className="my-4 grid h-[600px] w-full place-items-center rounded-lg border bg-muted/20 text-sm text-muted-foreground"
          >
            Loading whiteboard…
          </div>
        }
      >
        <TldrawCanvas
          source={node.attrs.source as string | null}
          updateSource={updateSource}
        />
      </Suspense>
    </NodeViewWrapper>
  );
}
