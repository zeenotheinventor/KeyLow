import { themes } from "@keylow/tokens";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { FieldError, Input } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { InputProps } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderInput(props: Partial<InputProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Input
        label="Name"
        placeholder="e.g. Greek yoghurt"
        value=""
        onChangeText={() => undefined}
        {...props}
      />
    </ThemeProvider>,
  );
}

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Input", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("-mt-2");
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the field", () => {
    it("should show its label above the field and name the field by it", async () => {
      await renderInput();

      expect(screen.getByText("Name")).toBeOnTheScreen();
      expect(screen.getByLabelText("Name")).toBeOnTheScreen();
    });

    it("should show its placeholder while it is empty", async () => {
      await renderInput();

      expect(screen.getByPlaceholderText("e.g. Greek yoghurt")).toBeOnTheScreen();
    });

    it("should show what it holds", async () => {
      await renderInput({ value: "Greek yoghurt" });

      expect(screen.getByDisplayValue("Greek yoghurt")).toBeOnTheScreen();
    });

    it("should hand on what is typed", async () => {
      const onChangeText = jest.fn();
      await renderInput({ onChangeText });

      await fireEvent.changeText(screen.getByLabelText("Name"), "Oat milk");

      expect(onChangeText).toHaveBeenCalledWith("Oat milk");
    });

    it("should hand on the field losing focus, for a form that checks a field once it is left", async () => {
      const onBlur = jest.fn();
      await renderInput({ onBlur });

      await fireEvent(screen.getByLabelText("Name"), "blur");

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("should hand the keyboard's settings to the field, as the sign in form needs", async () => {
      await renderInput({
        label: "Password",
        secureTextEntry: true,
        autoCapitalize: "none",
        autoComplete: "current-password",
        keyboardType: "email-address",
        returnKeyType: "done",
      });

      expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", true);
      expect(screen.getByLabelText("Password")).toHaveProp("autoCapitalize", "none");
      expect(screen.getByLabelText("Password")).toHaveProp("autoComplete", "current-password");
      expect(screen.getByLabelText("Password")).toHaveProp("keyboardType", "email-address");
      expect(screen.getByLabelText("Password")).toHaveProp("returnKeyType", "done");
    });

    it("should hand on a submit from the keyboard", async () => {
      const onSubmitEditing = jest.fn();
      await renderInput({ onSubmitEditing });

      await fireEvent(screen.getByLabelText("Name"), "submitEditing");

      expect(onSubmitEditing).toHaveBeenCalledTimes(1);
    });

    it("should grow no more than 1.5 times at large text, so the text stays inside the box", async () => {
      await renderInput();

      expect(screen.getByLabelText("Name")).toHaveProp("maxFontSizeMultiplier", 1.5);
    });
  });

  describe("an accessible label of its own", () => {
    it("should name the field by it instead of the visible label, when the label alone does not tell it apart", async () => {
      await renderInput({ accessibilityLabel: "Portion 1 label" });

      expect(screen.getByLabelText("Portion 1 label")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
      expect(screen.getByText("Name")).toBeOnTheScreen();
    });

    it("should be named by its visible label when it is not given one", async () => {
      await renderInput();

      expect(screen.getByLabelText("Name")).toBeOnTheScreen();
    });
  });

  describe("the label hint", () => {
    it("should show a short note beside the label, such as Required", async () => {
      await renderInput({ labelHint: "Required" });

      expect(screen.getByText("Required")).toBeOnTheScreen();
    });

    it("should leave an empty hint out", async () => {
      await renderInput({ labelHint: "  " });

      expect(screen.queryByText("  ")).not.toBeOnTheScreen();
    });
  });

  describe("the helper", () => {
    it("should show one sentence under the field and describe the field by it", async () => {
      await renderInput({ helper: "As it appears on the pack" });

      expect(screen.getByText("As it appears on the pack")).toBeOnTheScreen();
      expect(screen.getByLabelText("Name")).toHaveProp(
        "accessibilityHint",
        "As it appears on the pack",
      );
    });

    it("should not be an alert", async () => {
      await renderInput({ helper: "As it appears on the pack" });

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("the error", () => {
    it("should show the error as an alert, which says what to do", async () => {
      await renderInput({ error: "Name is required" });

      expect(screen.getByRole("alert", { name: "Name is required" })).toBeOnTheScreen();
    });

    it("should replace the helper", async () => {
      await renderInput({ helper: "As it appears on the pack", error: "Name is required" });

      expect(screen.queryByText("As it appears on the pack")).not.toBeOnTheScreen();
      expect(screen.getByText("Name is required")).toBeOnTheScreen();
    });

    it("should describe the field by the error, which is how a native field says it is invalid", async () => {
      await renderInput({ helper: "As it appears on the pack", error: "Name is required" });

      expect(screen.getByLabelText("Name")).toHaveProp("accessibilityHint", "Name is required");
    });

    it("should treat an empty error as no error", async () => {
      await renderInput({ helper: "As it appears on the pack", error: "" });

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.getByText("As it appears on the pack")).toBeOnTheScreen();
    });
  });

  describe("an error the screen shows itself", () => {
    it("should draw no message of its own", async () => {
      await renderInput({ error: "Name is required", errorShownElsewhere: true });

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByText("Name is required")).not.toBeOnTheScreen();
    });

    it("should still describe the field by the error, which is how a native field says it is invalid", async () => {
      await renderInput({ error: "Name is required", errorShownElsewhere: true });

      expect(screen.getByLabelText("Name")).toHaveProp("accessibilityHint", "Name is required");
    });

    it("should not bring the helper back in the error's place", async () => {
      await renderInput({
        helper: "As it appears on the pack",
        error: "Name is required",
        errorShownElsewhere: true,
      });

      expect(screen.queryByText("As it appears on the pack")).not.toBeOnTheScreen();
    });

    it("should change nothing while there is no error", async () => {
      await renderInput({ helper: "As it appears on the pack", errorShownElsewhere: true });

      expect(screen.getByText("As it appears on the pack")).toBeOnTheScreen();
      expect(screen.getByLabelText("Name")).toHaveProp(
        "accessibilityHint",
        "As it appears on the pack",
      );
    });
  });

  describe("the missing note", () => {
    it("should show a note that the value is not given, with a warning icon", async () => {
      await renderInput({ missingNote: "Not given by the source" });

      expect(screen.getByText("Not given by the source")).toBeOnTheScreen();
      expect(drawings()).toHaveLength(1);
    });

    it("should be announced with the field, after its helper", async () => {
      await renderInput({
        missingNote: "Not given by the source",
        helper: "As it appears on the pack",
      });

      expect(screen.getByLabelText("Name")).toHaveProp(
        "accessibilityHint",
        "As it appears on the pack. Not given by the source",
      );
    });

    it("should be announced alone when the field has nothing else to say", async () => {
      await renderInput({ missingNote: "Not given by the source" });

      expect(screen.getByLabelText("Name")).toHaveProp(
        "accessibilityHint",
        "Not given by the source",
      );
    });

    it("should give way to an error", async () => {
      await renderInput({ missingNote: "Not given by the source", error: "Name is required" });

      expect(screen.getByLabelText("Name")).toHaveProp("accessibilityHint", "Name is required");
      expect(screen.queryByText("Not given by the source")).not.toBeOnTheScreen();
    });
  });

  describe("disabled", () => {
    it("should set no disabled state when it is not disabled", async () => {
      await renderInput();

      expect(screen.getByLabelText("Name").props["aria-disabled"]).toBeUndefined();
    });

    it("should not take typing, and say it is disabled", async () => {
      await renderInput({ disabled: true });

      expect(screen.getByLabelText("Name")).toHaveProp("editable", false);
      expect(screen.getByLabelText("Name")).toBeDisabled();
    });
  });

  describe("locked", () => {
    // On Android a view's accessibility state is applied after `editable`, and `aria-disabled={false}` turns the
    // input back on, so a field that is not disabled must not carry the prop at all (measured on a device:
    // a locked field took typing).
    it("should set no disabled state of its own, which on Android would make it editable again", async () => {
      await renderInput({ label: "Barcode", locked: true });

      expect(screen.getByLabelText("Barcode").props["aria-disabled"]).toBeUndefined();
    });

    it("should show its value and not take typing", async () => {
      await renderInput({ label: "Barcode", value: "5000159484695", locked: true });

      expect(screen.getByDisplayValue("5000159484695")).toBeOnTheScreen();
      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", false);
    });

    it("should be announced as read only, after what its helper says", async () => {
      await renderInput({
        label: "Barcode",
        locked: true,
        helper: "Kept from the product you are copying",
      });

      expect(screen.getByLabelText("Barcode")).toHaveProp(
        "accessibilityHint",
        "Kept from the product you are copying. Read only",
      );
    });

    it("should be announced as read only alone when it has no helper", async () => {
      await renderInput({ label: "Barcode", locked: true });

      expect(screen.getByLabelText("Barcode")).toHaveProp("accessibilityHint", "Read only");
    });

    it("should be announced as read only after an error too", async () => {
      await renderInput({ label: "Barcode", locked: true, error: "Barcode is not valid" });

      expect(screen.getByLabelText("Barcode")).toHaveProp(
        "accessibilityHint",
        "Barcode is not valid. Read only",
      );
    });

    it("should draw a lock at its end", async () => {
      await renderInput({ locked: true });

      expect(drawings()).toHaveLength(1);
    });

    it("should draw no lock otherwise", async () => {
      await renderInput();

      expect(drawings()).toHaveLength(0);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: ColorName) => resolvedColor(scheme, name);
    const boxOf = (style: Record<string, unknown>) => viewsDrawn({ minHeight: 44, ...style });

    it("should be a 44 point box on the raised surface with a hairline border, rounded medium, padded 16", async () => {
      await renderInput({}, scheme);
      await screen.findByLabelText("Name");

      const [box] = boxOf({
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        borderWidth: 1,
        borderRadius: 12,
      });
      expect(box).toHaveStyle({
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 16,
      });
    });

    it("should be padded 12 across in the compact density the food form boards draw", async () => {
      await renderInput({ density: "compact" }, scheme);
      await screen.findByLabelText("Name");

      expect(boxOf({ paddingLeft: 12, paddingRight: 12 })).toHaveLength(1);
    });

    it("should turn its border to the accent while it has focus, and back when it loses it", async () => {
      await renderInput({}, scheme);
      const field = await screen.findByLabelText("Name");
      expect(boxOf({ borderColor: colorOf("accent") })).toHaveLength(0);

      await fireEvent(field, "focus");
      expect(boxOf({ borderColor: colorOf("accent") })).toHaveLength(1);

      await fireEvent(field, "blur");
      expect(boxOf({ borderColor: colorOf("accent") })).toHaveLength(0);
    });

    it("should turn its border to danger when it has an error, and keep it there while focused", async () => {
      await renderInput({ error: "Name is required" }, scheme);
      const field = await screen.findByLabelText("Name");
      expect(boxOf({ borderColor: colorOf("danger") })).toHaveLength(1);

      await fireEvent(field, "focus");

      expect(boxOf({ borderColor: colorOf("danger") })).toHaveLength(1);
      expect(boxOf({ borderColor: colorOf("accent") })).toHaveLength(0);
    });

    it("should turn its border to danger for an error the screen shows itself", async () => {
      await renderInput({ error: "Name is required", errorShownElsewhere: true }, scheme);
      await screen.findByLabelText("Name");

      expect(boxOf({ borderColor: colorOf("danger") })).toHaveLength(1);
    });

    it("should sit on the surface, not the raised surface, when it is locked", async () => {
      await renderInput({ locked: true }, scheme);
      await screen.findByLabelText("Name");

      expect(
        boxOf({ backgroundColor: colorOf("surface"), borderColor: colorOf("border") }),
      ).toHaveLength(1);
    });

    it("should sit on the surface and drop to half strength when it is disabled", async () => {
      await renderInput({ disabled: true }, scheme);
      await screen.findByLabelText("Name");

      expect(boxOf({ backgroundColor: colorOf("surface") })).toHaveLength(1);
      expect(viewsDrawn({ opacity: 0.5 }).length).toBeGreaterThan(0);
    });

    it("should write in the primary text colour in Geist regular at 16, in a 40 point input", async () => {
      await renderInput({ value: "Oat milk" }, scheme);

      expect(await screen.findByLabelText("Name")).toHaveStyle({
        color: colorOf("text-primary"),
        fontFamily: "Geist-Regular",
        fontSize: 16,
        minHeight: 40,
      });
    });

    it("should draw its placeholder and its lock in the muted text colour", async () => {
      await renderInput({ locked: true }, scheme);

      expect(await screen.findByPlaceholderText("e.g. Greek yoghurt")).toHaveProp(
        "placeholderTextColor",
        themes[scheme]["text-muted"],
      );
      expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-muted"]);
    });

    it("should set the label as a secondary caption", async () => {
      await renderInput({}, scheme);

      expect(await screen.findByText("Name")).toHaveStyle({
        color: colorOf("text-secondary"),
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });

    it("should set the label hint and the helper as muted captions", async () => {
      await renderInput({ labelHint: "Required", helper: "As it appears on the pack" }, scheme);

      expect(await screen.findByText("Required")).toHaveStyle({
        color: colorOf("text-muted"),
        fontSize: 12,
      });
      expect(screen.getByText("As it appears on the pack")).toHaveStyle({
        color: colorOf("text-muted"),
        fontSize: 12,
      });
    });

    it("should set the error as a danger caption, as the boards draw it in both schemes", async () => {
      await renderInput({ error: "Name is required" }, scheme);

      expect(await screen.findByText("Name is required")).toHaveStyle({
        color: colorOf("danger"),
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });

    it("should draw the missing note's icon in warning and write the words in the warning ink", async () => {
      await renderInput({ missingNote: "Not given by the source" }, scheme);

      expect(await screen.findByText("Not given by the source")).toHaveStyle({
        color: scheme === "dark" ? themes.dark.warning : themes.light["text-primary"],
      });
      expect(drawings()[0]).toHaveProp("stroke", themes[scheme].warning);
      expect(drawings()[0]).toHaveProp("width", 14);
    });

    it("should stack its label, field and message 4 points apart", async () => {
      await renderInput({ helper: "As it appears on the pack" }, scheme);
      await screen.findByLabelText("Name");

      expect(viewsDrawn({ rowGap: 4 }).length).toBeGreaterThan(0);
    });
  });

  describe("FieldError", () => {
    function renderFieldError(scheme: ThemeScheme = "dark") {
      return render(
        <ThemeProvider fixedPreference={scheme}>
          <FieldError>Portion 1 needs an amount above 0</FieldError>
        </ThemeProvider>,
      );
    }

    it("should be an alert, and a live region because the alert role alone does not announce on Android", async () => {
      await renderFieldError();

      expect(screen.getByRole("alert", { name: "Portion 1 needs an amount above 0" })).toHaveProp(
        "aria-live",
        "assertive",
      );
    });

    it.each(schemes)(
      "should be the same danger caption a field draws, in the %s scheme",
      async (scheme) => {
        await renderFieldError(scheme);

        expect(await screen.findByText("Portion 1 needs an amount above 0")).toHaveStyle({
          color: resolvedColor(scheme, "danger"),
          fontFamily: "Geist-Medium",
          fontSize: 12,
          lineHeight: 16,
        });
      },
    );

    it("should take layout from its caller", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <FieldError className="-mt-2">Portion 1 needs a label</FieldError>
        </ThemeProvider>,
      );

      expect(await screen.findByText("Portion 1 needs a label")).toHaveStyle({ marginTop: -8 });
    });
  });
});
