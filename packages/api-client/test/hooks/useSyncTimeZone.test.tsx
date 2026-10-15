import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useSyncTimeZone } from "../../src/hooks/useSyncTimeZone";
import { keys } from "../../src/queryKeys";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  postgrestError,
  postgrestRows,
  signInAs,
} from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { UseSyncTimeZoneInput } from "../../src/hooks/useSyncTimeZone";

const server = setupServer();

let writtenZones: unknown[] = [];
let respondWithFailure = false;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  writtenZones = [];
  respondWithFailure = false;
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.patch(`${REST_URL}/profiles`, async ({ request }) => {
      writtenZones.push(await request.json());
      return respondWithFailure
        ? postgrestError(500, "XX000", "database unavailable")
        : postgrestRows(request, [{ timezone: "Europe/London" }]);
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const syncing: UseSyncTimeZoneInput = {
  deviceTimeZone: "Europe/London",
  profileTimeZone: "UTC",
  enabled: true,
  foregroundEventCount: 0,
};

async function renderSync(initialProps: UseSyncTimeZoneInput) {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  const hook = renderHook(
    (props: UseSyncTimeZoneInput) => {
      useSyncTimeZone(props);
    },
    {
      wrapper: rendered.wrapper,
      initialProps,
    },
  );
  return { ...rendered, ...hook };
}

// Nothing is written, so there is no event to wait for: give a stray write time to arrive.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("useSyncTimeZone", () => {
  it("should write the device zone when it is valid and differs from the profile zone", async () => {
    await renderSync(syncing);

    await waitFor(() => {
      expect(writtenZones).toEqual([{ timezone: "Europe/London" }]);
    });
  });

  it("should not write when the device zone equals the profile zone", async () => {
    await renderSync({ ...syncing, profileTimeZone: "Europe/London" });

    await settle();
    expect(writtenZones).toEqual([]);
  });

  it("should not write, and not throw, when the device zone is invalid", async () => {
    await renderSync({ ...syncing, deviceTimeZone: "Mars/Olympus" });

    await settle();
    expect(writtenZones).toEqual([]);
  });

  it.each([null, undefined])("should not write while the profile zone is %s", async (unknown) => {
    await renderSync({ ...syncing, profileTimeZone: unknown });

    await settle();
    expect(writtenZones).toEqual([]);
  });

  it("should not write while enabled is false, and write once it turns true", async () => {
    const { rerender } = await renderSync({ ...syncing, enabled: false });
    await settle();
    expect(writtenZones).toEqual([]);

    rerender({ ...syncing, enabled: true });

    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });
  });

  it("should not write again when it renders again, even if the profile zone is read afresh and still differs", async () => {
    const { rerender } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });

    rerender({ ...syncing });
    rerender({ ...syncing, profileTimeZone: undefined });
    rerender({ ...syncing });

    await settle();
    expect(writtenZones).toHaveLength(1);
  });

  it("should write again for a different device zone", async () => {
    const { rerender } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });

    rerender({ ...syncing, deviceTimeZone: "America/New_York" });

    await waitFor(() => {
      expect(writtenZones).toEqual([
        { timezone: "Europe/London" },
        { timezone: "America/New_York" },
      ]);
    });
  });

  it("should not try a failed write again for the same zone, and stay quiet about it", async () => {
    respondWithFailure = true;
    const { rerender, result } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });

    rerender({ ...syncing, profileTimeZone: undefined });
    rerender({ ...syncing });

    await settle();
    expect(writtenZones).toHaveLength(1);
    expect(result.current).toBeUndefined();
  });

  it("should try a failed write again once the app returns to the foreground", async () => {
    respondWithFailure = true;
    const { rerender } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });
    await settle();
    expect(writtenZones).toHaveLength(1);

    rerender({ ...syncing, foregroundEventCount: 1 });

    await waitFor(() => {
      expect(writtenZones).toEqual([{ timezone: "Europe/London" }, { timezone: "Europe/London" }]);
    });
  });

  it("should write at most once for each foreground event while the write keeps failing", async () => {
    respondWithFailure = true;
    const { rerender } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });

    rerender({ ...syncing, foregroundEventCount: 1 });
    await waitFor(() => {
      expect(writtenZones).toHaveLength(2);
    });
    rerender({ ...syncing, foregroundEventCount: 1, profileTimeZone: undefined });
    rerender({ ...syncing, foregroundEventCount: 1 });
    await settle();
    expect(writtenZones).toHaveLength(2);

    rerender({ ...syncing, foregroundEventCount: 2 });
    await waitFor(() => {
      expect(writtenZones).toHaveLength(3);
    });
  });

  it("should not write again after a foreground event once the write succeeded and the profile zone matches", async () => {
    const { rerender } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });

    rerender({ ...syncing, profileTimeZone: "Europe/London" });
    rerender({ ...syncing, profileTimeZone: "Europe/London", foregroundEventCount: 1 });

    await settle();
    expect(writtenZones).toHaveLength(1);
  });

  it("should write nothing for an invalid device zone on any foreground event", async () => {
    const invalid = { ...syncing, deviceTimeZone: "Mars/Olympus" };
    const { rerender } = await renderSync(invalid);

    rerender({ ...invalid, foregroundEventCount: 1 });
    rerender({ ...invalid, foregroundEventCount: 2 });

    await settle();
    expect(writtenZones).toEqual([]);
  });

  it("should try a zone again after it was disabled and enabled, as when another user signs in", async () => {
    const { rerender } = await renderSync(syncing);
    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });

    rerender({ ...syncing, enabled: false });
    rerender({ ...syncing, enabled: true });

    await waitFor(() => {
      expect(writtenZones).toHaveLength(2);
    });
  });

  it("should invalidate the profile time zone and the diary reads after a successful write", async () => {
    const rendered = await renderSyncWithCache();

    await waitFor(() => {
      expect(rendered.queryClient.getQueryState(keys.profiles.timeZone)?.isInvalidated).toBe(true);
    });
    for (const key of cachedDiaryKeys) {
      expect(rendered.queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });

  it("should not invalidate anything when the write failed", async () => {
    respondWithFailure = true;
    const rendered = await renderSyncWithCache();

    await waitFor(() => {
      expect(writtenZones).toHaveLength(1);
    });
    await settle();
    expect(rendered.queryClient.getQueryState(keys.profiles.timeZone)?.isInvalidated).toBe(false);
    expect(rendered.queryClient.getQueryState(keys.diary.day("2026-10-15"))?.isInvalidated).toBe(
      false,
    );
  });
});

const cachedDiaryKeys = [
  keys.diary.day("2026-10-15"),
  keys.diary.week("2026-10-12"),
  keys.diary.completeDays("2026-10"),
  keys.diary.recentFoods,
];

// Seeds the caches before the hook first renders, so its write finds them already there.
async function renderSyncWithCache() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  rendered.queryClient.setQueryData(keys.profiles.timeZone, "UTC");
  for (const key of cachedDiaryKeys) {
    rendered.queryClient.setQueryData(key, []);
  }
  renderHook(
    () => {
      useSyncTimeZone(syncing);
    },
    { wrapper: rendered.wrapper },
  );
  return rendered;
}
