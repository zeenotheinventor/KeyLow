import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MacroTile } from "@/components/ui/MacroTile";

afterEach(cleanup);

function renderTile(props: Partial<React.ComponentProps<typeof MacroTile>> = {}) {
  return render(
    <dl>
      <MacroTile label="Protein" colour="protein" grams={126} share={null} {...props} />
    </dl>,
  );
}

describe("MacroTile", () => {
  it("should write the amount as one run of text", () => {
    renderTile();

    expect(screen.getByText("126 g")).toBeTruthy();
  });

  it("should put the label above the amount", () => {
    renderTile();

    const label = screen.getByText("Protein");
    const amount = screen.getByText("126 g");
    expect(label.compareDocumentPosition(amount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should draw no share of energy when there is none", () => {
    renderTile();

    expect(screen.queryByText(/of energy/)).toBeNull();
  });

  it("should draw the share as a caption in the detail variant", () => {
    renderTile({ share: 35 });

    expect(screen.getByText(/35/)).toBeTruthy();
  });
});
