import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchField, SearchLauncher } from "@/components/ui/SearchField";

function ControlledSearchField() {
  const [value, setValue] = useState("");
  return (
    <SearchField
      label="Search foods"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
      }}
    />
  );
}

describe("SearchField", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a search landmark holding a search box named by its label", () => {
    render(<SearchField label="Search foods" />);

    expect(screen.getByRole("search")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
  });

  it("should show the placeholder", () => {
    render(<SearchField label="Search foods" placeholder="Name or brand" />);

    expect(screen.getByPlaceholderText("Name or brand")).toBeTruthy();
  });

  it("should report typing through onChange", () => {
    render(<ControlledSearchField />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
      target: { value: "yoghurt" },
    });

    expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProperty(
      "value",
      "yoghurt",
    );
  });

  it("should be disabled when told", () => {
    render(<SearchField label="Search foods" disabled />);

    expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("should have no barcode button unless given one", () => {
    render(<SearchField label="Search foods" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  describe("barcode button", () => {
    it("should be named and call its handler", () => {
      const onClick = vi.fn();
      render(
        <SearchField
          label="Search foods"
          barcodeButton={{ label: "Look up a barcode", onClick }}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(onClick).toHaveBeenCalledOnce();
    });

    it("should show a keyboard focus indicator of its own", () => {
      render(
        <SearchField
          label="Search foods"
          barcodeButton={{ label: "Look up a barcode", onClick: vi.fn() }}
        />,
      );

      const { classList } = screen.getByRole("button", { name: "Look up a barcode" });

      expect(classList.contains("focus-visible:ring-2")).toBe(true);
      expect(classList.contains("focus-visible:ring-focus-ring")).toBe(true);
      expect(classList.contains("focus-visible:bg-hover-overlay")).toBe(true);
    });

    it.each([true, false])("should report expanded as %s", (expanded) => {
      render(
        <SearchField
          label="Search foods"
          barcodeButton={{ label: "Look up a barcode", expanded, onClick: vi.fn() }}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Look up a barcode" }).getAttribute("aria-expanded"),
      ).toBe(String(expanded));
    });

    it("should not report expanded when the panel is not a toggle", () => {
      render(
        <SearchField
          label="Search foods"
          barcodeButton={{ label: "Look up a barcode", onClick: vi.fn() }}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Look up a barcode" }).hasAttribute("aria-expanded"),
      ).toBe(false);
    });
  });

  describe("focus", () => {
    it("should turn the frame border accent and draw no ring in dark", () => {
      render(<SearchField label="Search foods" />);

      const { classList } = screen.getByRole("search");

      expect(classList.contains("has-[:focus-visible]:border-accent")).toBe(true);
      expect(classList.contains("has-[:focus-visible]:ring-2")).toBe(false);
      expect(classList.contains("has-[:focus-visible]:ring-offset-2")).toBe(false);
    });

    it("should add the ring to the frame in light", () => {
      render(<SearchField label="Search foods" />);

      const { classList } = screen.getByRole("search");

      expect(classList.contains("light-theme:has-[:focus-visible]:ring-2")).toBe(true);
      expect(classList.contains("light-theme:has-[:focus-visible]:ring-offset-2")).toBe(true);
    });
  });

  describe("size", () => {
    it("should be 44 high by default", () => {
      render(<SearchField label="Search foods" />);

      expect(screen.getByRole("search").className).toContain("h-control-md");
    });

    it("should be 36 high when small", () => {
      render(<SearchField label="Search foods" size="sm" />);

      expect(screen.getByRole("search").className).toContain("h-control-sm");
    });
  });
});

describe("SearchLauncher", () => {
  afterEach(() => {
    cleanup();
  });

  it("should open the search from a button named by its label", () => {
    const onSearch = vi.fn();
    render(<SearchLauncher label="Search for a food" onSearch={onSearch} />);

    fireEvent.click(screen.getByRole("button", { name: "Search for a food" }));

    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("should not hold a search box, because it only launches the search", () => {
    render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} />);

    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("should open the barcode lookup from its own button", () => {
    const onClick = vi.fn();
    render(
      <SearchLauncher
        label="Search for a food"
        onSearch={vi.fn()}
        barcodeButton={{ label: "Look up a barcode", onClick }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  describe("disabled", () => {
    const barcodeButton = { label: "Look up a barcode", onClick: vi.fn() };

    it("should be dimmed to half, which reads the same in both themes", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} disabled />);

      const frame = screen.getByRole("button", { name: "Search for a food" }).parentElement;

      expect(frame?.classList.contains("opacity-50")).toBe(true);
    });

    it("should say it is disabled to assistive technology and stay in the tab order", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} disabled />);

      const launcher = screen.getByRole("button", { name: "Search for a food" });

      expect(launcher.getAttribute("aria-disabled")).toBe("true");
      expect(launcher.hasAttribute("disabled")).toBe(false);
    });

    it("should not open the search when pressed", () => {
      const onSearch = vi.fn();
      render(<SearchLauncher label="Search for a food" onSearch={onSearch} disabled />);

      fireEvent.click(screen.getByRole("button", { name: "Search for a food" }));

      expect(onSearch).not.toHaveBeenCalled();
    });

    it("should not open the barcode lookup either, and say so", () => {
      barcodeButton.onClick.mockClear();
      render(
        <SearchLauncher
          label="Search for a food"
          onSearch={vi.fn()}
          barcodeButton={barcodeButton}
          disabled
        />,
      );

      const barcode = screen.getByRole("button", { name: "Look up a barcode" });
      fireEvent.click(barcode);

      expect(barcode.getAttribute("aria-disabled")).toBe("true");
      expect(barcodeButton.onClick).not.toHaveBeenCalled();
    });

    it("should show no hover or press overlay on a disabled barcode button", () => {
      render(
        <SearchLauncher
          label="Search for a food"
          onSearch={vi.fn()}
          barcodeButton={barcodeButton}
          disabled
        />,
      );

      const { classList } = screen.getByRole("button", { name: "Look up a barcode" });

      expect(classList.contains("hover:bg-transparent")).toBe(true);
      expect(classList.contains("hover:bg-hover-overlay")).toBe(false);
      expect(classList.contains("active:bg-press-overlay")).toBe(false);
    });

    it("should be full strength and enabled by default", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} />);

      const launcher = screen.getByRole("button", { name: "Search for a food" });

      expect(launcher.hasAttribute("aria-disabled")).toBe(false);
      expect(launcher.parentElement?.classList.contains("opacity-50")).toBe(false);
    });
  });

  describe("focus", () => {
    it("should keep the accent border and the ring in every theme, as the shell board draws it", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} />);

      const frame = screen.getByRole("button", { name: "Search for a food" }).parentElement;

      expect(frame?.classList.contains("has-[:focus-visible]:border-accent")).toBe(true);
      expect(frame?.classList.contains("has-[:focus-visible]:ring-2")).toBe(true);
      expect(frame?.classList.contains("has-[:focus-visible]:ring-offset-2")).toBe(true);
      expect(frame?.classList.contains("light-theme:has-[:focus-visible]:ring-2")).toBe(false);
    });
  });

  describe("size", () => {
    it("should be 44 high by default", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: "Search for a food" }).parentElement?.className,
      ).toContain("h-control-md");
    });

    it("should be 36 high when small", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} size="sm" />);

      expect(
        screen.getByRole("button", { name: "Search for a food" }).parentElement?.className,
      ).toContain("h-control-sm");
    });

    it("should be 44 high and drop to 36 from the large breakpoint when adaptive", () => {
      render(<SearchLauncher label="Search for a food" onSearch={vi.fn()} size="adaptive" />);

      const frameClasses = screen.getByRole("button", { name: "Search for a food" }).parentElement
        ?.className;

      expect(frameClasses).toContain("h-control-md");
      expect(frameClasses).toContain("lg:h-control-sm");
    });
  });
});

describe("SearchField clear control", () => {
  afterEach(() => {
    cleanup();
  });

  it("should have no clear control unless a screen gives one", () => {
    render(<SearchField label="Search recipes" value="chi" onChange={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("should not show the clear control while the field is empty", () => {
    render(
      <SearchField
        label="Search recipes"
        value=""
        onChange={() => undefined}
        clear={{ label: "Clear search", onClick: () => undefined }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("should show the clear control once the field holds text, and call it when pressed", () => {
    const onClick = vi.fn();
    render(
      <SearchField
        label="Search recipes"
        value="chi"
        onChange={() => undefined}
        clear={{ label: "Clear search", onClick }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should disable the clear control with the field, so a disabled field cannot be emptied", () => {
    render(
      <SearchField
        label="Search recipes"
        value="chi"
        disabled
        onChange={() => undefined}
        clear={{ label: "Clear search", onClick: () => undefined }}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear search" })).toHaveProperty("disabled", true);
  });
});
