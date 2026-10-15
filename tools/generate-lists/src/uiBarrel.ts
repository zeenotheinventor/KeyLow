const notInBarrelMarker = "// @not-in-barrel";

/**
 * A kit folder opts out of the barrel by starting its `index.ts` with the marker, as PressableSurface
 * does because only other kit components use it.
 */
export function isInternalToKit(folderIndexSource: string): boolean {
  return folderIndexSource.startsWith(notInBarrelMarker);
}

/** The text of `components/ui/index.ts`: one `export *` line per kit folder, sorted by name. */
export function buildUiBarrel(folderNames: readonly string[]): string {
  const exportLines = [...folderNames].sort().map((name) => `export * from "./${name}";`);
  return [
    "// Generated from the folders in this directory by tools/generate-lists. Do not edit, and it is not committed.",
    ...exportLines,
    "",
  ].join("\n");
}
