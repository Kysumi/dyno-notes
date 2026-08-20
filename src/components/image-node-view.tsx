import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";

export function ImageNodeView({ node }: NodeViewProps) {
  const imageAttributes = {
    src: String(node.attrs.src ?? ""),
    alt: String(node.attrs.alt ?? ""),
    title: node.attrs.title ? String(node.attrs.title) : undefined,
    width: node.attrs.width ? Number(node.attrs.width) : undefined,
    height: node.attrs.height ? Number(node.attrs.height) : undefined,
  };

  return (
    <NodeViewWrapper contentEditable={false}>
      <Dialog>
        <div className="relative mx-auto w-fit max-w-full">
          <img {...imageAttributes} className="!m-0" />
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="absolute top-2 right-2 shadow-sm"
              aria-label="Enter fullscreen"
              title="Enter fullscreen"
            >
              <Maximize2 />
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent
          showCloseButton={false}
          className="!inset-0 !block !h-svh !max-h-none !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0 !p-4 sm:!max-w-none"
        >
          <DialogTitle className="sr-only">
            {imageAttributes.alt || "Image preview"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fullscreen image preview.
          </DialogDescription>
          <img
            {...imageAttributes}
            className="!m-0 !h-full !max-h-full !w-full !rounded-none object-contain"
          />
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="absolute top-4 right-4 shadow-sm"
              aria-label="Exit fullscreen"
              title="Exit fullscreen (Esc)"
            >
              <Minimize2 />
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}
