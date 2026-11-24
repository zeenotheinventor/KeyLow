const { sourceSkips } = jest.requireActual<{ sourceSkips: string[] }>("../fingerprint.config");

describe("fingerprint.config.js", () => {
  it("should skip the EAS project metadata, which is plain configuration", () => {
    expect(sourceSkips).toContain("ExpoConfigEASProject");
  });

  it("should skip version and build number changes, so a bump alone does not make an update incompatible with an installed build", () => {
    expect(sourceSkips).toContain("ExpoConfigVersions");
  });

  it("should keep the library default skip, because sourceSkips replaces the default", () => {
    expect(sourceSkips).toContain("PackageJsonAndroidAndIosScriptsIfNotContainRun");
  });

  it("should not skip the whole Expo config, so plugins and identifiers still count", () => {
    expect(sourceSkips).not.toContain("ExpoConfigAll");
  });
});
