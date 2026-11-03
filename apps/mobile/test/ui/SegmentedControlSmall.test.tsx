import { render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SegmentedControl } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

type MuscleRole = "primary" | "second" | "assist";

const roleOptions = [
  { value: "primary", label: "Primary" },
  { value: "second", label: "Second" },
  { value: "assist", label: "Assist" },
] as const;

function renderRoles(
  { value, size = "sm" }: { value: MuscleRole; size?: "md" | "sm" },
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SegmentedControl
        label="Role for Side delts"
        options={roleOptions}
        size={size}
        value={value}
        onChange={() => undefined}
      />
    </ThemeProvider>,
  );
}

describe("SegmentedControl in the small size", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("what it says", () => {
    it("should reach the 44 point touch target past its 30 point segments", async () => {
      await renderRoles({ value: "primary" });

      for (const segment of screen.getAllByRole("radio")) {
        expect(segment).toHaveProp("hitSlop", { top: 7, bottom: 7 });
      }
    });
  });

  describe("in the dark scheme", () => {
    it("should be a 36 point track, the small control height, with a hairline border padded 2 inside it", async () => {
      await renderRoles({ value: "primary" }, "dark");
      await screen.findByLabelText("Role for Side delts");

      const [track] = viewsDrawn({
        height: 36,
        backgroundColor: resolvedColor("dark", "surface-raised"),
        borderColor: resolvedColor("dark", "border"),
        borderWidth: 1,
        borderRadius: 12,
      });
      expect(track).toHaveStyle({ flexDirection: "row", padding: 2 });
    });

    it("should draw each segment 30 points high, the chosen one filled as the medium size is", async () => {
      await renderRoles({ value: "primary" }, "dark");
      await screen.findByLabelText("Role for Side delts");

      expect(viewsDrawn({ height: 30, borderRadius: 9 })).toHaveLength(3);
      expect(
        viewsDrawn({
          height: 30,
          backgroundColor: resolvedColor("dark", "text-primary"),
          borderRadius: 9,
        }),
      ).toHaveLength(1);
      expect(screen.getByText("Primary")).toHaveStyle({
        color: resolvedColor("dark", "background"),
      });
      expect(screen.getByText("Second")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
      });
    });

    it("should set each label in Geist semibold at 12 over 20 with 4 points either side", async () => {
      await renderRoles({ value: "primary" }, "dark");

      expect(await screen.findByText("Second")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 12,
        lineHeight: 20,
      });
      expect(viewsDrawn({ height: 30 })[0]).toHaveStyle({ paddingLeft: 4, paddingRight: 4 });
    });

    it("should keep the medium size as it was when the size is asked for by name", async () => {
      await renderRoles({ value: "primary", size: "md" }, "dark");
      await screen.findByLabelText("Role for Side delts");

      expect(viewsDrawn({ height: 44, borderRadius: 12, borderWidth: 1 })).toHaveLength(1);
      expect(viewsDrawn({ height: 36, borderRadius: 9 })).toHaveLength(3);
      expect(screen.getByText("Second")).toHaveStyle({ fontSize: 14 });
      expect(screen.getByRole("radio", { name: "Second" })).toHaveProp("hitSlop", {
        top: 4,
        bottom: 4,
      });
    });
  });
});
