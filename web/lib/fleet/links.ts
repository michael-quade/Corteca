/** Where a Fleet Metrics row leads: the Corteca console for a device, the MCP visualizer for a network. */

const CONSOLE_BASE = process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

export function normaliseMac(mac: string): string {
  return mac.toUpperCase().replace(/:/g, "-");
}

export function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${normaliseMac(mac)}`;
}

/** The MCP visualizer opened on a home network (root MAC). */
export function visualizerUrl(networkId: string): string {
  return `/mcp-network-visualizer?network=${encodeURIComponent(normaliseMac(networkId))}`;
}
