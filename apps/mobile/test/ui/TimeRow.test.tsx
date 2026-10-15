import { touchTarget } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";

import { TimeRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { TimeRowProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function renderRow(props: Partial<TimeRowProps> = {}, scheme: ThemeScheme = "dark") {
  const onPress = jest.fn();
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <TimeRow isNow={false} time="12:40" onPress={onPress} {...props} />
    </ThemeProvider>,
  );
  return { onPress };
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("TimeRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("its name", () => {
    it("should be named by core with the time and 'change', such as Time, 12:40, change", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: "Time, 12:40, change" })).toBeOnTheScreen();
    });

    it("should say 'now' in its name before the entry is saved", async () => {
      await renderRow({ isNow: true });

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeOnTheScreen();
    });

    it("should keep the hour of an hour's plus as it is, without 'now'", async () => {
      await renderRow({ time: "12:00" });

      expect(screen.getByRole("button", { name: "Time, 12:00, change" })).toBeOnTheScreen();
    });
  });

  describe("what it shows", () => {
    it("should write Time on the left and the time on the right", async () => {
      await renderRow();

      expect(screen.getByText("Time")).toBeOnTheScreen();
      expect(screen.getByText("12:40")).toBeOnTheScreen();
    });

    it("should write 'Now · 12:40' before the entry is saved", async () => {
      await renderRow({ isNow: true });

      expect(screen.getByText("Now · 12:40")).toBeOnTheScreen();
    });

    it("should write the time in tabular numerals", async () => {
      await renderRow();

      expect(screen.getByText("12:40").props.style).toMatchObject({ fontVariant: "tabular-nums" });
    });

    it("should end in a chevron, which is decoration", async () => {
      await renderRow();
      await screen.findByRole("button");

      expect(screen.root?.queryAll((node) => node.type === "RNSVGSvgView")).toHaveLength(1);
    });
  });

  describe("pressing", () => {
    it("should call onPress when it is pressed", async () => {
      const user = userEvent.setup();
      const { onPress } = await renderRow();

      await user.press(screen.getByRole("button", { name: "Time, 12:40, change" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("its open state", () => {
    it("should say it is expanded while the picker is open", async () => {
      await renderRow({ open: true });

      expect(screen.getByRole("button", { name: /^Time/, expanded: true })).toBeOnTheScreen();
    });

    it("should say it is collapsed while the picker is closed", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: /^Time/, expanded: false })).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should be a raised field at least 44 high, with a hairline border and the medium radius", async () => {
      await renderRow({}, scheme);

      expect(await screen.findByRole("button")).toHaveStyle({
        minHeight: touchTarget,
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        borderRadius: 12,
      });
    });

    it("should turn its border accent while the picker is open", async () => {
      await renderRow({ open: true }, scheme);

      expect(await screen.findByRole("button")).toHaveStyle({
        borderColor: resolvedColor(scheme, "accent"),
        borderWidth: 1,
      });
    });

    it("should pad 16 at the start and 12 at the end, as the board does", async () => {
      await renderRow({}, scheme);

      expect(await screen.findByRole("button")).toHaveStyle({
        paddingLeft: 16,
        paddingRight: 12,
      });
    });
  });
});
