// A malformed escape throws, and the name as given is the best there is to show.
function decodeOrKeep(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * The folder's name as a person knows it, from the name the Android picker hands back. That name is the last
 * part of a storage access tree address, so a folder called Download on the phone's own storage arrives as
 * `primary%3ADownload`, and a folder inside another as `primary%3ADocuments%2FBackups`. The storage volume and
 * the parents are dropped, which leaves "Download" and "Backups". The root of a volume has no folder name, so
 * it is empty, and a plain name such as "Downloads" is unchanged.
 */
export function displayFolderName(pickerName: string): string {
  const decoded = decodeOrKeep(pickerName);
  const afterVolume = decoded.slice(decoded.lastIndexOf(":") + 1);
  return (
    afterVolume
      .split("/")
      .filter((part) => part !== "")
      .at(-1) ?? ""
  );
}
