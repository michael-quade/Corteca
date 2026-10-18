"use client";

import type { AiNotes } from "@/web/lib/aiAnalysis";
import { DetailSection } from "./DetailParts";

/** Lines the AI analysis report wrote about this device; issue lines first, marked amber. */
export function AiNotesSection({ notes }: { notes: AiNotes | undefined }) {
  if (!notes) return null;
  return (
    <DetailSection title="AI analysis">
      <ul className="space-y-1.5 py-1 text-xs leading-relaxed">
        {notes.issues.map((l, i) => (
          <li key={`i${i}`} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">{l}</li>
        ))}
        {notes.other.map((l, i) => (
          <li key={`o${i}`} className="px-2 text-neutral-600">{l}</li>
        ))}
      </ul>
    </DetailSection>
  );
}
