import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { TextArea } from "@/components/ui/TextArea";

function describedText(element: HTMLElement): string {
  const identifiers = element.getAttribute("aria-describedby")?.split(" ") ?? [];
  return identifiers
    .map((identifier) => document.getElementById(identifier)?.textContent)
    .join(" ");
}

function ControlledTextArea() {
  const [value, setValue] = useState("");
  return (
    <TextArea
      label="Step 1 text"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
      }}
    />
  );
}

// jsdom lays nothing out, so the height the content needs is told to it.
function contentNeeds(height: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
}

describe("TextArea", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  });

  describe("name", () => {
    it("should be a text box named by its label", () => {
      render(<TextArea label="Step 3 text" />);

      expect(screen.getByRole("textbox", { name: "Step 3 text" })).toBeTruthy();
    });

    it("should keep the label for a screen reader and off the screen when it is hidden", () => {
      render(<TextArea label="Step 3 text" hideLabel />);

      expect(screen.getByText("Step 3 text").classList.contains("sr-only")).toBe(true);
      expect(screen.getByRole("textbox", { name: "Step 3 text" })).toBeTruthy();
    });

    it("should show its placeholder", () => {
      render(<TextArea label="Step 3 text" placeholder="Describe this step" />);

      expect(screen.getByPlaceholderText("Describe this step")).toBeTruthy();
    });

    it("should hand its element to a ref", () => {
      const ref = createRef<HTMLTextAreaElement>();
      render(<TextArea label="Step 3 text" ref={ref} />);

      expect(ref.current).toBe(screen.getByRole("textbox", { name: "Step 3 text" }));
    });
  });

  describe("growing", () => {
    it("should be at least 96 px high", () => {
      render(<TextArea label="Step 3 text" />);

      expect(screen.getByRole("textbox").classList.contains("min-h-24")).toBe(true);
    });

    it("should take the height its content needs when it is shown", () => {
      contentNeeds(180);

      render(<TextArea label="Step 3 text" defaultValue={"A long step.\n".repeat(8)} />);

      expect(screen.getByRole("textbox").style.height).toBe("180px");
    });

    it("should grow as text is typed and shrink as it is deleted", () => {
      render(<ControlledTextArea />);
      const field = screen.getByRole("textbox", { name: "Step 1 text" });

      contentNeeds(240);
      fireEvent.change(field, { target: { value: "A long step.\n".repeat(12) } });
      expect(field.style.height).toBe("240px");

      contentNeeds(96);
      fireEvent.change(field, { target: { value: "Short." } });
      expect(field.style.height).toBe("96px");
    });

    it("should grow when the text is typed into a field that holds its own value", () => {
      render(<TextArea label="Step 3 text" />);
      const field = screen.getByRole("textbox");

      contentNeeds(150);
      fireEvent.input(field, { target: { value: "A long step.\n".repeat(6) } });

      expect(field.style.height).toBe("150px");
    });
  });

  describe("counter", () => {
    it("should show the counter and describe the field with it", () => {
      render(<TextArea label="Step 3 text" counter="201 / 1,000" />);

      expect(screen.getByText("201 / 1,000")).toBeTruthy();
      expect(describedText(screen.getByRole("textbox"))).toContain("201 / 1,000");
    });

    it("should draw no counter when it is not given one", () => {
      render(<TextArea label="Step 3 text" />);

      expect(screen.getByRole("textbox").hasAttribute("aria-describedby")).toBe(false);
    });

    it("should turn the counter danger past the limit and not before", () => {
      const { rerender } = render(<TextArea label="Step 3 text" counter="201 / 1,000" />);
      expect(screen.getByText("201 / 1,000").classList.contains("text-danger")).toBe(false);

      rerender(<TextArea label="Step 3 text" counter="1,001 / 1,000" isOverLimit />);

      expect(screen.getByText("1,001 / 1,000").classList.contains("text-danger")).toBe(true);
    });

    it("should keep the counter's danger colour out of the light theme, where small text is not coloured", () => {
      render(<TextArea label="Step 3 text" counter="1,001 / 1,000" isOverLimit />);

      expect(
        screen.getByText("1,001 / 1,000").classList.contains("light-theme:text-text-primary"),
      ).toBe(true);
    });
  });

  describe("error", () => {
    it("should announce the error, flag the field invalid and describe it with the error", () => {
      render(<TextArea label="Step 3 text" error="Keep a step to 1,000 characters or fewer." />);
      const field = screen.getByRole("textbox", { name: "Step 3 text" });

      expect(screen.getByRole("alert").textContent).toBe(
        "Keep a step to 1,000 characters or fewer.",
      );
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(describedText(field)).toContain("Keep a step to 1,000 characters or fewer.");
    });

    it("should treat an empty error as no error", () => {
      render(<TextArea label="Step 3 text" error="  " />);

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("false");
    });

    it("should describe the field with both the error and the counter", () => {
      render(<TextArea label="Step 3 text" error="Too long." counter="1,001 / 1,000" />);

      expect(describedText(screen.getByRole("textbox"))).toBe("Too long. 1,001 / 1,000");
    });
  });

  describe("footer", () => {
    it("should show what it is given beside the counter", () => {
      render(
        <TextArea
          label="Step 3 text"
          counter="201 / 1,000"
          footer={<button type="button">Done</button>}
        />,
      );

      expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
      expect(screen.getByText("201 / 1,000")).toBeTruthy();
    });
  });

  describe("disabled", () => {
    it("should be disabled when told", () => {
      render(<TextArea label="Step 3 text" disabled />);

      expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
    });
  });
});
