import type * as ApiClient from "@keylow/api-client";
import type { UseFoodByBarcodeOptions, UseFoodByBarcodeReturn } from "@keylow/api-client";

export const mockUseFoodByBarcode = jest.fn<
  UseFoodByBarcodeReturn,
  [string, UseFoodByBarcodeOptions | undefined]
>();

const idle: UseFoodByBarcodeReturn = { result: undefined, isLoading: false, error: null };
let outcome: UseFoodByBarcodeReturn = idle;

/** Sets what every enabled lookup reports until the next call or reset. */
export function setLookupOutcome(next: Partial<UseFoodByBarcodeReturn>): void {
  outcome = { ...idle, ...next };
}

export function resetBarcodeLookupMock(): void {
  outcome = idle;
  mockUseFoodByBarcode.mockReset();
  mockUseFoodByBarcode.mockImplementation((_rawCode, options) =>
    options?.enabled === false ? idle : outcome,
  );
}

/**
 * The codes the hook was asked to look up, in order. A lookup is one stretch of renders with the
 * same code enabled, so rendering again does not count and looking the same code up after a
 * reset does.
 */
export function lookedUpCodes(): string[] {
  const requestedCodes = mockUseFoodByBarcode.mock.calls.map(([rawCode, options]) =>
    options?.enabled === false ? undefined : rawCode,
  );
  const lookups: string[] = [];
  let previous: string | undefined;
  for (const code of requestedCodes) {
    if (code !== undefined && code !== previous) {
      lookups.push(code);
    }
    previous = code;
  }
  return lookups;
}

// The real error classes and helpers stay in place. Only the barcode hook is replaced.
export const mockBarcodeApiClient = {
  ...jest.requireActual<typeof ApiClient>("@keylow/api-client"),
  useFoodByBarcode: (rawCode: string, options?: UseFoodByBarcodeOptions) =>
    mockUseFoodByBarcode(rawCode, options),
};
