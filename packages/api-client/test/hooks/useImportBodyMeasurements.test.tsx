import { mapHealthBodyFatSamples, mapHealthLeanMassSamples } from "@keylow/core/weight";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBodyMeasurements } from "../../src/hooks/useBodyMeasurements";
import { useImportBodyMeasurements } from "../../src/hooks/useImportBodyMeasurements";
import { keys } from "../../src/queryKeys";
import {
  RECOGNISABLE_SAMPLE_ID,
  RECOGNISABLE_VALUE,
  installBodyMeasurementsFake,
} from "../support/bodyMeasurements";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
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

const timeZone = { timeZone: "Europe/London" };
const rows = [
  ...mapHealthBodyFatSamples(
    [
      {
        sampleId: RECOGNISABLE_SAMPLE_ID,
        measuredAt: "2026-10-15T07:00:00Z",
        value: RECOGNISABLE_VALUE,
      },
    ],
    timeZone,
  ).rows,
  ...mapHealthLeanMassSamples(
    [{ sampleId: "key571-b", measuredAt: "2026-10-14T07:00:00Z", value: 60, unit: "kilograms" }],
    timeZone,
  ).rows,
];

const answerAuthUser = () => {
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
  );
};

describe("useImportBodyMeasurements", () => {
  it("should import the rows for the signed in user and refresh the lists", async () => {
    answerAuthUser();
    const fake = installBodyMeasurementsFake(server);
    const rendered = createWrapper();
    await signInAs(rendered.client, SIGNED_IN_USER_ID);
    const { result } = renderHook(
      () => ({
        fat: useBodyMeasurements("body_fat_pct"),
        lean: useBodyMeasurements("lean_mass_kg"),
        import: useImportBodyMeasurements(),
      }),
      { wrapper: rendered.wrapper },
    );
    await waitFor(() => {
      expect(result.current.fat.isSuccess && result.current.lean.isSuccess).toBe(true);
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
      expect(
        rendered.queryClient.getQueryData(keys.bodyMeasurements.list("body_fat_pct")),
      ).toHaveLength(1);
      expect(
        rendered.queryClient.getQueryData(keys.bodyMeasurements.list("lean_mass_kg")),
      ).toHaveLength(1);
    });
  });

  it("should invalidate the whole family on success", async () => {
    answerAuthUser();
    installBodyMeasurementsFake(server);
    const rendered = createWrapper();
    await signInAs(rendered.client, SIGNED_IN_USER_ID);
    rendered.queryClient.setQueryData(keys.bodyMeasurements.list("body_fat_pct"), []);
    const { result } = renderHook(() => useImportBodyMeasurements(), {
      wrapper: rendered.wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(rows);
    });

    await waitFor(() => {
      expect(
        rendered.queryClient.getQueryState(keys.bodyMeasurements.list("body_fat_pct"))
          ?.isInvalidated,
      ).toBe(true);
    });
  });

  it("should invalidate the whole family on a failure too, since an earlier chunk may have been stored", async () => {
    answerAuthUser();
    const fake = installBodyMeasurementsFake(server);
    fake.failWith("XX000");
    const rendered = createWrapper();
    await signInAs(rendered.client, SIGNED_IN_USER_ID);
    rendered.queryClient.setQueryData(keys.bodyMeasurements.list("lean_mass_kg"), []);
    const { result } = renderHook(() => useImportBodyMeasurements(), {
      wrapper: rendered.wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(
      rendered.queryClient.getQueryState(keys.bodyMeasurements.list("lean_mass_kg"))?.isInvalidated,
    ).toBe(true);
  });

  it("should refuse, without a request to the table, when nobody is signed in", async () => {
    const fake = installBodyMeasurementsFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useImportBodyMeasurements(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("You must be signed in to import body measurements");
    expect(fake.requests).toEqual([]);
  });

  it("should reject with an error that holds neither a value nor a sample id when the import fails", async () => {
    answerAuthUser();
    const fake = installBodyMeasurementsFake(server);
    fake.failWith("23514");
    const rendered = createWrapper();
    await signInAs(rendered.client, SIGNED_IN_USER_ID);
    const { result } = renderHook(() => useImportBodyMeasurements(), {
      wrapper: rendered.wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(rows).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not import the body measurements (23514)");
    expect(JSON.stringify(result.current.error)).not.toContain("23.456");
    expect(JSON.stringify(result.current.error)).not.toContain(RECOGNISABLE_SAMPLE_ID);
  });
});
