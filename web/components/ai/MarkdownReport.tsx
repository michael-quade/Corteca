"use client";

import { useState } from "react";
import { cn } from "@/web/lib/utils";

// Minimal renderer for the analyze-network report: "## " sections (collapsible),
// "### " subheadings, "- " bullets (nested by indent), **bold**, plain lines.

interface Section { title: string; lines: string[] }

function sections(markdown: string): Section[] {
  const out: Section[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) out.push({ title: h[1].trim(), lines: [] });
    else if (out.length) out[out.length - 1].lines.push(line);
    else if (line.trim()) out.push({ title: "", lines: [line] });
  }
  return out;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p))}</>;
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-1 text-[13px] leading-relaxed text-neutral-700">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        const sub = line.match(/^###\s+(.+)$/);
        if (sub) return <p key={i} className="pt-2 text-xs font-semibold text-neutral-900">{sub[1]}</p>;
        const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
        if (bullet) {
          const depth = Math.min(3, Math.floor(bullet[1].length / 2));
          return (
            <p key={i} className="relative pl-4" style={{ marginLeft: depth * 16 }}>
              <span className="absolute left-0 top-[0.55em] h-1 w-1 rounded-full bg-neutral-400" />
              <Inline text={bullet[2]} />
            </p>
          );
        }
        return <p key={i}><Inline text={line.trim()} /></p>;
      })}
    </div>
  );
}

/** The report's sections; the first two start open (overall state, current findings). */
export function MarkdownReport({ markdown }: { markdown: string }) {
  const list = sections(markdown);
  const [open, setOpen] = useState<Set<number>>(() => new Set([0, 1]));
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="divide-y divide-neutral-100">
      {list.map((s, i) => (
        <div key={i} className="py-2">
          {s.title && (
            <button type="button" onClick={() => toggle(i)} aria-expanded={open.has(i)} className="flex w-full items-center justify-between py-1 text-left">
              <span className="text-sm font-semibold text-neutral-900">{s.title}</span>
              <span className={cn("text-xs text-neutral-400 transition-transform", open.has(i) && "rotate-180")}>▾</span>
            </button>
          )}
          {(open.has(i) || !s.title) && <div className="pt-1"><Lines lines={s.lines} /></div>}
        </div>
      ))}
    </div>
  );
}
