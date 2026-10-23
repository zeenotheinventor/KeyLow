import { healthAccessStep } from "../../components/HealthAccessScreen";

import type { HealthAccessInputs, HealthAccessStep } from "../../components/HealthAccessScreen";

// The folder's index also exports the screen, which reads the theme's stored preference.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// A fresh open of an available device with no permission: the explain state.
const fresh: HealthAccessInputs = {
  availability: "available",
  hasPermission: false,
  permissionAnswer: null,
  isImporting: false,
  importStatus: null,
};

const rows: readonly (readonly [string, Partial<HealthAccessInputs>, HealthAccessStep])[] = [
  ["Health Connect needs installing", { availability: "needs-install" }, "install"],
  ["available, permission not held, nothing asked yet", {}, "explain"],
  ["permission is already held and nothing is running", { hasPermission: true }, "explain"],
  [
    "permission is not held and an import is running (the runner's, without access)",
    { hasPermission: false, isImporting: true },
    "explain",
  ],
  ["the permission request is answered denied", { permissionAnswer: "denied" }, "denied"],
  [
    "the permission request is answered granted and an import runs",
    { permissionAnswer: "granted", isImporting: true },
    "connecting",
  ],
  [
    "the permission request is answered granted and the import has not marked itself running yet",
    { permissionAnswer: "granted" },
    "connecting",
  ],
  [
    "permission is already held on open and an import is running",
    { hasPermission: true, isImporting: true },
    "connecting",
  ],
  [
    "the import resolves imported",
    { permissionAnswer: "granted", importStatus: "imported" },
    "connected",
  ],
  [
    "the import resolves nothing-new",
    { permissionAnswer: "granted", importStatus: "nothing-new" },
    "connected",
  ],
  [
    "the import resolves no-permission",
    { permissionAnswer: "granted", importStatus: "no-permission" },
    "denied",
  ],
  [
    "the import resolves failed",
    { permissionAnswer: "granted", importStatus: "failed" },
    "import-error",
  ],
  [
    "the import resolves unavailable",
    { permissionAnswer: "granted", importStatus: "unavailable" },
    "import-error",
  ],
];

describe("healthAccessStep", () => {
  it.each(rows)("should choose the right state when %s", (_what, change, expected) => {
    expect(healthAccessStep({ ...fresh, ...change })).toBe(expected);
  });

  it("should show the import's result over a running import, as a retry's old result is cleared first", () => {
    expect(
      healthAccessStep({
        ...fresh,
        hasPermission: true,
        isImporting: true,
        importStatus: "failed",
      }),
    ).toBe("import-error");
  });
});
