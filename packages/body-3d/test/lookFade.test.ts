import { Color } from "three";
import { describe, expect, it } from "vitest";

import { byMuscle } from "../src/byMuscle";
import { dressBody } from "../src/dressBody";
import { createLookFade } from "../src/lookFade";
import { loadMaleBody } from "./support/maleGlb";

import type { Look, LookEmphasis } from "../src/Look";

const colours = {
  muscle: "tomato",
  otherMuscle: "gold",
  core: "navy",
  clay: "peru",
  skin: "skyblue",
};
const emphasis: LookEmphasis = {
  selected: undefined,
  selectedColor: "white",
  restingColor: "gray",
  dim: 1,
  unselectedOpacity: 1,
};

const looksOf = (color: string, glow = 0) =>
  byMuscle((): Look => ({ color, glowColor: "red", glow }));

async function startedFade(from: string, milliseconds = 220) {
  const { materials } = dressBody(await loadMaleBody(), colours);
  const fade = createLookFade(materials, looksOf(from), emphasis);
  return { materials, fade, milliseconds };
}

const hex = (name: string) => new Color(name).getHexString();

describe("createLookFade", () => {
  it("should show the starting looks at once", async () => {
    const { materials } = await startedFade("blue");

    expect(materials.muscles.abs.color.getHexString()).toBe(hex("blue"));
    expect(materials.neckColour.getHexString()).toBe(hex("blue"));
  });

  it("should need no frame when asked for the looks it already shows", async () => {
    const { fade } = await startedFade("blue");

    expect(fade.moveTo(looksOf("blue"), emphasis, 220)).toBe(false);
  });

  it("should change at once, and need no frame, with a duration of 0", async () => {
    const { materials, fade } = await startedFade("blue");

    const needsFrame = fade.moveTo(looksOf("red"), emphasis, 0);

    expect(needsFrame).toBe(false);
    expect(materials.muscles.abs.color.getHexString()).toBe(hex("red"));
  });

  it("should need a frame when asked for new looks over time, and show nothing new until it is drawn", async () => {
    const { materials, fade } = await startedFade("blue");

    const needsFrame = fade.moveTo(looksOf("red"), emphasis, 220);

    expect(needsFrame).toBe(true);
    expect(materials.muscles.abs.color.getHexString()).toBe(hex("blue"));
  });

  it("should ignore the time the first frame reports, which is the time since the last draw and not the fade's", async () => {
    const { materials, fade } = await startedFade("blue");
    fade.moveTo(looksOf("red"), emphasis, 220);

    const needsFrame = fade.step(60_000);

    expect(needsFrame).toBe(true);
    expect(materials.muscles.abs.color.getHexString()).toBe(hex("blue"));
  });

  it("should be half way, by the curve, half way through", async () => {
    const { materials, fade } = await startedFade("blue");
    fade.moveTo(looksOf("red"), emphasis, 220);
    fade.step(16);

    fade.step(110);

    // The curve is symmetric, so half the time is half the way.
    expect(materials.muscles.abs.color.getHexString()).toBe(
      new Color("blue").lerp(new Color("red"), 0.5).getHexString(),
    );
  });

  it("should end on the new looks exactly, and need no frame after", async () => {
    const { materials, fade } = await startedFade("blue");
    fade.moveTo(looksOf("red", 0.5), emphasis, 220);
    fade.step(16);

    const stillMoving = fade.step(500);

    expect(stillMoving).toBe(false);
    expect(materials.muscles.abs.color.getHexString()).toBe(hex("red"));
    expect(materials.neckColour.getHexString()).toBe(hex("red"));
    expect(fade.step(16)).toBe(false);
  });

  it("should move the neck colour with the neck muscle all the way", async () => {
    const { materials, fade } = await startedFade("blue");
    fade.moveTo(looksOf("red"), emphasis, 220);
    fade.step(16);

    fade.step(60);

    expect(materials.neckColour.getHex()).toBe(materials.muscles.neck.color.getHex());
  });

  it("should ease the neck colour to the upper trapezius's when that muscle turns warmer, with no jump to it", async () => {
    const { materials, fade } = await startedFade("blue");
    const before = materials.neckColour.clone();
    const warmerTrapezius = byMuscle((id): Look =>
      id === "traps_upper"
        ? { color: "red", glowColor: "red", glow: 0, warmth: 3 }
        : { color: "blue", glowColor: "red", glow: 0 },
    );

    fade.moveTo(warmerTrapezius, emphasis, 220);
    fade.step(16);

    expect(materials.neckColour.equals(before)).toBe(true);

    fade.step(110);

    expect(materials.neckColour.getHexString()).toBe(
      new Color("blue").lerp(new Color("red"), 0.5).getHexString(),
    );

    fade.step(500);

    expect(materials.neckColour.getHexString()).toBe(hex("red"));
  });

  it("should turn about from where it had got to, with no jump", async () => {
    const { materials, fade } = await startedFade("blue");
    fade.moveTo(looksOf("red"), emphasis, 220);
    fade.step(16);
    fade.step(110);
    const part = materials.muscles.abs.color.clone();

    fade.moveTo(looksOf("lime"), emphasis, 220);
    fade.step(16);

    expect(materials.muscles.abs.color.equals(part)).toBe(true);
  });
});
