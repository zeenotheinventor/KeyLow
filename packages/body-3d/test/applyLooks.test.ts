import { MUSCLE_IDS } from "@keylow/body-model/meshNames";
import { Color, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";

import { applyLooks } from "../src/applyLooks";
import { MUSCLE_RELIEF } from "../src/bodyMaterials";
import { byMuscle } from "../src/byMuscle";
import { dressBody } from "../src/dressBody";
import { loadMaleBody } from "./support/maleGlb";

import type { Look, LookEmphasis } from "../src/Look";
import type { MuscleId } from "@keylow/body-model/meshNames";

const colours = {
  muscle: "tomato",
  otherMuscle: "gold",
  core: "navy",
  clay: "peru",
  skin: "skyblue",
};

const restingLook: Look = { color: "slategray", glowColor: "red", glow: 0 };
const plainEmphasis: LookEmphasis = {
  selected: undefined,
  selectedColor: "white",
  restingColor: "gray",
  dim: 1,
  unselectedOpacity: 1,
};

const allResting = () => byMuscle(() => restingLook);
const hexOf = (name: string) => new Color(name).getHexString();

const dressedMale = async () => dressBody(await loadMaleBody(), colours);

function materialNamed(group: { getObjectByName: (name: string) => unknown }, name: string) {
  const mesh = group.getObjectByName(name);
  if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshStandardMaterial)) {
    throw new Error(`${name} is not a lit mesh`);
  }
  return mesh.material;
}

describe("applyLooks on the committed male body", () => {
  it("should give every one of the 22 muscles its own look", async () => {
    const { group, materials } = await dressedMale();
    const looks = byMuscle((id) => ({
      color: MUSCLE_IDS.indexOf(id) % 2 === 0 ? "limegreen" : "orange",
      glowColor: "red",
      glow: 0,
    }));

    applyLooks(materials, looks, plainEmphasis);

    for (const id of MUSCLE_IDS) {
      expect(materialNamed(group, id).color.getHexString()).toBe(hexOf(looks[id].color));
    }
  });

  it("should give each muscle a material of its own, so a look on one never reaches another", async () => {
    const { materials } = await dressedMale();
    const looks: Record<MuscleId, Look> = {
      ...allResting(),
      quads: { ...restingLook, color: "orange" },
    };

    applyLooks(materials, looks, plainEmphasis);

    expect(materials.muscles.quads.color.getHexString()).toBe(hexOf("orange"));
    expect(materials.muscles.abs.color.getHexString()).toBe(hexOf(restingLook.color));
  });

  it("should leave the other muscles, the core, the head, the skin and the eyes as they were", async () => {
    const { group, materials } = await dressedMale();
    const fixed = ["other", "core", "head"].map((name) => {
      const material = materialNamed(group, name);
      return { material, color: material.color.clone(), emissive: material.emissive.clone() };
    });
    const skinColour = materials.skin.color.clone();

    applyLooks(
      materials,
      byMuscle(() => ({ ...restingLook, color: "orange", glow: 1 })),
      plainEmphasis,
    );

    for (const { material, color, emissive } of fixed) {
      expect(material.color.equals(color)).toBe(true);
      expect(material.emissive.equals(emissive)).toBe(true);
    }
    expect(materials.skin.color.equals(skinColour)).toBe(true);
  });

  it("should light a muscle from within by a share of its own colour when it does not glow", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, allResting(), plainEmphasis);

    const expected = new Color(restingLook.color).multiplyScalar(MUSCLE_RELIEF);
    expect(materials.muscles.abs.emissive.getHex()).toBe(expected.getHex());
    expect(materials.muscles.abs.emissiveIntensity).toBe(1);
  });

  it("should add the glow colour, by its strength, to the light from within", async () => {
    const { materials } = await dressedMale();
    const looks = { ...allResting(), biceps: { color: "orange", glowColor: "red", glow: 0.5 } };

    applyLooks(materials, looks, plainEmphasis);

    const expected = new Color("orange")
      .multiplyScalar(MUSCLE_RELIEF)
      .add(new Color("red").multiplyScalar(0.5));
    expect(materials.muscles.biceps.emissive.getHex()).toBe(expected.getHex());
    expect(materials.muscles.triceps.emissive.getHex()).not.toBe(expected.getHex());
  });

  it("should give the head's neck colour the neck muscle's colour, so no grey collar shows above a hot neck", async () => {
    const { materials } = await dressedMale();
    const looks = { ...allResting(), neck: { ...restingLook, color: "orangered" } };

    applyLooks(materials, looks, plainEmphasis);

    expect(materials.neckColour.getHexString()).toBe(hexOf("orangered"));
  });

  it("should not change the looks it was given", async () => {
    const { materials } = await dressedMale();
    const looks = allResting();

    applyLooks(materials, looks, { ...plainEmphasis, dim: 0.2, selected: "abs" });

    expect(looks).toEqual(allResting());
  });
});

