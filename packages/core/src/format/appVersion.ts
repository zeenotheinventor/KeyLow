import { formatDateTime } from "../dates";

/**
 * The product version both About screens show. A bump is this one line, and it ships with the next web deploy
 * and the next update to the phone. It is not `app.json` `version`, which belongs to the installed binary and
 * changes the native fingerprint when edited. It stays below 1.0.0 until version 1 is out: a minor bump when a
 * milestone closes, a patch bump with each production APK build, and 1.0.0 at the M7 exit gate (the "Version line"
 * section of `docs/runbooks/local-dev.md`).
 */
export const APP_VERSION = "0.5.0";

const shortCommitLength = 7;
const commitPattern = /^[0-9a-f]{7,40}$/;

type AppVersionInput = {
  version: string;
  /** The commit the running code was built from. Anything that is not 7 to 40 hex characters counts as missing. */
  commit: string | undefined;
};

/** `Version 0.5.0 (a1b2c3d)`, or `Version 0.5.0` when there is no usable commit. */
export function formatAppVersion({ version, commit }: AppVersionInput): string {
  const normalisedCommit = commit?.trim().toLowerCase() ?? "";

  if (!commitPattern.test(normalisedCommit)) {
    return `Version ${version}`;
  }

  return `Version ${version} (${normalisedCommit.slice(0, shortCommitLength)})`;
}

type BuildLineInput = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  timeZone: string;
};

const embeddedBundleWithoutDate = "Shipped with this build";

/**
 * `Built 23 Oct 2026, 22:53` for the bundle inside the app, `Updated 15 Oct 2026, 10:00` for a downloaded update
 * (both in the device zone), `Shipped with this build` for the bundle inside the app when it has no date, and nothing
 * when updates are off or a downloaded update has no date.
 */
export function formatBuildLine({
  isEnabled,
  isEmbeddedLaunch,
  createdAt,
  timeZone,
}: BuildLineInput): string | null {
  if (!isEnabled) {
    return null;
  }

  if (createdAt === null) {
    return isEmbeddedLaunch ? embeddedBundleWithoutDate : null;
  }

  const label = isEmbeddedLaunch ? "Built" : "Updated";

  return `${label} ${formatDateTime(createdAt, timeZone)}`;
}
