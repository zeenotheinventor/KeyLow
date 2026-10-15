export type SearchLauncherProps = {
  /** What the bar says and its accessible name, such as "Search for a food". */
  label: string;
  /** The barcode control's accessible name, such as "Scan barcode". */
  scanLabel: string;
  /** Opens the search sheet. */
  onPress: () => void;
  /** Opens the scanner. */
  onScanPress: () => void;
  /** Dims the bar to half and stops both controls responding, such as while offline. Defaults to false. */
  disabled?: boolean | undefined;
};
