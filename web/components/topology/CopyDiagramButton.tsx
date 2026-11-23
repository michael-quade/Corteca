"use client";

import { useEffect, useRef, useState } from "react";
import { getNodesBounds, useReactFlow, useStoreApi, type Node } from "@xyflow/react";
import { toBlob } from "html-to-image";
import { cn } from "@/web/lib/utils";
import { Hint } from "@/web/components/ui/Hint";

/** Margin around the diagram in the picture (CSS px, before the pixel ratio). */
const PAD = 40;
/** Longest side of the picture in device pixels; browsers refuse much larger canvases. */
const MAX_SIDE = 8000;

type State = "idle" | "working" | "copied" | "downloaded" | "failed";

const LABEL: Record<State, string> = {
  idle: "Copy diagram",
  working: "Copying…",
  copied: "Copied",
  downloaded: "Saved as PNG",
  failed: "Couldn't copy",
};

/**
 * The whole diagram (every node, not just the part on screen) as a PNG at zoom 1 on white,
 * as it looks now — dimming from a selection or filter included. Only the viewport layer is
 * drawn, so the legend, minimap, events drawers and detail panel stay out; so do the moving rate dots.
 */
async function renderDiagram(domNode: HTMLElement, nodes: Node[]): Promise<Blob> {
  const viewport = domNode.querySelector<HTMLElement>(".react-flow__viewport");
  const shown = nodes.filter((n) => !n.hidden);
  if (!viewport || !shown.length) throw new Error("No diagram to copy");
  const b = getNodesBounds(shown);
  const width = Math.ceil(b.width + PAD * 2);
  const height = Math.ceil(b.height + PAD * 2);
  const blob = await toBlob(viewport, {
    backgroundColor: "#ffffff",
    // The moving rate dots would freeze into stray circles along the lines.
    filter: (el) => !(el instanceof Element && el.hasAttribute("data-flow-dots")),
    width,
    height,
    pixelRatio: Math.min(2, MAX_SIDE / Math.max(width, height)),
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${PAD - b.x}px, ${PAD - b.y}px) scale(1)` },
  });
  if (!blob) throw new Error("Rendering failed");
  return blob;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Toolbar button: puts a picture of the network diagram on the clipboard, ready to paste into
 * an email, chat, ticket or slide. Where the browser won't write images to the clipboard
 * (no ClipboardItem, or permission refused) the PNG is downloaded instead.
 */
export function CopyDiagramButton({ fileName }: { fileName: string }) {
  const { getNodes } = useReactFlow();
  const store = useStoreApi();
  const [state, setState] = useState<State>("idle");
  const reset = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(reset.current), []);

  const finish = (s: State) => {
    setState(s);
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setState("idle"), 2500);
  };

  async function copy() {
    const domNode = store.getState().domNode;
    if (!domNode || state === "working") return;
    setState("working");
    // Started before the clipboard call and handed over as a promise, so the click still
    // counts as the user's gesture when the picture is ready (Safari and Chrome need that).
    const picture = renderDiagram(domNode, getNodes());
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("No image clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": picture })]);
      finish("copied");
    } catch {
      try {
        download(await picture, fileName);
        finish("downloaded");
      } catch {
        finish("failed");
      }
    }
  }

  return (
    <Hint text="Copy a picture of the whole diagram, as it looks now, to paste into another window (Ctrl+V). Browsers that can't copy images save a PNG instead.">
      {(id) => (
        <button
          type="button"
          aria-describedby={id}
          onClick={copy}
          disabled={state === "working"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium",
            state === "copied" || state === "downloaded" ? "border-blue-600 text-blue-700"
              : state === "failed" ? "border-red-300 text-red-700" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
          )}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {state === "copied" || state === "downloaded"
              ? <path d="m5 12 5 5L20 7" />
              : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>}
          </svg>
          <span aria-live="polite">{LABEL[state]}</span>
        </button>
      )}
    </Hint>
  );
}
