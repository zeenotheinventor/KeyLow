import { readdirSync } from "node:fs";
import { join } from "node:path";

import { ignoredDirectories, isGuardedPath, scannedRoots } from "./pathPolicy";

/** Every source file under apps and packages, as paths relative to the root. */
export function collectSourceFiles(root: string): string[] {
  const files: string[] = [];

  const walk = (relativeDirectory: string): void => {
    for (const entry of readdirSync(join(root, relativeDirectory), { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          walk(relativePath);
        }
      } else if (isGuardedPath(relativePath)) {
        files.push(relativePath);
      }
    }
  };

  for (const scannedRoot of scannedRoots) {
    walk(scannedRoot);
  }

  return files;
}
