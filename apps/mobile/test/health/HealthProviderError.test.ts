import { HealthProviderError } from "../../lib/health";

describe("HealthProviderError", () => {
  it("should carry the action and a fixed code", () => {
    const error = new HealthProviderError("readWeightSince", "permission");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HealthProviderError);
    expect(error.action).toBe("readWeightSince");
    expect(error.code).toBe("permission");
  });

  it("should word its message from the action and code only", () => {
    const error = new HealthProviderError("requestPermission", "failed");

    expect(error.message).toBe("requestPermission: failed");
  });
});
