import { formatDateTime } from "../dates";

/**
 * The product version both About screens show. A bump is this one line, and it ships with the next web deploy
 * and the next update to the phone. It is not `app.json` `version`, which belongs to the installed binary and
 * changes the native fingerprint when edited.
 */
export const APP_VERSION = "1.0.0";

const shortCommitLength = 7;
const commitPattern = /^[0-9a-f]{7,40}$/;

type AppVersionInput = {
  version: string;
  /** The commit the running code was built from. Anything that is not 7 to 40 hex characters counts as missing. */
  commit: string | undefined;
};

/** `Version 1.0.0 (a1b2c3d)`, or `Version 1.0.0` when there is no usable commit. */
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

/** `Built in` for the bundle inside the app, `Updated 15 Oct 2026, 10:00` (device zone) for an update, nothing when neither is known. */
export function formatBuildLine({
  isEnabled,
  isEmbeddedLaunch,
  createdAt,
  timeZone,
}: BuildLineInput): string | null {
  if (!isEnabled) {
    return null;
  }

  if (isEmbeddedLaunch) {
    return "Built in";
  }

  return createdAt === null ? null : `Updated ${formatDateTime(createdAt, timeZone)}`;
}
