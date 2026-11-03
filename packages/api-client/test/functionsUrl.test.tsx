import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFunctionsUrl } from "../src/KeyLowProvider";
import { createWrapper } from "./support/wrapper";

describe("useFunctionsUrl", () => {
  it("should give the functions URL the provider was given", () => {
    const { wrapper } = createWrapper(undefined, {
      functionsUrl: "https://example.test/functions/v1",
    });

    const { result } = renderHook(() => useFunctionsUrl(), { wrapper });

    expect(result.current).toBe("https://example.test/functions/v1");
  });

  it("should throw, naming the provider prop, when the provider was given none", () => {
    const { wrapper } = createWrapper();
    // React logs the error a throwing render raises, and that noise hides a real failure.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useFunctionsUrl(), { wrapper })).toThrow(/functionsUrl/);
  });
});
