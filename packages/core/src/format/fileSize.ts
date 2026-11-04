const BYTES_PER_KILOBYTE = 1_000;
const BYTES_PER_MEGABYTE = 1_000_000;
const BYTES_PER_TENTH_OF_A_MEGABYTE = 100_000;

/**
 * A file's size as the Android Files app shows it, in decimal units (a megabyte is 1,000,000 bytes). Under a
 * megabyte it is whole kilobytes, and never less than "1 KB". From a megabyte it is megabytes to one decimal.
 * Both cut the figure down and never round it up, so "999 KB" does not become "1000 KB" at 999,999 bytes.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_MEGABYTE) {
    return `${Math.max(1, Math.floor(bytes / BYTES_PER_KILOBYTE))} KB`;
  }
  const tenthsOfAMegabyte = Math.floor(bytes / BYTES_PER_TENTH_OF_A_MEGABYTE);
  return `${(tenthsOfAMegabyte / 10).toFixed(1)} MB`;
}
