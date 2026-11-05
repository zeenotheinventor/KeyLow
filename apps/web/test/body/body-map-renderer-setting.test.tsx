import { MORE_SCREEN } from "@keylow/core/copy";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BodyMapRendererSetting } from "@/app/(dashboard)/more/BodyMapRendererSetting";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";
import { useBodyMapRenderer } from "@/lib/bodyMapRenderer";
import { resetBodyMapRendererForTests } from "@/lib/bodyMapRenderer/testing";

// The figure is read at once in a browser, so a test says when it is not yet known, as the server's first draw has it.
const figure = vi.hoisted(() => ({ isHeldBack: false }));

vi.mock("@/lib/bodyFigure", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/bodyFigure")>();
  return {
    ...original,
    useBodyFigure: () => {
      const read = original.useBodyFigure();
      return { ...read, isReady: read.isReady && !figure.isHeldBack };
    },
  };
});

const { bodyMap } = MORE_SCREEN.settings;

function Reader() {
  const { renderer } = useBodyMapRenderer();
  return <p role="status">{renderer}</p>;
}

function renderSetting() {
  render(
    <>
      <ul>
        <BodyMapRendererSetting />
      </ul>
      <Reader />
    </>,
  );
}

describe("BodyMapRendererSetting", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBodyMapRendererForTests();
    resetBodyFigureForTests();
    figure.isHeldBack = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("should offer 2D and 3D in a group named Body map", () => {
    renderSetting();

    expect(screen.getByRole("radiogroup", { name: bodyMap.title })).toBeTruthy();
    expect(screen.getByRole("radio", { name: bodyMap.options.twoD })).toBeTruthy();
    expect(screen.getByRole("radio", { name: bodyMap.options.threeD })).toBeTruthy();
  });

  it("should show 2D chosen when nothing is saved", () => {
    renderSetting();

    expect(screen.getByRole("radio", { name: bodyMap.options.twoD })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("should show 3D chosen when it is saved", () => {
    window.localStorage.setItem("bodyMap.renderer", "3d");

    renderSetting();

    expect(screen.getByRole("radio", { name: bodyMap.options.threeD })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("should choose 3D when it is pressed, save it in this browser, and tell every other reader", () => {
    renderSetting();

    fireEvent.click(screen.getByRole("radio", { name: bodyMap.options.threeD }));

    expect(screen.getByRole("radio", { name: bodyMap.options.threeD })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("status").textContent).toBe("3d");
    expect(window.localStorage.getItem("bodyMap.renderer")).toBe("3d");
  });

  describe("with the female figure", () => {
    beforeEach(() => {
      window.localStorage.setItem("bodyMap.figure", "female");
    });

    it("should say that 3D draws the male body for now, under the control", () => {
      renderSetting();

      expect(screen.getByText(bodyMap.femaleNote)).toBeTruthy();
    });

    it("should say nothing until the figure has been read, so a male figure never sees the line flash", () => {
      figure.isHeldBack = true;

      renderSetting();

      expect(screen.queryByText(bodyMap.femaleNote)).toBeNull();
    });

    it("should still show what was chosen, and keep it", () => {
      renderSetting();

      fireEvent.click(screen.getByRole("radio", { name: bodyMap.options.threeD }));

      expect(screen.getByRole("radio", { name: bodyMap.options.threeD })).toHaveProperty(
        "checked",
        true,
      );
      expect(window.localStorage.getItem("bodyMap.renderer")).toBe("3d");
    });
  });

  it("should say nothing about the figure with the male figure, or when none was chosen", () => {
    renderSetting();
    expect(screen.queryByText(bodyMap.femaleNote)).toBeNull();

    cleanup();
    window.localStorage.setItem("bodyMap.figure", "male");
    resetBodyFigureForTests();
    renderSetting();

    expect(screen.queryByText(bodyMap.femaleNote)).toBeNull();
  });
});
