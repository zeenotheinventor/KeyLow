import { PROGRAM_SCREEN } from "@keylow/core/copy";
import { startSnapshot } from "@keylow/core/engine";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useProgramScreen } from "../../src/hooks/useProgramScreen";
import { REST_URL, postgrestRows } from "../support/postgrest";
import {
  installProgramFake,
  programRow,
  snapshotRow,
  startSnapshotRow,
  targetsRow,
} from "../support/program";
import {
  RECOGNISABLE_SETUP_BIRTH_DATE,
  RECOGNISABLE_SETUP_HEIGHT,
  setUpProfileRow,
} from "../support/setupState";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const NOW = new Date("2026-10-30T12:00:00Z");

function renderScreen(enabled = true) {
  const { wrapper } = createWrapper();
  return renderHook(() => useProgramScreen({ enabled, now: NOW }), { wrapper });
}

describe("useProgramScreen", () => {
  it("should be loading, and not paused, while the reads are on their way", async () => {
    installProgramFake(server, { programs: [programRow()], snapshots: [startSnapshotRow()] });

    const { result } = renderScreen();

    expect(result.current).toEqual({ status: "loading", isPaused: false });
    // Let the reads finish, so they do not land in the next test.
    await waitFor(() => {
      expect(result.current.status).toBe("program");
    });
  });

  it("should be loading, paused, when nothing has been read and there is no connection", () => {
    onlineManager.setOnline(false);
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useProgramScreen({ enabled: true, now: NOW }), { wrapper });

    expect(result.current).toEqual({ status: "loading", isPaused: true });
    // Drop the waiting reads, so they do not run when the next test goes back online.
    queryClient.clear();
  });

  it("should be loading, not paused, and read nothing while reads are not enabled", async () => {
    const { requests } = installProgramFake(server);

    const { result } = renderScreen(false);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current).toEqual({ status: "loading", isPaused: false });
    expect(requests).toEqual([]);
  });

  it("should be the no-program state for a user with no active program", async () => {
    installProgramFake(server);

    const { result } = renderScreen();

    await waitFor(() => {
      expect(result.current.status).toBe("no-program");
    });
  });

  it("should build the view of an active program with its check-in", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      snapshots: [startSnapshotRow(), snapshotRow()],
      targets: [targetsRow()],
    });

    const { result } = renderScreen();

    await waitFor(() => {
      expect(result.current.status).toBe("program");
    });
    if (result.current.status !== "program") {
      throw new Error("The program state was expected");
    }
    const { view } = result.current;
    expect(view.hero.muKcal).toBe(2400);
    expect(view.hero.isSettling).toBe(false);
    expect(view.checkin?.date).toBe("2026-10-30");
    expect(view.targets?.macros).toEqual({ proteinG: 126, carbsG: 245, fatG: 73 });
  });

  it("should work out the starting estimate on the device for a programme with no snapshot yet", async () => {
    installProgramFake(server, { programs: [programRow()], snapshots: [], targets: [] });
    // The saved setup the estimate is worked out from: the profile's stats and the latest weigh-in.
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        const columns = (new URL(request.url).searchParams.get("select") ?? "").split(",");
        const row = { ...setUpProfileRow, timezone: "Europe/London" };
        return postgrestRows(request, [
          Object.fromEntries(columns.map((column) => [column, Reflect.get(row, column)])),
        ]);
      }),
      http.get(`${REST_URL}/weigh_ins`, ({ request }) =>
        postgrestRows(request, [{ weight_kg: 83.4, local_date: "2026-10-29" }]),
      ),
    );
    const expected = startSnapshot({
      stats: {
        sex: "female",
        birthDate: RECOGNISABLE_SETUP_BIRTH_DATE,
        heightCm: RECOGNISABLE_SETUP_HEIGHT,
        activity: "moderate",
      },
      onboardingWeightKg: 83.4,
      asOfDate: "2026-10-30",
      trendWeightKg: null,
    });

    const { result } = renderScreen();

    await waitFor(() => {
      expect(result.current.status).toBe("program");
    });
    if (result.current.status !== "program") {
      throw new Error("The program state was expected");
    }
    const { view } = result.current;
    expect(view.hero.muKcal).toBe(expected.mu_kcal);
    expect(view.hero.isSettling).toBe(true);
    expect(view.hero.captionText).toBe(PROGRAM_SCREEN.hero.settlingLine);
    expect(view.checkin).toBeNull();
  });

  it("should be the error state when a read fails, and read again on retry", async () => {
    const { failWith, recover } = installProgramFake(server, {
      programs: [programRow()],
      snapshots: [startSnapshotRow()],
    });
    failWith("programs", "XX000");

    const { result } = renderScreen();

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    recover("programs");
    if (result.current.status !== "error") {
      throw new Error("The error state was expected");
    }
    const { retry } = result.current;
    act(() => {
      retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe("program");
    });
  });
});
