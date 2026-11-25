import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportOtherDevicesNotSignedOut } from "@/lib/auth/reportOtherDevicesNotSignedOut";

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureMessage }));

describe("reportOtherDevicesNotSignedOut", () => {
  beforeEach(() => {
    captureMessage.mockReset();
  });

  it("should send a fixed message and no data", () => {
    reportOtherDevicesNotSignedOut();

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      "A saved password did not sign out the other devices",
      { level: "warning" },
    );
  });
});
