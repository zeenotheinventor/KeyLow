import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSetupState } from "../../src/hooks/useSetupState";
import { keys } from "../../src/queryKeys";
import {
  freshProfileRow,
  installSetupFake,
  programRow,
  setUpProfileRow,
  setupWeighInRow,
} from "../support/setupState";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useSetupState", () => {
  it("should load the mapped setup state and cache it under the setup state key", async () => {
    installSetupFake(server, {
      profiles: [setUpProfileRow],
      programs: [programRow()],
      weighIns: [setupWeighInRow({ weight_kg: 82.3, local_date: "2026-10-16" })],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useSetupState(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      isSetUp: true,
      stats: {
        sex: "female",
        birthDate: "1987-03-09",
        heightCm: 183.4,
        activity: "moderate",
        weightUnit: "kg",
      },
      program: {
        id: "66666666-6666-4666-8666-666666666666",
        goal: "lose",
        ratePctPerWeek: 0.5,
        proteinGPerKg: 2,
        fatFraction: 0.3,
        splitPreset: "balanced",
      },
      latestWeighIn: { weightKg: 82.3, localDate: "2026-10-16" },
    });
    expect(queryClient.getQueryData(keys.profiles.setupState)).toEqual(result.current.data);
  });

  it("should make no request while enabled is false", async () => {
    const { requests } = installSetupFake(server, { profiles: [freshProfileRow] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSetupState({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("should expose the error, with the code only, when a read fails", async () => {
    const { failWith } = installSetupFake(server, { profiles: [freshProfileRow] });
    failWith("programs", "XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSetupState(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("message", "Could not load your setup (XX000)");
    expect(result.current.data).toBeUndefined();
  });
});
