import { captureMessage } from "@sentry/react-native";

import { reportOtherDevicesNotSignedOut } from "../../lib/sentry/reportOtherDevicesNotSignedOut";

describe("reportOtherDevicesNotSignedOut", () => {
  beforeEach(() => {
    jest.mocked(captureMessage).mockClear();
  });

  it("should report a fixed message and nothing else", () => {
    reportOtherDevicesNotSignedOut();

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      "Password saved but the other devices were not signed out",
      {
        level: "warning",
        fingerprint: ["Password saved but the other devices were not signed out"],
      },
    );
  });
});
