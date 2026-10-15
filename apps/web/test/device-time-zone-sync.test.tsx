import { useProfileTimeZone, useSyncTimeZone, useTermsAcceptance } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiClient from "@keylow/api-client";

import { DeviceTimeZoneSync } from "@/app/(dashboard)/DeviceTimeZoneSync";

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useSyncTimeZone: vi.fn(),
  useProfileTimeZone: vi.fn(),
  useTermsAcceptance: vi.fn(),
}));

type Acceptance = ReturnType<typeof useTermsAcceptance>["data"];

const currentAcceptance: Acceptance = {
  terms_accepted_at: "2026-10-15T09:00:00Z",
  terms_version: TERMS_VERSION,
};

// The hook that writes is proved in the api-client package. Here it is a spy, for what the page hands it.
const syncSpy = vi.mocked(useSyncTimeZone);
const profileTimeZoneSpy = vi.mocked(useProfileTimeZone);
const termsAcceptanceSpy = vi.mocked(useTermsAcceptance);

let deviceTimeZone: string;
let visibility: DocumentVisibilityState;

const callsWithEnabled = (enabled: boolean) =>
  syncSpy.mock.calls.filter(([input]) => input.enabled === enabled);

function acceptanceIs(data: Acceptance | undefined) {
  termsAcceptanceSpy.mockReturnValue({ data } as ReturnType<typeof useTermsAcceptance>);
}

function changeVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("syncing the device time zone to the profile", () => {
  beforeEach(() => {
    deviceTimeZone = "Europe/London";
    visibility = "visible";
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: deviceTimeZone,
    }));
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    profileTimeZoneSpy.mockReturnValue({ data: "UTC" } as ReturnType<typeof useProfileTimeZone>);
    acceptanceIs(currentAcceptance);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should attempt the sync with the device zone and the profile zone on mount once the terms are accepted", () => {
    render(<DeviceTimeZoneSync />);

    expect(syncSpy).toHaveBeenLastCalledWith({
      deviceTimeZone: "Europe/London",
      profileTimeZone: "UTC",
      enabled: true,
    });
  });

  it.each([
    ["the acceptance is still loading", undefined],
    ["the account has no profile row", null],
    ["the account never accepted", { terms_accepted_at: null, terms_version: null }],
    [
      "the account accepted an older version",
      { terms_accepted_at: "2026-01-01T09:00:00Z", terms_version: "2026-01-01" },
    ],
  ])("should pass enabled false and read no profile zone while %s", (_case, acceptance) => {
    acceptanceIs(acceptance);

    render(<DeviceTimeZoneSync />);

    expect(syncSpy).toHaveBeenCalled();
    expect(callsWithEnabled(true)).toEqual([]);
    expect(profileTimeZoneSpy).toHaveBeenCalledWith({ enabled: false });
    expect(profileTimeZoneSpy).not.toHaveBeenCalledWith({ enabled: true });
  });

  it("should attempt the sync with the new device zone when the tab becomes visible again", () => {
    render(<DeviceTimeZoneSync />);

    deviceTimeZone = "America/New_York";
    changeVisibility("visible");

    expect(syncSpy).toHaveBeenLastCalledWith({
      deviceTimeZone: "America/New_York",
      profileTimeZone: "UTC",
      enabled: true,
    });
  });

  it("should not read the device zone again when the tab is hidden", () => {
    render(<DeviceTimeZoneSync />);

    deviceTimeZone = "America/New_York";
    changeVisibility("hidden");

    expect(syncSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ deviceTimeZone: "Europe/London" }),
    );
  });

  it("should stop listening for the tab becoming visible once unmounted", () => {
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<DeviceTimeZoneSync />);

    unmount();

    expect(removeListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
