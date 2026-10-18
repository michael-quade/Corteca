// Radio channel / width / airtime from the gateway's EasyMesh Data Elements
// (Device.WiFi.DataElements.Network.Device.{i}.Radio.{j}). Client + server safe.

export interface ApRadio {
  /** "2.4 GHz" | "5 GHz" | "5 GHz low" | "5 GHz high" | "6 GHz" */
  band: string;
  /** Primary 20 MHz channel. */
  channel: number | null;
  widthMhz: number | null;
  /** Nominal transmit power (EIRP), dBm. */
  txPowerDbm: number | null;
  /** Share of airtime, 0–100: busy in total, and its parts. */
  utilization: number | null;
  /** Smoothed (EWMA) total utilization, 0–100. */
  utilizationAvg: number | null;
  transmit: number | null;
  receiveSelf: number | null;
  /** Airtime taken by other networks / non-WiFi energy heard on the channel. */
  receiveOther: number | null;
  noiseDbm: number | null;
}

// Global operating classes (IEEE 802.11 Annex E): band and channel width.
function opClassInfo(cls: number): { band: string; width: number } | null {
  if (cls >= 81 && cls <= 84) return { band: "2.4 GHz", width: cls <= 82 ? 20 : 40 };
  const five: Record<number, number> = { 115: 20, 116: 40, 117: 40, 118: 20, 119: 40, 120: 40, 121: 20, 122: 40, 123: 40, 124: 20, 125: 20, 126: 40, 127: 40, 128: 80, 129: 160, 130: 80 };
  if (five[cls]) return { band: "5 GHz", width: five[cls] };
  const six: Record<number, number> = { 131: 20, 132: 40, 133: 80, 134: 160, 135: 80, 136: 20, 137: 320 };
  if (six[cls]) return { band: "6 GHz", width: six[cls] };
  return null;
}

/** EasyMesh airtime values are 0–255 linear. */
const pct = (v: string | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 255 ? Math.round((n / 255) * 100) : null;
};
/** Noise is an ANPI value (0–220): dBm = value / 2 − 110. */
const anpiDbm = (v: string | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 220 ? Math.round(n / 2 - 110) : null;
};

/** One radio from its flat parameters (keys relative to "…Radio.{j}."), or null if it has no operating class. */
export function parseRadio(p: Record<string, string>): ApRadio | null {
  const profiles: { cls: number; channel: number; tx: number }[] = [];
  for (let i = 1; p[`CurrentOperatingClassProfile.${i}.Class`] != null; i++) {
    profiles.push({
      cls: Number(p[`CurrentOperatingClassProfile.${i}.Class`]),
      channel: Number(p[`CurrentOperatingClassProfile.${i}.Channel`]),
      tx: Number(p[`CurrentOperatingClassProfile.${i}.TxPower`]),
    });
  }
  const known = profiles.map((x) => ({ ...x, info: opClassInfo(x.cls) })).filter((x) => x.info);
  if (!known.length) return null;
  // The radio lists one profile per width it covers; the widest is the operating width
  // and the 20 MHz one names the primary channel.
  const widest = known.reduce((a, b) => (b.info!.width > a.info!.width ? b : a));
  const primary = known.find((x) => x.info!.width === 20) ?? widest;
  return {
    band: widest.info!.band,
    channel: Number.isFinite(primary.channel) ? primary.channel : null,
    widthMhz: widest.info!.width,
    txPowerDbm: Number.isFinite(widest.tx) ? widest.tx : null,
    utilization: pct(p.Utilization),
    utilizationAvg: pct(p["X_ALU-COM_EWMA_Utilization"]),
    transmit: pct(p.Transmit),
    receiveSelf: pct(p.ReceiveSelf),
    receiveOther: pct(p.ReceiveOther),
    noiseDbm: anpiDbm(p.Noise),
  };
}

const BAND_ORDER = ["2.4 GHz", "5 GHz", "5 GHz low", "5 GHz high", "6 GHz"];

/** Tri-band WiFi 6 Beacons have two 5 GHz radios: name them low/high by channel; sort by band. */
export function labelRadios(radios: ApRadio[]): ApRadio[] {
  const fives = radios.filter((r) => r.band === "5 GHz");
  const out = fives.length === 2
    ? radios.map((r) => (r.band === "5 GHz" ? { ...r, band: (r.channel ?? 0) < 100 ? "5 GHz low" : "5 GHz high" } : r))
    : radios;
  return [...out].sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band));
}
