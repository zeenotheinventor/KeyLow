import { normaliseBarcode } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { drainGeneratedBarcodes, generateBarcode } from "./barcodes";

describe("generateBarcode", () => {
  it("produces an EAN-13 that core accepts unchanged", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = generateBarcode();

      expect(code).toMatch(/^\d{13}$/);
      expect(normaliseBarcode(code)).toEqual({ ok: true, code });
    }
  });

  it("starts with the GS1 prefix reserved for in-store use, so it is never a real product", () => {
    expect(generateBarcode().startsWith("2")).toBe(true);
  });

  it("does not repeat a code", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateBarcode()));

    expect(codes.size).toBe(200);
  });
});

describe("drainGeneratedBarcodes", () => {
  it("returns every code generated since the last drain, then forgets them", () => {
    drainGeneratedBarcodes();
    const first = generateBarcode();
    const second = generateBarcode();

    expect(drainGeneratedBarcodes()).toEqual([first, second]);
    expect(drainGeneratedBarcodes()).toEqual([]);
  });
});
