import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useExpenditureHistory } from "../../src/hooks/useExpenditureHistory";
import { useTargetsHistory } from "../../src/hooks/useTargetsHistory";
import { installProgramFake, programRow, snapshotRow, targetsRow } from "../support/program";
import { createWrapper } from "../support/wrapper";

import type { ProgramHistoryOptions } from "../../src/hooks/ProgramHistoryOptions";
import type { ProgramTable } from "../support/program";

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

// 12:00 on Saturday 24 October in London.
const NOW = "2026-10-24T12:00:00Z";

type HistoryHook = (options: ProgramHistoryOptions) => {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
};

const hooks: [string, HistoryHook, ProgramTable][] = [
  ["useExpenditureHistory", useExpenditureHistory, "expenditure_snapshots"],
  ["useTargetsHistory", useTargetsHistory, "targets"],
];

describe.each(hooks)("%s: what both program history hooks share", (_name, useHistory, table) => {
  const withRows = () =>
    installProgramFake(server, {
      programs: [programRow()],
      snapshots: [snapshotRow({ as_of_date: "2026-10-23" })],
      targets: [targetsRow()],
    });

  describe("when the profile time zone cannot be read", () => {
    it("should report an error and make no history request, not stay pending for ever", async () => {
      const fake = withRows();
      fake.failWith("profiles", "XX000");
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useHistory({ weeks: 4, now: NOW }), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(fake.requestsTo(table)).toEqual([]);
    });

    it("should read the time zone and then the history again when refetch is called", async () => {
      const fake = withRows();
      fake.failWith("profiles", "XX000");
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHistory({ weeks: 4, now: NOW }), { wrapper });
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      fake.recover("profiles");
      await act(() => result.current.refetch());

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.isError).toBe(false);
    });
  });

  describe("when the history cannot be read", () => {
    it("should report the error, and read it again when refetch is called", async () => {
      const fake = withRows();
      fake.failWith(table, "XX000");
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHistory({ weeks: 4, now: NOW }), { wrapper });
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error).toBeInstanceOf(Error);

      fake.recover(table);
      await act(() => result.current.refetch());

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
    });
  });

  describe("the number of weeks", () => {
    it.each([0, -4, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "should report a RangeError that names the rule and make no request at all for %s weeks",
      async (weeks) => {
        const fake = withRows();
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useHistory({ weeks, now: NOW }), { wrapper });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
        expect(result.current.error).toBeInstanceOf(RangeError);
        expect(result.current.error?.message).toBe(
          "A history must cover a positive whole number of weeks",
        );
        expect(fake.requests).toEqual([]);
      },
    );

    it("should not throw while rendering", () => {
      withRows();
      const { wrapper } = createWrapper();

      expect(() =>
        renderHook(() => useHistory({ weeks: -1, now: NOW }), { wrapper }),
      ).not.toThrow();
    });
  });
});
