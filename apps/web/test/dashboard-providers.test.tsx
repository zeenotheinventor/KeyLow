import { TERMS_VERSION } from "@keylow/core/copy";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { profileBackend, resetProfileBackend, signInProfileClient } from "./support/profileBackend";

import { Providers } from "@/app/(dashboard)/Providers";

vi.mock("@/lib/supabase/client", async () => {
  const { profileClient } = await import("./support/profileBackend");
  return { createClient: () => profileClient };
});

vi.mock("next/navigation", () => ({ usePathname: () => "/diary" }));

const acceptedTerms = {
  terms_accepted_at: "2026-10-15T09:00:00Z",
  terms_version: TERMS_VERSION,
};

let visibility: DocumentVisibilityState;

// Nothing is written, so there is no event to wait for: give a stray request time to arrive.
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

function changeVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("the dashboard providers", () => {
  beforeEach(async () => {
    resetProfileBackend();
    await signInProfileClient();
    visibility = "visible";
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Europe/London",
    }));
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should save the browser's time zone on the profile when the terms are accepted and it differs", async () => {
    profileBackend.terms = acceptedTerms;

    render(
      <Providers>
        <p>Page content</p>
      </Providers>,
    );

    await waitFor(() => {
      expect(profileBackend.updateRequests).toEqual([{ timezone: "Europe/London" }]);
    });
  });

  it("should read and save no time zone while the terms are not accepted", async () => {
    profileBackend.terms = { terms_accepted_at: null, terms_version: null };

    render(
      <Providers>
        <p>Page content</p>
      </Providers>,
    );

    await waitFor(() => {
      expect(profileBackend.termsReadCount).toBeGreaterThan(0);
    });
    await settle();
    expect(profileBackend.timeZoneReadCount).toBe(0);
    expect(profileBackend.updateRequests).toEqual([]);
  });

  it("should try a failed time zone save again when the tab becomes visible, and not when it is hidden", async () => {
    profileBackend.terms = acceptedTerms;
    profileBackend.updateFails = true;
    render(
      <Providers>
        <p>Page content</p>
      </Providers>,
    );
    await waitFor(() => {
      expect(profileBackend.updateRequests).toHaveLength(1);
    });

    changeVisibility("hidden");
    await settle();
    expect(profileBackend.updateRequests).toHaveLength(1);

    changeVisibility("visible");
    await waitFor(() => {
      expect(profileBackend.updateRequests).toHaveLength(2);
    });
  });
});
