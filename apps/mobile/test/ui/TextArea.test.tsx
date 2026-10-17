import { fireEvent, render, screen } from "@testing-library/react-native";

import { TextArea } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { TextAreaProps } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderTextArea(props: Partial<TextAreaProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <TextArea
        label="Step 3 text"
        placeholder="Describe this step"
        value=""
        onChangeText={() => undefined}
        {...props}
      />
    </ThemeProvider>,
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("TextArea", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the field", () => {
    it("should be a multi-line field named by its label", async () => {
      await renderTextArea();

      expect(screen.getByLabelText("Step 3 text")).toHaveProp("multiline", true);
    });

    it("should draw no visible label, since the sheet's title is the label the board shows", async () => {
      await renderTextArea();

      expect(screen.queryByText("Step 3 text")).not.toBeOnTheScreen();
    });

    it("should show its placeholder while it is empty", async () => {
      await renderTextArea();

      expect(screen.getByPlaceholderText("Describe this step")).toBeOnTheScreen();
    });

    it("should show what it holds", async () => {
      await renderTextArea({ value: "Stir in the rice." });

      expect(screen.getByDisplayValue("Stir in the rice.")).toBeOnTheScreen();
    });

    it("should hand on what is typed", async () => {
      const onChangeText = jest.fn();
      await renderTextArea({ onChangeText });

      await fireEvent.changeText(screen.getByLabelText("Step 3 text"), "Stir in the rice.");

      expect(onChangeText).toHaveBeenCalledWith("Stir in the rice.");
    });

    it("should hand on the field losing focus", async () => {
      const onBlur = jest.fn();
      await renderTextArea({ onBlur });

      await fireEvent(screen.getByLabelText("Step 3 text"), "blur");

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("should start at the top of its box and grow with the text, to six lines and no more", async () => {
      await renderTextArea();

      const field = screen.getByLabelText("Step 3 text");
      expect(field).toHaveProp("textAlignVertical", "top");
      expect(field).toHaveStyle({ maxHeight: 144 });
    });

    it("should grow no more than 1.5 times at large text, so the text stays inside the box", async () => {
      await renderTextArea();

      expect(screen.getByLabelText("Step 3 text")).toHaveProp("maxFontSizeMultiplier", 1.5);
    });

    it("should stop taking typing while disabled", async () => {
      await renderTextArea({ disabled: true });

      expect(screen.getByLabelText("Step 3 text")).toHaveProp("editable", false);
    });
  });

  describe("the counter", () => {
    it("should show the count under the field", async () => {
      await renderTextArea({ counter: "201 / 1,000" });

      expect(screen.getByText("201 / 1,000")).toBeOnTheScreen();
    });

    it("should draw nothing without one", async () => {
      await renderTextArea();

      expect(screen.queryByText(/\//)).not.toBeOnTheScreen();
    });
  });

  describe("the error", () => {
    it("should show the sentence as an alert and describe the field by it", async () => {
      await renderTextArea({ error: "Keep a step to 1,000 characters or fewer." });

      expect(
        screen.getByRole("alert", { name: "Keep a step to 1,000 characters or fewer." }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Step 3 text")).toHaveProp(
        "accessibilityHint",
        "Keep a step to 1,000 characters or fewer.",
      );
    });

    it("should treat an empty error as no error", async () => {
      await renderTextArea({ error: "" });

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should show the counter beside the sentence", async () => {
      await renderTextArea({ error: "Too long.", counter: "1,001 / 1,000", isOverLimit: true });

      expect(screen.getByRole("alert", { name: "Too long." })).toBeOnTheScreen();
      expect(screen.getByText("1,001 / 1,000")).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: ColorName) => resolvedColor(scheme, name);
    const boxOf = (style: Record<string, unknown>) => viewsDrawn({ minHeight: 96, ...style });

    it("should be a 96 point box on the raised surface with a hairline border, rounded medium, padded 12 across and 10 down", async () => {
      await renderTextArea({}, scheme);
      await screen.findByLabelText("Step 3 text");

      const [box] = boxOf({
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        borderWidth: 1,
        borderRadius: 12,
      });
      expect(box).toHaveStyle({
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
      });
    });

    it("should turn its border to the accent while it has focus, and back when it loses it", async () => {
      await renderTextArea({}, scheme);
      const field = await screen.findByLabelText("Step 3 text");

      await fireEvent(field, "focus");
      expect(boxOf({ borderColor: colorOf("accent") })).toHaveLength(1);

      await fireEvent(field, "blur");
      expect(boxOf({ borderColor: colorOf("accent") })).toHaveLength(0);
    });

    it("should turn its border to danger when it has an error", async () => {
      await renderTextArea({ error: "Too long." }, scheme);
      await screen.findByLabelText("Step 3 text");

      expect(boxOf({ borderColor: colorOf("danger") })).toHaveLength(1);
    });

    it("should write the counter muted, and in danger once it is over", async () => {
      await renderTextArea({ counter: "201 / 1,000" }, scheme);
      expect(await screen.findByText("201 / 1,000")).toHaveStyle({
        color: colorOf("text-muted"),
      });
      await screen.unmount();

      await renderTextArea({ counter: "1,001 / 1,000", isOverLimit: true }, scheme);
      expect(await screen.findByText("1,001 / 1,000")).toHaveStyle({
        color: colorOf("danger"),
      });
    });
  });
});
