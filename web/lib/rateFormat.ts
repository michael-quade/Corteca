// One format for every link speed / data rate: "100 Mbps", "1 Gbps", "2.5 Gbps".
// Gbps keeps up to `decimals` digits without trailing zeros (1 Gbps, not 1.0 Gbps).

export function formatRate(mbps: number, decimals = 1): string {
  return mbps >= 1000 ? `${+(mbps / 1000).toFixed(decimals)} Gbps` : `${Math.round(mbps)} Mbps`;
}
