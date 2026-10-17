// Decodes the (Re)Association Request a station sent, as kept by the gateway's
// EasyMesh controller in Device.WiFi.DataElements…STA.{i}.ClientCapabilities.
// A station only includes a generation's capabilities element when the AP offers
// that generation, so the highest element present is the standard the link uses.
// Client + server safe.

export interface AssociationStandard {
  /** "WiFi 7" */
  generation: string;
  /** "802.11be" */
  ieee: string;
  /** Multi-Link element present (WiFi 7 MLO). */
  mlo: boolean;
}

type Ie = { id: number; ext?: number };

/** Walks an element list; null unless it consumes the buffer exactly and starts with SSID. */
function walkIes(buf: Uint8Array, start: number): Ie[] | null {
  if (buf[start] !== 0) return null;
  const out: Ie[] = [];
  let i = start;
  while (i < buf.length) {
    if (i + 2 > buf.length) return null;
    const id = buf[i], len = buf[i + 1];
    if (i + 2 + len > buf.length) return null;
    out.push(id === 255 && len > 0 ? { id, ext: buf[i + 2] } : { id });
    i += 2 + len;
  }
  return out;
}

// Where the element list can start: Assoc Request body (capability + listen
// interval), Reassoc Request body (+ current AP), each with or without the
// 24-byte MAC header. Some gateways store the header, some don't.
const OFFSETS = [4, 10, 28, 34];

function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.trim());
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Highest WiFi standard in an association request, or null if it can't be read. */
export function associationStandard(clientCapabilitiesB64: string): AssociationStandard | null {
  const buf = decodeBase64(clientCapabilitiesB64);
  if (!buf || buf.length < 6) return null;
  let ies: Ie[] | null = null;
  for (const off of OFFSETS) {
    ies = walkIes(buf, off);
    if (ies) break;
  }
  if (!ies) return null;
  const has = (id: number, ext?: number) => ies!.some((e) => e.id === id && e.ext === ext);
  const mlo = has(255, 107);
  if (has(255, 108)) return { generation: "WiFi 7", ieee: "802.11be", mlo };
  if (has(255, 35)) return { generation: "WiFi 6", ieee: "802.11ax", mlo };
  if (has(191)) return { generation: "WiFi 5", ieee: "802.11ac", mlo };
  if (has(45)) return { generation: "WiFi 4", ieee: "802.11n", mlo };
  return null;
}
