import easJson from "../eas.json";

const { build } = easJson;

describe("eas.json", () => {
  describe("the store build profile", () => {
    it("should read the EAS production environment, so an iOS store build gets its variables the way the APK does", () => {
      expect(build.production.environment).toBe("production");
    });

    it("should keep the production update channel", () => {
      expect(build.production.channel).toBe("production");
    });

    it("should stay a store distribution, so it sets no internal distribution", () => {
      expect("distribution" in build.production).toBe(false);
    });
  });

  it("should still build the sideloadable APK from the same production environment", () => {
    expect(build["production-apk"]).toMatchObject({
      extends: "production",
      distribution: "internal",
      environment: "production",
      android: { buildType: "apk" },
    });
  });

  it("should build the development profile as an iOS Simulator app, which needs no Apple account", () => {
    expect(build.development.ios.simulator).toBe(true);
  });

  // A submit profile would hold the App Store Connect app id, which is an account id, and the repository is
  // public. Remove this once the id can come from somewhere other than a committed file.
  it("should not set up store submission, which stays a manual step", () => {
    expect("submit" in easJson).toBe(false);
  });
});
