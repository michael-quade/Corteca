export interface RenameDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "Beacon" or "client" */
  kind: string;
  /** What the device is without a nickname: model / detected name, plus MAC. */
  description: string;
  currentAlias: string;
  /** Saves on the gateway; rejects with a user-readable message. */
  onSave: (alias: string) => Promise<void>;
}
