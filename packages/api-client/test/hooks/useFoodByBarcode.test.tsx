import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useFoodByBarcode } from "../../src/hooks/useFoodByBarcode";
import { invalidateFoodQueries } from "../../src/invalidateFoodQueries";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import {
  BAD_CHECK_DIGIT_BARCODE,
  GLOBAL_FOOD_ID,
  OFF_PRODUCT_URL,
  VALID_BARCODE,
  globalFoodRow,
  globalPortionRow,
  offProductResponse,
} from "../support/barcode";
import { REST_URL, foodRow, postgrestError, postgrestRows } from "../support/postgrest";
import { createQueryClient } from "../support/queryClients";
import { edgeErrorResponse } from "../support/search";
import { createWrapper } from "../support/wrapper";

import type { UseFoodByBarcodeOptions } from "../../src/hooks/useFoodByBarcode";
import type { ReactNode } from "react";

const server = setupServer();

let offProductCalls = 0;
let requestsMade = 0;

type OffProductAnswer = () => Response;

/** Answers the local lookup with `rows` and counts nothing else. */
const answerLocalLookup = (rows: unknown[]) => {
  server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, rows)));
};

/** Answers `off-product` with `answer` and counts the calls. */
const answerOffProduct = (answer: OffProductAnswer) => {
  server.use(
    http.post(OFF_PRODUCT_URL, () => {
      offProductCalls += 1;
      return answer();
    }),
  );
};

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  server.events.on("request:start", () => {
    requestsMade += 1;
  });
});
beforeEach(() => {
  offProductCalls = 0;
  requestsMade = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const ownFood = () => foodRow({ barcode: VALID_BARCODE });

type LookupProps = { code: string; hint?: UseFoodByBarcodeOptions | undefined };

function renderLookup(rawCode: string, options?: UseFoodByBarcodeOptions) {
  const { queryClient, wrapper } = createWrapper();
  const initialProps: LookupProps = { code: rawCode, hint: options };
  const rendered = renderHook(({ code, hint }: LookupProps) => useFoodByBarcode(code, hint), {
    wrapper,
    initialProps,
  });
  return { ...rendered, queryClient, wrapper };
}

describe("useFoodByBarcode", () => {
  describe("a barcode the local database knows", () => {
    it("should resolve to found without ever invoking off-product", async () => {
      answerLocalLookup([globalFoodRow()]);
      answerOffProduct(() => HttpResponse.json(offProductResponse()));

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.result).toEqual({ status: "found", food: globalFoodRow() });
      });
      expect(offProductCalls).toBe(0);
      expect(result.current).toMatchObject({ isLoading: false, error: null });
    });

    it("should prefer the caller's own food over a global food with the same barcode", async () => {
      answerLocalLookup([globalFoodRow(), ownFood()]);

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.result).toEqual({ status: "found", food: ownFood() });
      });
      expect(offProductCalls).toBe(0);
    });

    it("should seed the detail cache of the food, and leave its portions to be fetched", async () => {
      answerLocalLookup([globalFoodRow()]);

      const { result, queryClient } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.result?.status).toBe("found");
      });
      expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toEqual(globalFoodRow());
      expect(queryClient.getQueryData(keys.foods.portions(GLOBAL_FOOD_ID))).toBeUndefined();
    });
  });

  describe("a barcode only Open Food Facts knows", () => {
    it("should invoke off-product once and resolve to the food it returns", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => HttpResponse.json(offProductResponse()));

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.result).toEqual({ status: "found", food: globalFoodRow() });
      });
      expect(offProductCalls).toBe(1);
    });

    it("should seed the detail and portions caches with what off-product returned", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => HttpResponse.json(offProductResponse()));

      const { result, queryClient } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.result?.status).toBe("found");
      });
      expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toEqual(globalFoodRow());
      expect(queryClient.getQueryData(keys.foods.portions(GLOBAL_FOOD_ID))).toEqual([
        globalPortionRow(),
      ]);
    });

    it("should resolve to not_found when off-product answers 404", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => edgeErrorResponse(404, "not_found", "No such product"));

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.result).toEqual({ status: "not_found", code: VALID_BARCODE });
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe("the barcode as typed or scanned", () => {
    it("should look up the canonical form of a barcode written with spaces and hyphens", async () => {
      const urls: URL[] = [];
      server.use(
        http.get(`${REST_URL}/foods`, ({ request }) => {
          urls.push(new URL(request.url));
          return postgrestRows(request, [globalFoodRow()]);
        }),
      );

      const { result, queryClient } = renderLookup(" 400-638 1333931 ");

      await waitFor(() => {
        expect(result.current.result?.status).toBe("found");
      });
      expect(urls.map((url) => url.searchParams.get("barcode"))).toEqual([`eq.${VALID_BARCODE}`]);
      expect(queryClient.getQueryState(keys.foods.barcode(VALID_BARCODE))?.status).toBe("success");
    });

    it("should resolve to invalid without a single request for a bad check digit", async () => {
      const { result, queryClient } = renderLookup(BAD_CHECK_DIGIT_BARCODE);

      expect(result.current).toEqual({
        result: { status: "invalid", reason: "bad_check_digit" },
        isLoading: false,
        error: null,
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(requestsMade).toBe(0);
      // The hook's own query exists but is disabled: it never fetched and holds nothing.
      const states = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state);
      expect(
        states.every((state) => state.fetchStatus === "idle" && state.data === undefined),
      ).toBe(true);
    });

    it.each([
      ["12ab", "not_digits"],
      ["12345", "bad_length"],
    ] as const)("should resolve %j to invalid (%s) without a request", async (code, reason) => {
      const { result } = renderLookup(code);

      expect(result.current.result).toEqual({ status: "invalid", reason });
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(requestsMade).toBe(0);
    });

    describe("an 8-digit code the symbology hint reads two ways", () => {
      // Valid as an EAN-8, and as a UPC-E that expands to the 13-digit code below.
      const EIGHT_DIGITS = "01234565";
      const EXPANDED_UPC_E = "0012345000065";

      const lookedUpBarcodes = () => {
        const barcodes: (string | null)[] = [];
        server.use(
          http.get(`${REST_URL}/foods`, ({ request }) => {
            barcodes.push(new URL(request.url).searchParams.get("barcode"));
            return postgrestRows(request, [globalFoodRow()]);
          }),
        );
        return barcodes;
      };

      it("should look up the 8 digits as they are when there is no hint", async () => {
        const barcodes = lookedUpBarcodes();

        const { result } = renderLookup(EIGHT_DIGITS);

        await waitFor(() => {
          expect(result.current.result?.status).toBe("found");
        });
        expect(barcodes).toEqual([`eq.${EIGHT_DIGITS}`]);
      });

      it("should look up the expanded 13-digit code when the hint is upc_e", async () => {
        const barcodes = lookedUpBarcodes();

        const { result } = renderLookup(EIGHT_DIGITS, { symbology: "upc_e" });

        await waitFor(() => {
          expect(result.current.result?.status).toBe("found");
        });
        expect(barcodes).toEqual([`eq.${EXPANDED_UPC_E}`]);
      });

      it("should keep the two readings as different cache entries because their codes differ", async () => {
        lookedUpBarcodes();
        const { result, queryClient, rerender } = renderLookup(EIGHT_DIGITS, {
          symbology: "upc_e",
        });
        await waitFor(() => {
          expect(result.current.result?.status).toBe("found");
        });

        rerender({ code: EIGHT_DIGITS });

        await waitFor(() => {
          expect(queryClient.getQueryState(keys.foods.barcode(EIGHT_DIGITS))?.status).toBe(
            "success",
          );
        });
        expect(queryClient.getQueryState(keys.foods.barcode(EXPANDED_UPC_E))?.status).toBe(
          "success",
        );
      });

      it("should resolve to invalid with the reason the hint gives", () => {
        const { result } = renderLookup("96385074", { symbology: "upc_e" });

        expect(result.current.result).toEqual({ status: "invalid", reason: "not_upc_e" });
        expect(requestsMade).toBe(0);
      });
    });

    it("should make no request while it is disabled", async () => {
      const { result } = renderLookup(VALID_BARCODE, { enabled: false });

      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(result.current).toEqual({ result: undefined, isLoading: false, error: null });
      expect(requestsMade).toBe(0);
    });

    it("should follow the code when it changes from a valid one to an invalid one", async () => {
      answerLocalLookup([globalFoodRow()]);
      const { result, rerender } = renderLookup(VALID_BARCODE);
      await waitFor(() => {
        expect(result.current.result?.status).toBe("found");
      });
      const requestsBefore = requestsMade;

      rerender({ code: BAD_CHECK_DIGIT_BARCODE });

      expect(result.current.result).toEqual({ status: "invalid", reason: "bad_check_digit" });
      expect(requestsMade).toBe(requestsBefore);
    });
  });

  describe("caching", () => {
    it("should serve a second lookup of the same code from the cache for five minutes", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => HttpResponse.json(offProductResponse()));
      const { result, unmount, wrapper } = renderLookup(VALID_BARCODE);
      await waitFor(() => {
        expect(result.current.result?.status).toBe("found");
      });
      unmount();

      const second = renderHook(() => useFoodByBarcode(VALID_BARCODE), { wrapper });

      expect(second.result.current.result?.status).toBe("found");
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(offProductCalls).toBe(1);
    });
  });

  describe("failures", () => {
    it("should surface a rate limit with its retry delay, never retry it, and have no result", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => edgeErrorResponse(429, "rate_limited", "Slow down", 20));

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.error).toEqual({
          kind: "rate_limited",
          retryAfterSeconds: 20,
          debugMessage: "Slow down",
          message: "Slow down",
        });
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
      expect(result.current.result).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(offProductCalls).toBe(1);
    });

    it("should not retry a rate limit even when the query client retries by default", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => edgeErrorResponse(429, "rate_limited", "Slow down", 20));
      const queryClient = createQueryClient({
        defaultOptions: { queries: { retry: 3, retryDelay: 1 } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <KeyLowProvider client={createTestClient()} queryClient={queryClient}>
          {children}
        </KeyLowProvider>
      );

      const { result } = renderHook(() => useFoodByBarcode(VALID_BARCODE), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toMatchObject({ kind: "rate_limited" });
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
      expect(offProductCalls).toBe(1);
    });

    it("should not look again after a failure when the window regains focus", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => edgeErrorResponse(429, "rate_limited", "Slow down", 20));
      const { result } = renderLookup(VALID_BARCODE);
      await waitFor(() => {
        expect(result.current.error).toMatchObject({ kind: "rate_limited" });
      });

      try {
        act(() => {
          focusManager.setFocused(false);
          focusManager.setFocused(true);
        });
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

        expect(offProductCalls).toBe(1);
      } finally {
        focusManager.setFocused(undefined);
      }
    });

    it("should not look again after a failure when the network returns", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => edgeErrorResponse(429, "rate_limited", "Slow down", 20));
      const { result } = renderLookup(VALID_BARCODE);
      await waitFor(() => {
        expect(result.current.error).toMatchObject({ kind: "rate_limited" });
      });

      act(() => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(offProductCalls).toBe(1);
    });

    it("should keep the previous status when a later lookup is rate limited", async () => {
      answerLocalLookup([]);
      answerOffProduct(() => edgeErrorResponse(404, "not_found", "No such product"));
      const { result, queryClient } = renderLookup(VALID_BARCODE);
      await waitFor(() => {
        expect(result.current.result).toEqual({ status: "not_found", code: VALID_BARCODE });
      });

      answerOffProduct(() => edgeErrorResponse(429, "rate_limited", "Slow down", 20));
      await act(() => invalidateFoodQueries(queryClient));

      await waitFor(() => {
        expect(result.current.error).toEqual({
          kind: "rate_limited",
          retryAfterSeconds: 20,
          debugMessage: "Slow down",
          message: "Slow down",
        });
      });
      expect(result.current.result).toEqual({ status: "not_found", code: VALID_BARCODE });
    });

    it("should report an edge error of off-product as its kind, keeping the raw text only as debugMessage", async () => {
      answerLocalLookup([]);
      answerOffProduct(() =>
        edgeErrorResponse(502, "upstream_error", "Open Food Facts is unavailable"),
      );

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.error).toEqual({
          kind: "upstream_error",
          debugMessage: "Open Food Facts is unavailable",
          message: "Open Food Facts is unavailable",
        });
      });
      expect(result.current.result).toBeUndefined();
    });

    it("should report a failed local lookup without asking off-product", async () => {
      server.use(
        http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "Database unavailable")),
      );
      answerOffProduct(() => HttpResponse.json(offProductResponse()));

      const { result } = renderLookup(VALID_BARCODE);

      await waitFor(() => {
        expect(result.current.error).toMatchObject({ kind: "failed" });
      });
      expect(offProductCalls).toBe(0);
    });
  });
});