describe("applyLooks with emphasis", () => {
  const orangeLooks = () => byMuscle(() => ({ ...restingLook, color: "orange", glow: 0.6 }));

  it("should show only the resting colour at a dim of 0, and no glow", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, dim: 0 });

    expect(materials.muscles.abs.color.getHexString()).toBe(hexOf(plainEmphasis.restingColor));
    expect(materials.muscles.abs.emissive.getHex()).toBe(
      new Color(plainEmphasis.restingColor).multiplyScalar(MUSCLE_RELIEF).getHex(),
    );
  });

  it("should mix the colour half way to the resting grey at a dim of 0.5", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, dim: 0.5 });

    const expected = new Color("gray").lerp(new Color("orange"), 0.5);
    expect(materials.muscles.abs.color.getHexString()).toBe(expected.getHexString());
  });

  it("should dim the glow faster than the colour, so a dimmed peak muscle does not still shine", async () => {
    const { materials } = await dressedMale();
    const looks = byMuscle(() => ({ ...restingLook, color: "orange", glowColor: "red", glow: 1 }));

    applyLooks(materials, looks, { ...plainEmphasis, dim: 0.5 });

    const mixed = new Color("gray").lerp(new Color("orange"), 0.5);
    const expected = mixed
      .clone()
      .multiplyScalar(MUSCLE_RELIEF)
      .add(new Color("red").multiplyScalar(0.25));
    expect(materials.muscles.abs.emissive.getHex()).toBe(expected.getHex());
  });

  it("should hold a dim or an unselected opacity outside 0 to 1 to the ends, as an opacity is", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, dim: 3 });
    expect(materials.muscles.abs.color.getHexString()).toBe(hexOf("orange"));

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, dim: -2 });
    expect(materials.muscles.abs.color.getHexString()).toBe(hexOf(plainEmphasis.restingColor));
  });

  it("should dim only the muscles but the selected one by the unselected opacity", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), {
      ...plainEmphasis,
      selected: "abs",
      unselectedOpacity: 0,
    });

    expect(materials.muscles.quads.color.getHexString()).toBe(hexOf(plainEmphasis.restingColor));
    expect(materials.muscles.abs.color.getHexString()).not.toBe(hexOf(plainEmphasis.restingColor));
  });

  it("should leave every muscle alone by the unselected opacity when none is selected", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, unselectedOpacity: 0 });

    expect(materials.muscles.quads.color.getHexString()).toBe(hexOf("orange"));
  });

  it("should pull the selected muscle towards the primary text colour and no other", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, selected: "abs" });

    const pulled = materials.muscles.abs.color;
    expect(pulled.r).toBeGreaterThanOrEqual(new Color("orange").r);
    expect(pulled.b).toBeGreaterThan(new Color("orange").b);
    expect(materials.muscles.quads.color.getHexString()).toBe(hexOf("orange"));
  });

  it("should give the neck its dimmed colour, as the muscle shows it", async () => {
    const { materials } = await dressedMale();

    applyLooks(materials, orangeLooks(), { ...plainEmphasis, dim: 0.5 });

    expect(materials.neckColour.getHex()).toBe(materials.muscles.neck.color.getHex());
  });
});
