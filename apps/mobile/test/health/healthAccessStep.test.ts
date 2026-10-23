import { healthAccessStep } from "../../components/HealthAccessScreen";

import type { HealthAccessInputs, HealthAccessStep } from "../../components/HealthAccessScreen";

// The folder's index also exports the screen, which reads the theme's stored preference.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const noBody = { bodyFat: false, leanMass: false };
const bodyFatOnly = { bodyFat: true, leanMass: false };
const leanMassOnly = { bodyFat: false, leanMass: true };
const bothBody = { bodyFat: true, leanMass: true };

// A fresh open of an available device with no permission: the explain state.
const fresh: HealthAccessInputs = {
  availability: "available",
  hasPermission: false,
  permissionAnswer: null,
  bodyCompositionAccess: noBody,
  mode: "first",
  hasAskedBodyComposition: false,
  isImporting: false,
  importStatus: null,
};

// Weight is held and the add-later flow is open, with nothing asked yet.
const adding: HealthAccessInputs = {
  ...fresh,
  hasPermission: true,
  mode: "add-body-composition",
};

type Row = readonly [string, Partial<HealthAccessInputs>, HealthAccessStep];

const firstTimeRows: readonly Row[] = [
  ["Health Connect needs installing", { availability: "needs-install" }, "install"],
  ["available, permission not held, nothing asked yet", {}, "explain"],
  ["permission is already held and nothing is running", { hasPermission: true }, "explain"],
  [
    "permission is not held and an import is running (the runner's, without access)",
    { hasPermission: false, isImporting: true },
    "explain",
  ],
  ["the weight request is answered denied", { permissionAnswer: "denied" }, "denied"],
  [
    "the weight request is answered denied whatever body types are allowed",
    { permissionAnswer: "denied", bodyCompositionAccess: bothBody },
    "denied",
  ],
  [
    "the weight request is answered granted and an import runs",
    { permissionAnswer: "granted", isImporting: true, bodyCompositionAccess: bothBody },
    "connecting",
  ],
  [
    "the weight request is answered granted and the import has not marked itself running yet",
    { permissionAnswer: "granted" },
    "connecting",
  ],
  [
    "permission is already held on open and an import is running",
    { hasPermission: true, isImporting: true },
    "connecting",
  ],
  [
    "the import resolves imported with both body types allowed",
    { permissionAnswer: "granted", importStatus: "imported", bodyCompositionAccess: bothBody },
    "connected",
  ],
  [
    "the import resolves nothing-new with both body types allowed",
    { permissionAnswer: "granted", importStatus: "nothing-new", bodyCompositionAccess: bothBody },
    "connected",
  ],
  [
    "the import resolves imported with no body type allowed",
    { permissionAnswer: "granted", importStatus: "imported", bodyCompositionAccess: noBody },
    "connected-partial",
  ],
  [
    "the import resolves imported with body fat alone allowed",
    { permissionAnswer: "granted", importStatus: "imported", bodyCompositionAccess: bodyFatOnly },
    "connected-partial",
  ],
  [
    "the import resolves nothing-new with lean mass alone allowed",
    {
      permissionAnswer: "granted",
      importStatus: "nothing-new",
      bodyCompositionAccess: leanMassOnly,
    },
    "connected-partial",
  ],
  [
    "the import resolves no-permission",
    { permissionAnswer: "granted", importStatus: "no-permission" },
    "denied",
  ],
  [
    "the import resolves no-permission whatever body types are allowed",
    { permissionAnswer: "granted", importStatus: "no-permission", bodyCompositionAccess: bothBody },
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

const addLaterRows: readonly Row[] = [
  ["weight is held and nothing is asked", {}, "explain-body-composition"],
  [
    "weight is held and an import is running before anything is asked",
    { isImporting: true },
    "explain-body-composition",
  ],
  [
    "the body request is answered with neither type granted",
    { hasAskedBodyComposition: true },
    "denied-body-composition",
  ],
  [
    "the body request is answered with body fat alone granted",
    { hasAskedBodyComposition: true, bodyCompositionAccess: bodyFatOnly },
    "connecting",
  ],
  [
    "the body request is answered with lean mass alone granted",
    { hasAskedBodyComposition: true, bodyCompositionAccess: leanMassOnly },
    "connecting",
  ],
  [
    "the body request is answered with both types granted",
    { hasAskedBodyComposition: true, bodyCompositionAccess: bothBody },
    "connecting",
  ],
  [
    "the import resolves imported with both types granted",
    { hasAskedBodyComposition: true, bodyCompositionAccess: bothBody, importStatus: "imported" },
    "connected",
  ],
  [
    "the import resolves nothing-new with one type granted",
    {
      hasAskedBodyComposition: true,
      bodyCompositionAccess: leanMassOnly,
      importStatus: "nothing-new",
    },
    "connected-partial",
  ],
  [
    "the import resolves no-permission, whatever the body result says",
    {
      hasAskedBodyComposition: true,
      bodyCompositionAccess: bothBody,
      importStatus: "no-permission",
    },
    "denied",
  ],
  [
    "the import resolves failed",
    { hasAskedBodyComposition: true, bodyCompositionAccess: bothBody, importStatus: "failed" },
    "import-error",
  ],
  ["Health Connect needs installing", { availability: "needs-install" }, "install"],
];

describe("healthAccessStep", () => {
  describe("the first-time flow", () => {
    it.each(firstTimeRows)("should choose the right state when %s", (_what, change, expected) => {
      expect(healthAccessStep({ ...fresh, ...change })).toBe(expected);
    });
  });

  describe("the add-later flow", () => {
    it.each(addLaterRows)("should choose the right state when %s", (_what, change, expected) => {
      expect(healthAccessStep({ ...adding, ...change })).toBe(expected);
    });

    it("should run the first-time flow when weight permission is not held", () => {
      expect(healthAccessStep({ ...adding, hasPermission: false })).toBe("explain");
    });

    it("should run the first-time flow, down to denied, when weight is not held and was refused", () => {
      expect(
        healthAccessStep({
          ...adding,
          hasPermission: false,
          permissionAnswer: "denied",
          bodyCompositionAccess: bothBody,
        }),
      ).toBe("denied");
    });
  });

  it.each([
    ["none", noBody],
    ["body fat only", bodyFatOnly],
    ["lean mass only", leanMassOnly],
    ["both", bothBody],
  ] as const)(
    "should end connected only when both body types are allowed (%s)",
    (_name, access) => {
      const expected = access.bodyFat && access.leanMass ? "connected" : "connected-partial";
      const inputs = { ...fresh, permissionAnswer: "granted", importStatus: "imported" } as const;

      expect(healthAccessStep({ ...inputs, bodyCompositionAccess: access })).toBe(expected);
      expect(
        healthAccessStep({
          ...inputs,
          hasPermission: true,
          mode: "add-body-composition",
          hasAskedBodyComposition: true,
          bodyCompositionAccess: access,
        }),
      ).toBe(expected);
    },
  );

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
