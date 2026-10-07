import { describe, expect, it } from "vitest";

import { type BarcodeSymbology, normaliseBarcode } from "../../src/foods/barcode";

/**
 * Independent GTIN check digit used to build fixtures: weights 3 and 1 alternate from the
 * rightmost digit of the body, and the check digit tops the weighted sum up to a multiple of 10.
 */
function checkDigitFor(body: string): string {
  let weightedSum = 0;
  for (let position = 0; position < body.length; position += 1) {
    const digit = Number(body[body.length - 1 - position]);
    weightedSum += digit * (position % 2 === 0 ? 3 : 1);
  }
  return String((10 - (weightedSum % 10)) % 10);
}

function withCheckDigit(body: string): string {
  return body + checkDigitFor(body);
}

function withWrongCheckDigit(body: string): string {
  return body + String((Number(checkDigitFor(body)) + 1) % 10);
}

const allSymbologies: readonly BarcodeSymbology[] = ["ean13", "ean8", "upc_a", "upc_e"];

// Published examples: EAN-13 4006381333931, UPC-A 036000291452, EAN-8 96385074.
const ean13 = "4006381333931";
const upcA = "036000291452";
const ean8 = "96385074";

// UPC-E body (number system plus six digits) and its UPC-A expansion body, one row per last digit rule.
// A UPC-E code carries the check digit of its UPC-A expansion, which is why it is built from upcABody.
const upcEExpansions = [
  { name: "last digit 0", upcEBody: "0123450", upcABody: "01200000345" },
  { name: "last digit 1", upcEBody: "0123451", upcABody: "01210000345" },
  { name: "last digit 2", upcEBody: "0123452", upcABody: "01220000345" },
  { name: "last digit 3", upcEBody: "0123453", upcABody: "01230000045" },
  { name: "last digit 4", upcEBody: "0123454", upcABody: "01234000005" },
  { name: "last digit 5", upcEBody: "0123455", upcABody: "01234500005" },
  { name: "last digit 6", upcEBody: "0123456", upcABody: "01234500006" },
  { name: "last digit 7", upcEBody: "0123457", upcABody: "01234500007" },
  { name: "last digit 8", upcEBody: "0123458", upcABody: "01234500008" },
  { name: "last digit 9", upcEBody: "0123459", upcABody: "01234500009" },
  { name: "number system 1", upcEBody: "1234563", upcABody: "12340000056" },
].map(({ name, upcEBody, upcABody }) => ({
  name,
  upcE: upcEBody + checkDigitFor(upcABody),
  expectedCode: `0${withCheckDigit(upcABody)}`,
  // The same eight digits read as a GTIN-8 use the check digit of the seven-digit body.
  isAlsoValidEan8: checkDigitFor(upcEBody) === checkDigitFor(upcABody),
}));

const upcEOnly = upcEExpansions.filter(({ isAlsoValidEan8 }) => !isAlsoValidEan8);

// A single UPC-E that is certainly not a valid EAN-8 (EAN-8 check digit 3, UPC-A check digit 5).
const upcEOnlyBody = "0123450";
const upcEOnlyExpansionBody = "01200000345";
const upcEOnlyCode = upcEOnlyBody + checkDigitFor(upcEOnlyExpansionBody);
const upcEOnlyExpectedCode = `0${withCheckDigit(upcEOnlyExpansionBody)}`;

describe("check digit fixtures", () => {
  it.each([
    ["03600029145", "2"],
    ["400638133393", "1"],
    ["9638507", "4"],
  ])("should compute the published check digit for %s", (body, expected) => {
    expect(checkDigitFor(body)).toBe(expected);
  });
});

