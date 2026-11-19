import {
  appendFreezeEvents,
  fetchAchievementStats,
  fetchAchievementsBackfilledAt,
  markAchievementsSeen,
  recordAchievements,
  useSupabase,
} from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { snapshotWithOneEntry } from "./fixtures";

import type { Database } from "@keylow/api-client";
import type { PropsWithChildren } from "react";

import { useSyncAchievements } from "@/components/achievements/useSyncAchievements";

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useSupabase: vi.fn(),
  fetchAchievementStats: vi.fn(),
  fetchAchievementsBackfilledAt: vi.fn(),
  recordAchievements: vi.fn(),
  appendFreezeEvents: vi.fn(),
  markAchievementsSeen: vi.fn(),
}));

// Never called: every read and write of the client is a mocked repository function.
const client = createClient<Database>("http://localhost:54321", "not-a-real-key");
let queryClient: QueryClient;

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mountAndSettle = async () => {
  renderHook(
    () => {
      useSyncAchievements();
    },
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(vi.mocked(appendFreezeEvents)).toHaveBeenCalled();
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  queryClient = new QueryClient();
  vi.mocked(useSupabase).mockReturnValue(client);
  vi.mocked(fetchAchievementStats).mockResolvedValue({ ...snapshotWithOneEntry, held: [] });
  vi.mocked(fetchAchievementsBackfilledAt).mockResolvedValue("2026-11-01T09:00:00.000Z");
  vi.mocked(recordAchievements).mockResolvedValue([]);
  vi.mocked(appendFreezeEvents).mockResolvedValue();
});

afterEach(cleanup);

describe("useSyncAchievements", () => {
  it("should record what the engine finds as new, outside a backfill", async () => {
    await mountAndSettle();

    expect(recordAchievements).toHaveBeenCalledWith(client, ["first-bite"], false);
  });

  it("should record the quiet backfill when the profile has no backfill date", async () => {
    vi.mocked(fetchAchievementsBackfilledAt).mockResolvedValue(null);

    await mountAndSettle();

    expect(recordAchievements).toHaveBeenCalledWith(client, ["first-bite"], true);
  });

  it("should write the freezes the run earned", async () => {
    await mountAndSettle();

    expect(appendFreezeEvents).toHaveBeenCalledOnce();
  });

  it("should read the achievements again when something was recorded", async () => {
    vi.mocked(recordAchievements).mockResolvedValue(["first-bite"]);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await mountAndSettle();

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled();
    });
  });

  it("should never mark anything seen, so the phone still celebrates", async () => {
    vi.mocked(fetchAchievementsBackfilledAt).mockResolvedValue(null);

    await mountAndSettle();

    expect(markAchievementsSeen).not.toHaveBeenCalled();
  });

  it("should drop a run that fails and say nothing of what it read", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetchAchievementStats).mockRejectedValue(new Error("read the achievement stats"));

    renderHook(
      () => {
        useSyncAchievements();
      },
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(fetchAchievementStats).toHaveBeenCalled();
    });

    expect(recordAchievements).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
