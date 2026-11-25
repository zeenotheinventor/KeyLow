import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportPasswordResetCode } from "@/lib/auth/reportPasswordResetCode";

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureMessage }));

describe("reportPasswordResetCode", () => {
  beforeEach(() => {
    captureMessage.mockReset();
  });

  it("should send a fixed message with the code as the only tag", () => {
    reportPasswordResetCode("unexpected_failure");

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      "Password reset request ended with an unexpected code",
      {
        level: "warning",
        tags: { passwordResetCode: "unexpected_failure" },
      },
    );
  });
});
