import { setUser } from "@sentry/nextjs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SentryUser } from "@/components/monitoring/SentryUser";

vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn() }));

describe("SentryUser", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(setUser).mockClear();
  });

  it("should give Sentry the account id and nothing else about the user", () => {
    render(<SentryUser userId="5f1c" />);

    expect(setUser).toHaveBeenCalledExactlyOnceWith({ id: "5f1c" });
  });

  it("should clear the user when the account leaves the page", () => {
    const { unmount } = render(<SentryUser userId="5f1c" />);

    unmount();

    expect(setUser).toHaveBeenLastCalledWith(null);
  });
});
