export interface NetworkSwEntry {
  mac: string;
  online: boolean;
  firmware: string;
  formattedVersion: string;
  deviceModel: string;
  beaconModel: string | null;
  releaseName: string | null;
  customerId: string;
}

export type SwSelection =
  | { type: 'cell'; releaseName: string; beaconModel: string }
  | { type: 'release'; releaseName: string }
  | { type: 'model'; beaconModel: string };
