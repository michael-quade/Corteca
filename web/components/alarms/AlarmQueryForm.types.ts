import type { Severity } from "./severity";

export interface AlarmQueryFormProps {
  dateStart: string;
  onDateStart: (v: string) => void;
  dateEnd: string;
  onDateEnd: (v: string) => void;
  severities: Set<Severity>;
  onToggleSeverity: (s: Severity) => void;
  deviceMac: string;
  onDeviceMac: (v: string) => void;
  customAlarms: boolean;
  onCustomAlarms: (v: boolean) => void;
  canFetch: boolean;
  loading: boolean;
  onFetch: () => void;
  /** Cross-reference with the latest reboot report. */
  hasResults: boolean;
  crossRefLoading: boolean;
  crossRefActive: boolean;
  onCrossRef: () => void;
  onClearCrossRef: () => void;
}
