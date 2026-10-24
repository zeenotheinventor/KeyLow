import { Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial, ShaderLib } from "three";
import { describe, expect, it } from "vitest";

import { bodyMaterials } from "../src/bodyMaterials";

import type { BodyColours } from "../src/bodyMaterials";

const colours: BodyColours = {
  muscle: "tomato",
  otherMuscle: "gold",
  core: "navy",
  clay: "peru",
  skin: "skyblue",
};

const hexOf = (material: { color: Color }) => material.color.getHexString();
const hexOfName = (name: string) => new Color(name).getHexString();

describe("bodyMaterials", () => {
  const materials = bodyMaterials(colours);
  const all = Object.values(materials);

  it("should give each material the colour it is given, in sRGB as the hex was written", () => {
    expect(hexOf(materials.muscle)).toBe(hexOfName(colours.muscle));
    expect(hexOf(materials.other)).toBe(hexOfName(colours.otherMuscle));
    expect(hexOf(materials.core)).toBe(hexOfName(colours.core));
    expect(hexOf(materials.head)).toBe(hexOfName(colours.clay));
    expect(hexOf(materials.skin)).toBe(hexOfName(colours.skin));
  });

  it("should make the skin the only transparent material", () => {
    expect(all.filter((material) => material.transparent)).toEqual([materials.skin]);
  });

  it("should not let the skin write depth, so the opaque muscles never need sorting", () => {
    expect(materials.skin.depthWrite).toBe(false);
    for (const material of all.filter((one) => one !== materials.skin)) {
      expect(material.depthWrite).toBe(true);
    }
  });

  it("should light the muscles from within a little and the core more, as the approved render does", () => {
    expect(materials.muscle.emissiveIntensity).toBeCloseTo(0.12);
    expect(materials.core.emissiveIntensity).toBeCloseTo(0.5);
    expect(materials.other.emissiveIntensity).toBe(0);
    expect(hexOf(materials.core)).toBe(materials.core.emissive.getHexString());
  });

  it("should draw the muscles, the core and the head matt", () => {
    for (const material of [materials.muscle, materials.other, materials.core, materials.head]) {
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect(material.roughness).toBeCloseTo(0.9);
      expect(material.metalness).toBe(0);
    }
  });

  it("should draw the skin unlit, as a plain colour with a see-through weight in its shader", () => {
    expect(materials.skin).toBeInstanceOf(MeshBasicMaterial);
    expect(materials.skin.side).toBe(FrontSide);
  });

  describe("the skin's shader", () => {
    const { vertexShader, fragmentShader } = ShaderLib.basic;
    const changed = applyShaderChange(materials.skin, { vertexShader, fragmentShader });

    it("should pass the normal and the direction to the eye from the vertex shader to the fragment shader", () => {
      expect(changed.vertexShader).toContain("vSkinNormal = ");
      expect(changed.vertexShader).toContain("vSkinViewDirection = ");
      expect(changed.fragmentShader).toContain("varying vec3 vSkinNormal;");
    });

    it("should set the alpha from the fresnel weight, about 0.05 face on and 0.5 at the edge", () => {
      expect(changed.fragmentShader).toContain("diffuseColor.a = mix( 0.04, 0.5, skinFresnel )");
    });

    it("should keep every line of the shader it was given", () => {
      expect(changed.fragmentShader).toContain("#include <opaque_fragment>");
      expect(changed.vertexShader).toContain("#include <project_vertex>");
    });

    it("should have a cache key of its own, so three does not share a program with another basic material", () => {
      expect(materials.skin.customProgramCacheKey()).not.toBe(
        new MeshBasicMaterial().customProgramCacheKey(),
      );
    });
  });

  describe("the head's shader", () => {
    const { vertexShader, fragmentShader } = ShaderLib.standard;
    const changed = applyShaderChange(materials.head, { vertexShader, fragmentShader });

    it("should read the world height in the vertex shader", () => {
      expect(changed.vertexShader).toContain(
        "vBodyHeight = ( modelMatrix * vec4( transformed, 1.0 ) ).y;",
      );
    });

    it("should mix the clay into the neck's colour from 1.492 m down to 1.445 m, the heights of the approved render", () => {
      expect(changed.fragmentShader).toContain(
        "diffuseColor.rgb = mix( bodyNeckColour, diffuseColor.rgb, clamp( ( vBodyHeight - 1.445 ) / ( 1.492 - 1.445 ), 0.0, 1.0 ) );",
      );
      expect(changed.fragmentShader).toContain("uniform vec3 bodyNeckColour;");
    });

    it("should mix the colour after the material's own colour is read, so the fade is not overwritten", () => {
      expect(changed.fragmentShader).toContain(
        "#include <color_fragment>\ndiffuseColor.rgb = mix( bodyNeckColour",
      );
    });

    it("should keep the head opaque, so the skin is the only mesh that needs sorting", () => {
      expect(materials.head.transparent).toBe(false);
      expect(materials.head.alphaHash).toBe(false);
    });

    it("should fade into the muscle colour, which it gives the shader as a uniform", () => {
      const uniforms: Record<string, { value: Color }> = {};
      applyShaderChange(materials.head, { vertexShader, fragmentShader }, uniforms);

      expect(uniforms["bodyNeckColour"]?.value.getHexString()).toBe(hexOfName(colours.muscle));
    });
  });
});

type ShaderSources = { vertexShader: string; fragmentShader: string };

// What three does at compile time: hands the material the shader's sources and takes back what it changed.
function applyShaderChange(
  material: { onBeforeCompile: (parameters: never, renderer: never) => void },
  sources: ShaderSources,
  uniforms: object = {},
): ShaderSources {
  const parameters = { ...sources, uniforms };
  Reflect.apply(material.onBeforeCompile, material, [parameters, undefined]);
  return parameters;
}