describe("normaliseBarcode", () => {
  describe("13 digits (EAN-13)", () => {
    it("should keep a valid EAN-13", () => {
      expect(normaliseBarcode(ean13)).toEqual({ ok: true, code: ean13 });
    });

    it("should reject an EAN-13 with a wrong check digit", () => {
      expect(normaliseBarcode(withWrongCheckDigit(ean13.slice(0, 12)))).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });
  });

  describe("12 digits (UPC-A)", () => {
    it("should validate a UPC-A and zero-pad it to 13 digits", () => {
      expect(normaliseBarcode(upcA)).toEqual({ ok: true, code: `0${upcA}` });
    });

    it("should reject a UPC-A with a wrong check digit", () => {
      expect(normaliseBarcode(withWrongCheckDigit(upcA.slice(0, 11)))).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });
  });

  describe("14 digits (GTIN-14)", () => {
    it("should strip indicator digit 0 to the 13-digit EAN after validating", () => {
      expect(normaliseBarcode(`0${ean13}`)).toEqual({ ok: true, code: ean13 });
    });

    it("should keep indicator digit 1 at 14 digits", () => {
      const gtin14 = withCheckDigit("1400638133393");
      expect(normaliseBarcode(gtin14)).toEqual({ ok: true, code: gtin14 });
    });

    it("should keep indicator digit 9 at 14 digits", () => {
      const gtin14 = withCheckDigit("9400638133393");
      expect(normaliseBarcode(gtin14)).toEqual({ ok: true, code: gtin14 });
    });

    it("should reject indicator digit 0 with a wrong check digit", () => {
      expect(normaliseBarcode(withWrongCheckDigit(`0${ean13.slice(0, 12)}`))).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });

    it("should reject indicator digit 1 with a wrong check digit", () => {
      expect(normaliseBarcode(withWrongCheckDigit("1400638133393"))).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });
  });

  describe("8 digits without a hint", () => {
    it("should keep a valid EAN-8 at 8 digits", () => {
      expect(normaliseBarcode(ean8)).toEqual({ ok: true, code: ean8 });
    });

    it("should prefer EAN-8 when the code is also a valid UPC-E", () => {
      // 01234565 validates as a GTIN-8 and as UPC-E 012345 6 (expanding to 012345000065).
      expect(normaliseBarcode("01234565")).toEqual({ ok: true, code: "01234565" });
    });

    it.each(upcEOnly)(
      "should read a UPC-E that is not a valid EAN-8 as UPC-E ($name)",
      ({ upcE, expectedCode }) => {
        expect(normaliseBarcode(upcE)).toEqual({ ok: true, code: expectedCode });
      },
    );

    it("should have fixtures that are not valid EAN-8 codes", () => {
      expect(upcEOnly.length).toBeGreaterThan(0);
      expect(checkDigitFor(upcEOnlyBody)).not.toBe(upcEOnlyCode.slice(7));
    });

    it("should reject a code starting with 0 that is neither a valid EAN-8 nor a valid UPC-E", () => {
      expect(normaliseBarcode(withWrongCheckDigit("0123454"))).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });

    it("should reject a code starting with 2 to 9 that is not a valid EAN-8", () => {
      expect(normaliseBarcode(withWrongCheckDigit("9638507"))).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });
  });

  describe("8 digits with a hint", () => {
    it("should keep a valid EAN-8 at 8 digits when the hint is ean8", () => {
      expect(normaliseBarcode(ean8, "ean8")).toEqual({ ok: true, code: ean8 });
    });

    it("should reject a UPC-E when the hint is ean8, with no fallback to UPC-E", () => {
      expect(normaliseBarcode(upcEOnlyCode, "ean8")).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });

    it.each(upcEExpansions)(
      "should expand a UPC-E to a 13-digit UPC-A when the hint is upc_e ($name)",
      ({ upcE, expectedCode }) => {
        expect(normaliseBarcode(upcE, "upc_e")).toEqual({ ok: true, code: expectedCode });
      },
    );

    it("should read an ambiguous code as UPC-E rather than EAN-8 when the hint is upc_e", () => {
      expect(normaliseBarcode("01234565", "upc_e")).toEqual({ ok: true, code: "0012345000065" });
    });

    it("should expand the published UPC-E 04252614 when the hint is upc_e", () => {
      expect(normaliseBarcode("04252614", "upc_e")).toEqual({ ok: true, code: "0042100005264" });
    });

    it("should expand 04252614 with no hint too, because it is not a valid EAN-8", () => {
      expect(normaliseBarcode("04252614")).toEqual({ ok: true, code: "0042100005264" });
    });

    it("should pin the trap that a UPC-E ending in 5 to 9 reads as EAN-8 without a hint", () => {
      // 04252658 is a valid GTIN-8 and UPC-E 042526 5 (expanding to 042526000058), so the hint decides.
      expect(normaliseBarcode("04252658")).toEqual({ ok: true, code: "04252658" });
      expect(normaliseBarcode("04252658", "upc_e")).toEqual({ ok: true, code: "0042526000058" });
    });

    it("should reject a valid EAN-8 whose first digit is not 0 or 1 when the hint is upc_e", () => {
      expect(normaliseBarcode(ean8, "upc_e")).toEqual({ ok: false, reason: "not_upc_e" });
    });

    it("should reject a valid EAN-8 whose UPC-E expansion has a wrong check digit when the hint is upc_e", () => {
      // 01234503 is a valid GTIN-8, but read as UPC-E it expands to a UPC-A whose check digit is 5.
      expect(normaliseBarcode("01234503", "upc_e")).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });

    it.each(["ean13", "upc_a"] as const)(
      "should read the code as if there were no hint when the hint is %s",
      (hint) => {
        expect(normaliseBarcode(ean8, hint)).toEqual({ ok: true, code: ean8 });
        expect(normaliseBarcode(upcEOnlyCode, hint)).toEqual({
          ok: true,
          code: upcEOnlyExpectedCode,
        });
      },
    );
  });

  describe.each(allSymbologies)("a %s hint at other lengths", (hint) => {
    it("should ignore the hint for a valid 13-digit code", () => {
      expect(normaliseBarcode(ean13, hint)).toEqual({ ok: true, code: ean13 });
    });

    it("should ignore the hint for a valid 12-digit code", () => {
      expect(normaliseBarcode(upcA, hint)).toEqual({ ok: true, code: `0${upcA}` });
    });

    it("should ignore the hint for a valid 14-digit code with indicator 0", () => {
      expect(normaliseBarcode(`0${ean13}`, hint)).toEqual({ ok: true, code: ean13 });
    });

    it("should ignore the hint for a valid 14-digit code with indicator 1", () => {
      const gtin14 = withCheckDigit("1400638133393");
      expect(normaliseBarcode(gtin14, hint)).toEqual({ ok: true, code: gtin14 });
    });

    it("should still reject a 13-digit code with a wrong check digit", () => {
      expect(normaliseBarcode(withWrongCheckDigit(ean13.slice(0, 12)), hint)).toEqual({
        ok: false,
        reason: "bad_check_digit",
      });
    });
  });

  describe("input cleaning", () => {
    it("should strip spaces", () => {
      expect(normaliseBarcode("4006 3813 3393 1")).toEqual({ ok: true, code: ean13 });
    });

    it("should strip hyphens", () => {
      expect(normaliseBarcode("4006-3813-3393-1")).toEqual({ ok: true, code: ean13 });
    });

    it("should strip leading and trailing whitespace", () => {
      expect(normaliseBarcode(`  ${ean13}\n`)).toEqual({ ok: true, code: ean13 });
    });

    it("should strip spaces and hyphens before counting digits for a UPC-A", () => {
      expect(normaliseBarcode("0 36000-29145 2")).toEqual({ ok: true, code: `0${upcA}` });
    });
  });

  describe("invalid input", () => {
    it.each(["4006381333abc", "ABCDEFGH", "4006381333.31", "٤٠٠٦٣٨١٣٣٣٩٣١"])(
      "should reject %s as not digits",
      (raw) => {
        expect(normaliseBarcode(raw)).toEqual({ ok: false, reason: "not_digits" });
      },
    );

    it.each(["", "1234567", "123456789", "1234567890", "12345678901", "123456789012345"])(
      "should reject %j as the wrong length",
      (raw) => {
        expect(normaliseBarcode(raw)).toEqual({ ok: false, reason: "bad_length" });
      },
    );

    it("should report not_digits ahead of bad_length", () => {
      expect(normaliseBarcode("12a")).toEqual({ ok: false, reason: "not_digits" });
    });
  });
});
