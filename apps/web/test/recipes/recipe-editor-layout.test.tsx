import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "../ui/compileUtilities";

import { RecipeEditorLayout } from "@/components/recipes/RecipeEditorLayout";

describe("RecipeEditorLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("should keep its summary column below the session bar from the large width, and at 24 pixels with none", async () => {
    render(
      <RecipeEditorLayout summary={<p>Per serving</p>}>
        <p>Cards</p>
      </RecipeEditorLayout>,
    );
    const column = screen.getByText("Per serving").parentElement?.parentElement;
    const css = await compileUtilities(column?.getAttribute("class") ?? "");

    expect(css).toContain("top: calc(24px + var(--session-bar-offset,0px))");
  });
});
