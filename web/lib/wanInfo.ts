// The gateway's Internet (WAN) connection, from its TR-181 data model:
// the IP interface that carries the INTERNET service, followed down its
// LowerLayers chain (Ethernet.Link → VLAN / PPP → Ethernet.Interface) to the
// physical WAN port. Client + server safe.

export interface WanPort {
  /** "eth3" */
  name: string;
  status: string;
  maxMbps: number | null;
  currentMbps: number | null;
  duplex: string;
  mac: string;
}

export interface WanInfo {
  /** IP interface name, e.g. "1_TR069_INTERNET_OTHER_R_VID_0" */
  interfaceName: string;
  /** IP interface Status ("Up") */
  status: string;
  /** X_ALU-COM_ConnectionStatus ("Connected"), when the gateway reports it */
  connection: string | null;
  connectionType: string | null;
  services: string[];
  /** "DHCP", "Static", "PPPoE" */
  addressing: string | null;
  ipv4: string | null;
  ipv6: string[];
  lanIpv4: string | null;
  gateway: string | null;
  dns: string[];
  uptimeSec: number | null;
  bytesDown: number | null;
  bytesUp: number | null;
  /** What the chain ends in: "Ethernet", "Fiber", "DSL", "Cellular", … */
  medium: string | null;
  vlanId: number | null;
  port: WanPort | null;
}

/** USP GET paths parseWan() needs. */
export const WAN_PATHS = [
  "Device.IP.Interface.",
  "Device.Ethernet.Interface.",
  "Device.Ethernet.Link.",
  "Device.Ethernet.VLANTermination.",
  "Device.PPP.Interface.",
  "Device.DHCPv4.Client.",
  "Device.DNS.Client.Server.",
];

type Flat = Record<string, string>;

/** Instance paths under `prefix` ("Device.IP.Interface.2") → their params. */
function instances(flat: Flat, prefix: string): Map<string, Flat> {
  const out = new Map<string, Flat>();
  for (const [k, v] of Object.entries(flat)) {
    if (!k.startsWith(prefix)) continue;
    const m = k.slice(prefix.length).match(/^(\d+)\.(.+)$/);
    if (!m) continue;
    const path = `${prefix}${m[1]}`;
    out.set(path, { ...(out.get(path) ?? {}), [m[2]]: v });
  }
  return out;
}

const clean = (p: string) => p.trim().replace(/\.$/, "");
const num = (v: string | undefined) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** The LowerLayers chain below `path` (first lower layer each step). */
function chain(flat: Flat, path: string): string[] {
  const out: string[] = [];
  let cur = path;
  for (let i = 0; i < 8; i++) {
    const lower = flat[`${cur}.LowerLayers`];
    const next = lower ? clean(lower.split(",")[0]) : "";
    if (!next || out.includes(next)) break;
    out.push(next);
    cur = next;
  }
  return out;
}

const MEDIUM: [RegExp, string][] = [
  [/^Device\.Ethernet\.Interface\./, "Ethernet"],
  [/^Device\.Optical\./, "Fiber"],
  [/^Device\.DSL\./, "DSL"],
  [/^Device\.Cellular\./, "Cellular"],
  [/^Device\.WiFi\./, "WiFi"],
  [/^Device\.MoCA\./, "MoCA"],
];

function addresses(p: Flat, family: "IPv4Address" | "IPv6Address"): { ip: string; type?: string }[] {
  const rows = new Map<string, Flat>();
  for (const [k, v] of Object.entries(p)) {
    const m = k.match(new RegExp(`^${family}\\.(\\d+)\\.(.+)$`));
    if (m) rows.set(m[1], { ...(rows.get(m[1]) ?? {}), [m[2]]: v });
  }
  return [...rows.values()]
    .filter((r) => r.IPAddress && r.Enable !== "false" && (r.Status ?? "Enabled") === "Enabled")
    .map((r) => ({ ip: r.IPAddress.replace(/\/\d+$/, ""), type: r.AddressingType }));
}

