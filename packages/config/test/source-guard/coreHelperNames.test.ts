import { describe, expect, it } from "vitest";

import { exportedFunctionNames } from "./coreHelperNames";

describe("exportedFunctionNames", () => {
  it("should read the functions a barrel exports by name, not constants or types", () => {
    const source =
      'export { describeEnergy, NOT_GIVEN } from "./nutrition";\nexport type { Row } from "./x";';

    expect(exportedFunctionNames(source, () => "")).toEqual(["describeEnergy"]);
  });

  it("should follow an export star into the module and read its lower-case exports", () => {
    const modules: Record<string, string> = {
      "./nutrition": [
        "export const NOT_GIVEN = 'n/a';",
        "export function describeEnergy() { return ''; }",
        "export const describeBasis = () => '';",
        "const privateHelper = () => '';",
        "export type Basis = 'a';",
      ].join("\n"),
    };

    expect(
      exportedFunctionNames(
        'export * from "./nutrition";',
        (specifier) => modules[specifier] ?? "",
      ),
    ).toEqual(["describeEnergy", "describeBasis"]);
  });
});
