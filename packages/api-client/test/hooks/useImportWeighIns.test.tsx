import { mapHealthSamples } from "@keylow/core/weight";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useImportWeighIns } from "../../src/hooks/useImportWeighIns";
import { useWeighIns } from "../../src/hooks/useWeighIns";
import { keys } from "../../src/queryKeys";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { installWeighInsFake } from "../support/weighIns";
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

const { rows } = mapHealthSamples(
  [
    { sampleId: "key362-a", measuredAt: "2026-10-15T07:00:00Z", value: 81.234, unit: "kilograms" },
    { sampleId: "key362-b", measuredAt: "2026-10-14T07:00:00Z", value: 82, unit: "kilograms" },
  ],
  { timeZone: "Europe/London" },
);

const answerAuthUser = () => {
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
  );
};

describe("useImportWeighIns", () => {
  it("should import the rows for the signed in user and refresh the list", async () => {
    answerAuthUser();
    const fake = installWeighInsFake(server);
    const rendered = createWrapper();
    await signInAs(rendered.client, SIGNED_IN_USER_ID);
    const { result } = renderHook(() => ({ list: useWeighIns(), import: useImportWeighIns() }), {
      wrapper: rendered.wrapper,
    });
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.import.mutateAsync(rows);
    });

    expect(outcome).toEqual({ inserted: 2, skipped: 0 });
    expect(fake.requests.find(({ method }) => method === "POST")?.body).toEqual(
      rows.map((row) => ({ ...row, user_id: SIGNED_IN_USER_ID })),
    );
    // Asserts on the query cache: the rendered hook's last update is lost at the act edge in this harness.
    await waitFor(() => {
      expect(rendered.queryClient.getQueryData(keys.weighIns.list)).toHaveLength(2);
    });
  });

  it("should refuse, without a request to the table, when nobody is signed in", async () => {
    const fake = installWeighInsFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useImportWeighIns(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("You must be signed in to import weigh-ins");
    expect(fake.requests).toEqual([]);
  });

  it("should reject with an error that holds neither a weight nor a sample id when the import fails", async () => {
    answerAuthUser();
    const fake = installWeighInsFake(server);
    fake.failWith("23514");
    const rendered = createWrapper();
    await signInAs(rendered.client, SIGNED_IN_USER_ID);
    const { result } = renderHook(() => useImportWeighIns(), { wrapper: rendered.wrapper });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not import the weigh-ins (23514)");
    expect(JSON.stringify(result.current.error)).not.toContain("81.234");
    expect(JSON.stringify(result.current.error)).not.toContain("key362-a");
  });
});
