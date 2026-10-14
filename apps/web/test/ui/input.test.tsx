import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Lock } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { Input, TextField } from "@/components/ui/input";

function describedText(element: HTMLElement): string {
  const identifiers = element.getAttribute("aria-describedby")?.split(" ") ?? [];
  return identifiers
    .map((identifier) => document.getElementById(identifier)?.textContent)
    .join(" ");
}

function ControlledTextField() {
  const [value, setValue] = useState("");
  return (
    <TextField
      label="Name"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
      }}
    />
  );
}

describe("Input", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a text box named by its aria-label", () => {
    render(<Input aria-label="Barcode number" />);

    expect(screen.getByRole("textbox", { name: "Barcode number" })).toBeTruthy();
  });

  it("should pass the input type through", () => {
    render(<Input aria-label="Search" type="search" />);

    expect(screen.getByRole("searchbox", { name: "Search" })).toBeTruthy();
  });

  it("should be disabled when told", () => {
    render(<Input aria-label="Name" disabled />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("disabled", true);
  });

  describe("focus", () => {
    it("should turn the border accent and draw no ring in dark", () => {
      render(<Input aria-label="Name" />);

      const { classList } = screen.getByRole("textbox", { name: "Name" });

      expect(classList.contains("focus-visible:[&:not([aria-invalid=true])]:border-accent")).toBe(
        true,
      );
      expect(classList.contains("focus-visible:ring-2")).toBe(false);
      expect(classList.contains("focus-visible:ring-offset-2")).toBe(false);
    });

    it("should add the ring in light, because the light accent border is under 3:1", () => {
      render(<Input aria-label="Name" />);

      const { classList } = screen.getByRole("textbox", { name: "Name" });

      expect(classList.contains("light-theme:focus-visible:ring-2")).toBe(true);
      expect(classList.contains("light-theme:focus-visible:ring-offset-2")).toBe(true);
    });

    it("should emit the ring only under the light theme, which includes Match device on a light system", async () => {
      render(<Input aria-label="Name" />);

      const css = await compileUtilities(screen.getByRole("textbox", { name: "Name" }).outerHTML);

      expect(css).toContain(
        '[data-theme="light"] .light-theme\\:focus-visible\\:ring-2:focus-visible',
      );
      expect(css).toContain(
        '[data-theme="device"] .light-theme\\:focus-visible\\:ring-2:focus-visible',
      );
      expect(css).not.toMatch(/^\.focus-visible\\:ring-2:focus-visible/m);
    });
  });

  describe("focus when invalid", () => {
    it("should keep the ring in every theme, because the danger border cannot show focus", () => {
      render(<Input aria-label="Name" aria-invalid />);

      const { classList } = screen.getByRole("textbox", { name: "Name" });

      expect(classList.contains("aria-[invalid=true]:focus-visible:ring-2")).toBe(true);
      expect(classList.contains("aria-[invalid=true]:focus-visible:ring-offset-2")).toBe(true);
    });

    it("should emit the ring for an invalid field that has focus", async () => {
      render(<Input aria-label="Name" aria-invalid />);

      const css = await compileUtilities(screen.getByRole("textbox", { name: "Name" }).outerHTML);

      expect(css).toMatch(
        /\.aria-\\\[invalid\\=true\\\]\\:focus-visible\\:ring-2:focus-visible\[aria-invalid="true"\]/,
      );
    });
  });

  it("should keep the caller's height so a screen can still override it", () => {
    render(<Input aria-label="Name" className="h-11" />);

    const { className } = screen.getByRole("textbox", { name: "Name" });

    expect(className).toContain("h-11");
    expect(className).not.toContain("h-[44px]");
  });
});

