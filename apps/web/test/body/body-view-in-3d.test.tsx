import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Body3DProps } from "@/components/ui/Body3D";

import { BodyViewIn3D } from "@/components/body/BodyView/BodyViewIn3D";

// A stand-in for the 3D body, which jsdom cannot draw. It writes a line the tests can find whether or not the layer is hidden.
const body3D = vi.hoisted((): { latest: Body3DProps | null } => ({ latest: null }));

vi.mock("@/components/ui/Body3D", () => ({
  Body3D: (props: Body3DProps) => {
    body3D.latest = props;
    return <p>The 3D body</p>;
  },
}));

const label = "Body map, Actual, heat, front.";

// `BodyView` takes this away on a failure, so it is drawn alone here, with a caller that does not.
async function renderIn3D(onFail = vi.fn()) {
  body3D.latest = null;
  render(
    <BodyViewIn3D label={label} scale="heat" side="front" values={{}} w={145} onFail={onFail} />,
  );
  await waitFor(() => {
    expect(body3D.latest).not.toBeNull();
  });
  return onFail;
}

function latestBody3D(): Body3DProps {
  if (body3D.latest === null) {
    throw new Error("The 3D body was not drawn.");
  }
  return body3D.latest;
}

describe("BodyViewIn3D after a failure", () => {
  afterEach(() => {
    cleanup();
  });

  it("should call onFail once and take the 3D body away, so it cannot go on drawing and failing", async () => {
    const onFail = await renderIn3D();
    expect(screen.getByText("The 3D body")).toBeTruthy();

    act(() => {
      latestBody3D().onError?.();
    });

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("The 3D body")).toBeNull();
    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });

  it("should not draw the 3D body again when a late first frame comes after the failure", async () => {
    await renderIn3D();
    const lateFirstFrame = latestBody3D().onFirstFrame;
    act(() => {
      latestBody3D().onError?.();
    });

    act(() => {
      lateFirstFrame?.();
    });

    expect(screen.queryByText("The 3D body")).toBeNull();
    // The 2D figure is still the one a screen reader meets.
    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });
});
