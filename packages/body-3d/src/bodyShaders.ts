/** The two sources of a three.js program, which a material's `onBeforeCompile` may change. */
export type ShaderSources = { vertexShader: string; fragmentShader: string };

// The numbers of the approved renders (tools/body-model/blender/zanatomy_render.py and zanatomy_common.py).
// The skin is 0.04 see-through face on and 0.5 at the edge, from a fresnel weight with an index of 1.54.
const SKIN_ALPHA_FACE_ON = 0.04;
const SKIN_ALPHA_EDGE = 0.5;
const SKIN_BRIGHTNESS = 0.9;
const SKIN_FRESNEL_AT_FACE_ON = 0.045;
// The head is clay above the second height and the neck's colour below the first.
const NECK_FADE_START_METRES = 1.445;
const NECK_FADE_END_METRES = 1.492;

/**
 * Adds lines after a chunk of the shader, named as in three without the `#include` (`common`, `project_vertex`).
 * A name the shader does not hold changes nothing, which the tests catch when three is upgraded.
 */
const after = (source: string, include: string, lines: string) =>
  source.replace(`#include <${include}>`, `#include <${include}>\n${lines}`);

/**
 * Makes a `MeshBasicMaterial` see-through by its fresnel weight: nearly clear where the surface faces the
 * eye and clearer still at the edge, so the outline reads and the muscles show through. Smaller than a
 * `ShaderMaterial`, which would have to bring its own fog, colour space and tone mapping chunks.
 */
export function withSkinFresnel({ vertexShader, fragmentShader }: ShaderSources): ShaderSources {
  const varyings = "varying vec3 vSkinNormal;\nvarying vec3 vSkinViewDirection;";
  return {
    vertexShader: after(
      after(vertexShader, "common", varyings),
      "project_vertex",
      "vSkinNormal = normalize( normalMatrix * normal );\nvSkinViewDirection = normalize( - mvPosition.xyz );",
    ),
    fragmentShader: after(
      after(fragmentShader, "common", varyings),
      "color_fragment",
      [
        "float skinCosine = abs( dot( normalize( vSkinNormal ), normalize( vSkinViewDirection ) ) );",
        `float skinFresnel = ${SKIN_FRESNEL_AT_FACE_ON} + ( 1.0 - ${SKIN_FRESNEL_AT_FACE_ON} ) * pow( 1.0 - skinCosine, 5.0 );`,
        `diffuseColor.a = mix( ${SKIN_ALPHA_FACE_ON}, ${SKIN_ALPHA_EDGE}, skinFresnel );`,
        `diffuseColor.rgb *= ${SKIN_BRIGHTNESS};`,
      ].join("\n"),
    ),
  };
}

/**
 * Fades a `MeshStandardMaterial` into the colour `bodyNeckColour` over the neck, by the height of each point in
 * the world, so the head dissolves into the body below it as in the approved render. It mixes the colour and not the
 * alpha, so the head stays opaque and only the skin needs sorting. A hashed alpha did the same without a
 * colour but showed as speckle at one sample to the pixel.
 */
export function withNeckFade({ vertexShader, fragmentShader }: ShaderSources): ShaderSources {
  const varying = "varying float vBodyHeight;";
  return {
    vertexShader: after(
      after(vertexShader, "common", varying),
      "project_vertex",
      "vBodyHeight = ( modelMatrix * vec4( transformed, 1.0 ) ).y;",
    ),
    fragmentShader: after(
      after(fragmentShader, "common", `${varying}\nuniform vec3 bodyNeckColour;`),
      "color_fragment",
      `diffuseColor.rgb = mix( bodyNeckColour, diffuseColor.rgb, clamp( ( vBodyHeight - ${NECK_FADE_START_METRES} ) / ( ${NECK_FADE_END_METRES} - ${NECK_FADE_START_METRES} ), 0.0, 1.0 ) );`,
    ),
  };
}
