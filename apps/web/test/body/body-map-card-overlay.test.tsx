import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "../ui/compileUtilities";

import { BodyMapCard } from "@/components/body/BodyMapCard";

describe("BodyMapCard overlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("should keep the overlay in a stacking context of its own, so it cannot paint over a sticky bar", async () => {
    render(
      <BodyMapCard
        scale="volume"
        view="actual"
        viewLabel="Actual"
        subLine="Now"
        actualValues={{}}
        projectedValues={{}}
        toggleLabel={null}
        isToggleEnabled={false}
        onToggle={() => undefined}
        note={null}
        onLongPressMuscle={() => undefined}
        overlay={<p>First open hint</p>}
      />,
    );
    const host = screen.getByText("First open hint").parentElement?.parentElement;
    const css = await compileUtilities(host?.getAttribute("class") ?? "");

    expect(css).toContain("isolation: isolate");
  });
});
