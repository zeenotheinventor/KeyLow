import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

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
});