describe("TextField", () => {
  afterEach(() => {
    cleanup();
  });

  it("should name the input by its label", () => {
    render(<TextField label="Email" />);

    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
  });

  it("should use the id it is given for the label", () => {
    render(<TextField id="email" label="Email" />);

    expect(screen.getByRole("textbox", { name: "Email" }).id).toBe("email");
  });

  it("should give two fields without ids their own names", () => {
    render(
      <>
        <TextField label="First" />
        <TextField label="Second" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "First" }).id).not.toBe(
      screen.getByRole("textbox", { name: "Second" }).id,
    );
  });

  it("should describe the input with the helper", () => {
    render(<TextField label="Name" helper="As it appears on the pack" />);

    expect(describedText(screen.getByRole("textbox", { name: "Name" }))).toBe(
      "As it appears on the pack",
    );
  });

  it("should not be invalid without an error", () => {
    render(<TextField label="Name" helper="As it appears on the pack" />);

    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBe(
      "false",
    );
  });

  it("should flag the input invalid and announce the error", () => {
    render(<TextField label="Email" error="Enter a valid email address" />);

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address");
    expect(describedText(input)).toBe("Enter a valid email address");
  });

  it("should show the error in place of the helper", () => {
    render(
      <TextField label="Email" helper="We never share it" error="Enter a valid email address" />,
    );

    expect(screen.queryByText("We never share it")).toBeNull();
  });

  it.each(["", "   "])("should treat an error of %j as no error", (error) => {
    render(<TextField label="Email" helper="We never share it" error={error} />);

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(describedText(input)).toBe("We never share it");
  });

  it("should replace the helper element with a new alert when an error appears", () => {
    const { rerender } = render(<TextField label="Email" helper="We never share it" />);
    const helper = screen.getByText("We never share it");

    rerender(<TextField label="Email" helper="We never share it" error="Enter a valid email" />);

    expect(helper.isConnected).toBe(false);
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email");
  });

  it("should pass the other input props through", () => {
    render(<TextField label="Email" type="email" autoComplete="email" disabled />);

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input).toHaveProperty("disabled", true);
  });

  it("should report typing through onChange", () => {
    render(<ControlledTextField />);

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Greek yoghurt" },
    });

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Greek yoghurt");
  });

  describe("invalid without a message", () => {
    it("should flag the input invalid without showing a message or an alert", () => {
      render(<TextField label="Portion 1 label" invalid />);

      expect(
        screen.getByRole("textbox", { name: "Portion 1 label" }).getAttribute("aria-invalid"),
      ).toBe("true");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should still be invalid when it also has an error", () => {
      render(<TextField label="Name" invalid error="Name is required" />);

      expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });
  });

  describe("described by", () => {
    it("should describe the input with the element it is pointed at", () => {
      render(
        <>
          <TextField label="Portion 1 label" invalid describedBy="portion-note" />
          <span id="portion-note">Portion 1 needs a label</span>
        </>,
      );

      expect(describedText(screen.getByRole("textbox", { name: "Portion 1 label" }))).toBe(
        "Portion 1 needs a label",
      );
    });

    it("should read the hint and the message before the element it is pointed at", () => {
      render(
        <>
          <TextField label="Name" labelHint="Required" helper="On the pack" describedBy="note" />
          <span id="note">Extra</span>
        </>,
      );

      expect(describedText(screen.getByRole("textbox", { name: "Name" }))).toBe(
        "Required On the pack Extra",
      );
    });
  });

  describe("trailing icon", () => {
    it("should draw a decorative icon after the input", () => {
      render(<TextField label="Barcode" trailingIcon={Lock} />);

      const input = screen.getByRole("textbox", { name: "Barcode" });

      expect(input.parentElement?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });

    it("should leave room for the icon and keep the padding the screen asks for", () => {
      render(<TextField label="Barcode" trailingIcon={Lock} className="px-3" />);

      const { className } = screen.getByRole("textbox", { name: "Barcode" });

      expect(className).toContain("px-3");
      expect(className).toContain("pr-9");
    });

    it("should leave the icon out of the field's name", () => {
      render(<TextField label="Barcode" trailingIcon={Lock} />);

      expect(screen.getByRole("textbox", { name: "Barcode" })).toBeTruthy();
    });

    it("should draw no icon unless one is given", () => {
      render(<TextField label="Barcode" />);

      expect(
        screen.getByRole("textbox", { name: "Barcode" }).parentElement?.querySelector("svg"),
      ).toBeNull();
    });
  });

  describe("label hint", () => {
    it("should show the hint beside the label", () => {
      render(<TextField label="Name" labelHint="Required" />);

      expect(screen.getByText("Required")).toBeTruthy();
    });

    it("should leave the hint out of the label's name", () => {
      render(<TextField label="Name" labelHint="Required" />);

      expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    });

    it("should describe the input with the hint", () => {
      render(<TextField label="Name" labelHint="Required" />);

      expect(describedText(screen.getByRole("textbox", { name: "Name" }))).toBe("Required");
    });

    it("should describe the input with the hint and then the helper", () => {
      render(<TextField label="Name" labelHint="Required" helper="As it appears on the pack" />);

      expect(describedText(screen.getByRole("textbox", { name: "Name" }))).toBe(
        "Required As it appears on the pack",
      );
    });

    it("should describe the input with the hint and then the error", () => {
      render(<TextField label="Name" labelHint="Required" error="Name is required" />);

      expect(describedText(screen.getByRole("textbox", { name: "Name" }))).toBe(
        "Required Name is required",
      );
    });

    it.each(["", "   "])("should treat a hint of %j as no hint", (labelHint) => {
      render(<TextField label="Name" labelHint={labelHint} />);

      expect(
        screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-describedby"),
      ).toBeNull();
    });
  });
});
