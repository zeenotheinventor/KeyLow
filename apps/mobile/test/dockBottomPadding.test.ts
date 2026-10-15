import { dockBottomPadding } from "../lib/dockBottomPadding";

// The boards leave 42 below the controls of a form's dock: the 34 of an iPhone's home indicator and 8.
describe("dockBottomPadding", () => {
  it("should leave 42 on a device with no inset, as the boards draw", () => {
    expect(dockBottomPadding(0)).toBe(42);
  });

  it("should leave 42 on a device whose inset is the home indicator's 34", () => {
    expect(dockBottomPadding(34)).toBe(42);
  });

  it("should take a taller navigation bar's own height and the 8 on top", () => {
    expect(dockBottomPadding(48)).toBe(56);
  });
});