export function parseWan(flat: Flat): WanInfo | null {
  const ifaces = [...instances(flat, "Device.IP.Interface.")].filter(([, p]) => p.Loopback !== "true");
  const isLan = (path: string, p: Flat) => /^lan$/i.test(p.Name ?? "") || chain(flat, path).some((l) => l.startsWith("Device.Bridging."));
  const services = (p: Flat) => (p["X_ALU-COM_ServiceList"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const wanCandidates = ifaces.filter(([path, p]) => !isLan(path, p));
  const wan =
    wanCandidates.find(([, p]) => services(p).includes("INTERNET") && p.Status === "Up") ??
    wanCandidates.find(([, p]) => services(p).includes("INTERNET")) ??
    wanCandidates.find(([, p]) => p.Status === "Up" && addresses(p, "IPv4Address").length) ??
    wanCandidates[0];
  if (!wan) return null;
  const [wanPath, p] = wan;

  const lower = chain(flat, wanPath);
  const end = lower.at(-1) ?? "";
  const portPath = lower.find((l) => /^Device\.Ethernet\.Interface\.\d+$/.test(l))
    ?? [...instances(flat, "Device.Ethernet.Interface.")].find(([, e]) => e.Upstream === "true")?.[0];
  const eth = portPath ? instances(flat, "Device.Ethernet.Interface.").get(portPath) : undefined;
  const vlanPath = lower.find((l) => l.startsWith("Device.Ethernet.VLANTermination."));
  const viaPpp = lower.some((l) => l.startsWith("Device.PPP.Interface."));

  const v4 = addresses(p, "IPv4Address");
  const dhcp = [...instances(flat, "Device.DHCPv4.Client.")].map(([, c]) => c).find((c) => clean(c.Interface ?? "") === wanPath);
  const dns = [...instances(flat, "Device.DNS.Client.Server.")].map(([, s]) => s)
    .filter((s) => s.DNSServer && s.Status !== "Disabled" && (!s.Interface || clean(s.Interface) === wanPath))
    .map((s) => s.DNSServer);
  const lan = ifaces.find(([path, q]) => isLan(path, q));
  const rate = (v: string | undefined) => { const n = num(v); return n != null && n > 0 ? n : null; };

  return {
    interfaceName: p.Name ?? wanPath,
    status: p.Status ?? "Unknown",
    connection: p["X_ALU-COM_ConnectionStatus"] || null,
    connectionType: p["X_ALU-COM_ConnectionType"] || null,
    services: services(p),
    addressing: viaPpp ? "PPPoE" : v4[0]?.type || (dhcp ? "DHCP" : null),
    ipv4: v4[0]?.ip ?? (dhcp?.IPAddress || null),
    ipv6: addresses(p, "IPv6Address").map((a) => a.ip).filter((ip) => !/^fe80:/i.test(ip)),
    lanIpv4: lan ? addresses(lan[1], "IPv4Address")[0]?.ip ?? null : null,
    gateway: dhcp?.IPRouters?.split(",")[0]?.trim() || null,
    dns: [...new Set(dns)],
    uptimeSec: num(p["X_ALU-COM_Uptime"]) ?? num(p.LastChange),
    bytesDown: num(p["Stats.BytesReceived"]),
    bytesUp: num(p["Stats.BytesSent"]),
    medium: MEDIUM.find(([re]) => re.test(end))?.[1] ?? (eth ? "Ethernet" : null),
    vlanId: vlanPath ? num(flat[`${vlanPath}.VLANID`]) : null,
    port: eth ? {
      name: eth.Name ?? portPath!.split(".").pop()!,
      status: eth.Status ?? "Unknown",
      maxMbps: rate(eth.MaxBitRate),
      currentMbps: rate(eth.CurrentBitRate),
      duplex: eth.DuplexMode ?? "",
      mac: eth.MACAddress ?? "",
    } : null,
  };
}

/** Is the WAN up and connected (null when the gateway doesn't say)? */
export function wanConnected(wan: WanInfo): boolean | null {
  if (wan.connection) return /^connected$/i.test(wan.connection);
  return wan.status ? wan.status === "Up" : null;
}

/** Negotiated speed of the WAN port while it is up — the "WAN · 5 Gbps" pill. */
export function wanLinkSpeedMbps(wan: WanInfo | null | undefined): number | null {
  return wan && typeof wan === "object" && wan.port?.status === "Up" ? wan.port.currentMbps : null;
}

/** Note for a private WAN address: the gateway sits behind another router or carrier NAT. */
export function wanNatNote(ip: string | null): string | null {
  if (!ip) return null;
  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return "The WAN address is private: the gateway is behind another router (double NAT).";
  }
  if (a === 100 && b >= 64 && b <= 127) return "The WAN address is in the carrier-grade NAT range: the ISP shares a public address.";
  return null;
}
