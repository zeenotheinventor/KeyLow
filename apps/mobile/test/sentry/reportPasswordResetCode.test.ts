import { captureMessage } from "@sentry/react-native";

import { reportPasswordResetCode } from "../../lib/sentry/reportPasswordResetCode";

describe("reportPasswordResetCode", () => {
  beforeEach(() => {
    jest.mocked(captureMessage).mockClear();
  });

  it("should report a fixed message with the code as the only tag and nothing else", () => {
    reportPasswordResetCode("unexpected_failure");

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      "Password reset request answered with an unexpected code",
      {
        level: "warning",
        fingerprint: ["Password reset request answered with an unexpected code"],
        tags: { code: "unexpected_failure" },
      },
    );
  });
});
