import type { McpAccessPoint } from "@/web/lib/mcpNetwork";
import { bandsSourceNote } from "@/web/lib/radioBands";

/** An AP's bands; when they come from its model (AP offline), says so underneath. */
export function BandsValue({ ap }: { ap: Pick<McpAccessPoint, "bands" | "model" | "online" | "bandsSource"> }) {
  const note = bandsSourceNote(ap);
  if (!ap.bands.length) return <>—</>;
  return (
    <span className="inline-flex flex-col items-end">
      <span>{ap.bands.join(" · ")}</span>
      {note && <span className="text-[11px] text-neutral-500">{note}</span>}
    </span>
  );
}
