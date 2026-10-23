import { readIngredientRequestId, withIngredientRequest } from "../lib/navigation";

describe("readIngredientRequestId", () => {
  it("should read the id from the parameter", () => {
    expect(readIngredientRequestId("scan-1")).toBe("scan-1");
  });

  it("should read the first when the parameter is repeated", () => {
    expect(readIngredientRequestId(["scan-1", "scan-2"])).toBe("scan-1");
  });

  it.each([[undefined], [""], [[]]])("should read %p as no request", (param) => {
    expect(readIngredientRequestId(param)).toBeUndefined();
  });
});

describe("withIngredientRequest", () => {
  it("should add the id to a path", () => {
    expect(withIngredientRequest("/foods/scan", "scan-1")).toBe("/foods/scan?ingredient=scan-1");
  });

  it("should put extra parameters first, then the id", () => {
    expect(withIngredientRequest("/foods/new", "scan-1", { barcode: "5449000000996" })).toBe(
      "/foods/new?barcode=5449000000996&ingredient=scan-1",
    );
  });

  it("should encode the id", () => {
    expect(withIngredientRequest("/foods/scan", "a b&c")).toBe("/foods/scan?ingredient=a%20b%26c");
  });
});
