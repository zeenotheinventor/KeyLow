import { describe, expect, it } from "vitest";

import { writeGlb } from "../src/glb.ts";
import { ATTRIBUTION_LINES, COPYRIGHT } from "../src/maleExport.ts";
import { BODY_MESH_NAMES } from "../src/meshNames.ts";
import { verifyGlb } from "../src/verifyGlb.ts";

const SHORT = 5122;
const BYTE = 5120;
const UNSIGNED_INT = 5125;
const GOOD_LICENCE = ATTRIBUTION_LINES.join("\n");

type BuildOptions = {
  names?: string[];
  /** Triangles per mesh name. Every other mesh gets 1,000. */
  triangles?: Record<string, number>;
  /** Extra JSON merged over the top level of the glTF. */
  extra?: Record<string, unknown>;
  copyright?: string | undefined;
  /** World bounds of the skin, and so of the body: the feet, the height, the middle on x and z. */
  feetY?: number;
  height?: number;
  middleX?: number;
  /** Extra bytes in the binary chunk, to make the file big. */
  padding?: number;
  /** Mesh names that get no NORMAL attribute. */
  withoutNormals?: string[];
  /** Mesh names that get a second material. */
  twoMaterials?: string[];
  /** Mesh names whose node exists but is left out of the scene. */
  outsideScene?: string[];
  /** Mesh names that get no material. */
  withoutMaterial?: string[];
  /** Replaces the material name of a mesh. */
  materialName?: Record<string, string>;
  eyesZ?: number;
  middleZ?: number;
  /** Mesh names whose node gets a rotation, or a matrix. */
  rotated?: string[];
  matrixed?: string[];
  /** Mesh names whose primitive is drawn with this mode. */
  drawMode?: Record<string, number>;
  /** Mesh names whose primitive has no POSITION attribute. */
  withoutPositions?: string[];
  /** Mesh names whose node has these extensions. */
  nodeExtensions?: Record<string, Record<string, unknown>>;
  /** Names of nodes that have no mesh, added after the meshes in the scene. */
  emptyNodes?: string[];
};

/** The stored 16 bit range is -32767 to 32767, so a node scales by half the extent and moves to the middle. */
function placement(low: number[], high: number[]) {
  return {
    scale: low.map((value, axis) => ((high[axis] ?? value) - value) / 2),
    translation: low.map((value, axis) => ((high[axis] ?? value) + value) / 2),
  };
}

/** A glb whose JSON describes the 27 meshes. The accessors only declare counts and bounds, no vertex data is stored. */
function buildGlb(options: BuildOptions = {}): Buffer {
  const names = options.names ?? [...BODY_MESH_NAMES];
  const height = options.height ?? 1.7;
  const feetY = options.feetY ?? 0;
  const accessors: unknown[] = [];
  const materials: { name: string }[] = [];
  const addAccessor = (accessor: unknown) => accessors.push(accessor) - 1;
  const addMaterial = (name: string) => materials.push({ name }) - 1;
  const nodes: unknown[] = [];
  const meshes = names.map((name, meshIndex) => {
    const triangles = options.triangles?.[name] ?? 1000;
    const vertices = Math.max(triangles * 3, 3);
    const attributes: Record<string, number> = {
      POSITION: addAccessor({
        componentType: SHORT,
        normalized: true,
        count: vertices,
        type: "VEC3",
        min: [-32767, -32767, -32767],
        max: [32767, 32767, 32767],
      }),
    };
    if (!options.withoutNormals?.includes(name)) {
      attributes.NORMAL = addAccessor({
        componentType: BYTE,
        normalized: true,
        count: vertices,
        type: "VEC3",
      });
    }
    if (options.withoutPositions?.includes(name)) {
      delete attributes.POSITION;
    }
    const indices = addAccessor({
      componentType: UNSIGNED_INT,
      count: triangles * 3,
      type: "SCALAR",
    });
    const primitives = [
      {
        attributes,
        indices,
        ...(options.drawMode?.[name] === undefined ? {} : { mode: options.drawMode[name] }),
        ...(options.withoutMaterial?.includes(name)
          ? {}
          : { material: addMaterial(options.materialName?.[name] ?? `mat_${name}`) }),
      },
    ];
    if (options.twoMaterials?.includes(name)) {
      primitives.push({ attributes, indices, material: addMaterial(`mat_${name}_second`) });
    }
    const middleZ = options.middleZ ?? 0;
    const eyesZ = (options.eyesZ ?? 0.1) + middleZ;
    const isEyes = name === "eyes";
    nodes.push({
      name,
      mesh: meshIndex,
      ...placement(
        [-0.4 + (options.middleX ?? 0), feetY, isEyes ? eyesZ : middleZ - 0.1],
        [0.4 + (options.middleX ?? 0), feetY + height, isEyes ? eyesZ : middleZ + 0.1],
      ),
      ...(options.rotated?.includes(name) ? { rotation: [0, 0.7071, 0, 0.7071] } : {}),
      ...(options.matrixed?.includes(name)
        ? { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }
        : {}),
      ...(options.nodeExtensions?.[name] === undefined
        ? {}
        : { extensions: options.nodeExtensions[name] }),
    });
    return { name, primitives };
  });
  const emptyNodeIndices = (options.emptyNodes ?? []).map((name) => nodes.push({ name }) - 1);
  const json = {
    asset: {
      version: "2.0",
      copyright: "copyright" in options ? options.copyright : COPYRIGHT,
    },
    extensionsUsed: ["KHR_mesh_quantization"],
    extensionsRequired: ["KHR_mesh_quantization"],
    scene: 0,
    scenes: [
      {
        nodes: names
          .map((name, index) => ({ name, index }))
          .filter(({ name }) => !options.outsideScene?.includes(name))
          .map(({ index }) => index)
          .concat(emptyNodeIndices),
      },
    ],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews: [],
    buffers: [],
    ...options.extra,
  };
  return writeGlb(json, Buffer.alloc(options.padding ?? 0));
}

describe("verifyGlb", () => {
  it("should report no problem for a file that follows the contract", () => {
    expect(verifyGlb(buildGlb(), GOOD_LICENCE)).toEqual([]);
  });

  it("should name a mesh that is missing", () => {
    const names = BODY_MESH_NAMES.filter((name) => name !== "lats");

    expect(verifyGlb(buildGlb({ names }), GOOD_LICENCE)).toContain("`lats` is missing");
  });

  it("should name a mesh that appears twice", () => {
    const names = [...BODY_MESH_NAMES, "biceps"];

    expect(verifyGlb(buildGlb({ names }), GOOD_LICENCE)).toContain("`biceps` appears twice");
  });

  it("should name a mesh the contract does not have", () => {
    const names = [...BODY_MESH_NAMES, "teapot"];

    expect(verifyGlb(buildGlb({ names }), GOOD_LICENCE)).toContain(
      "`teapot` is not a mesh of the contract",
    );
  });

  it("should report meshes that are not in the order of the contract", () => {
    const names = [...BODY_MESH_NAMES].reverse();

    expect(verifyGlb(buildGlb({ names }), GOOD_LICENCE)).toContain(
      "the meshes are not in the order of the contract",
    );
  });

  it("should name a node that is not in the scene", () => {
    const problems = verifyGlb(buildGlb({ outsideScene: ["lats"] }), GOOD_LICENCE);

    expect(problems).toContain("`lats` is missing");
    expect(problems).toContain("the node `lats` is not in the scene");
  });

  it("should name a mesh that has no triangles", () => {
    expect(verifyGlb(buildGlb({ triangles: { skin: 0 } }), GOOD_LICENCE)).toContain(
      "`skin` has no triangles",
    );
  });

  it("should name a muscle id that is under the floor, with its count", () => {
    expect(verifyGlb(buildGlb({ triangles: { forearms: 640 } }), GOOD_LICENCE)).toContain(
      "`forearms` has 640 triangles, the floor is 1,000",
    );
  });

  it("should name a mesh that has no normals", () => {
    expect(verifyGlb(buildGlb({ withoutNormals: ["core"] }), GOOD_LICENCE)).toContain(
      "`core` has no normals",
    );
  });

  it("should report a body with too many triangles", () => {
    expect(verifyGlb(buildGlb({ triangles: { other: 230_000 } }), GOOD_LICENCE)).toContain(
      "the body has 256,000 triangles, the limit is 250,000",
    );
  });

  it("should report a file over 4 MB", () => {
    const problems = verifyGlb(buildGlb({ padding: 4 * 1024 * 1024 }), GOOD_LICENCE);

    expect(problems.some((problem) => problem.startsWith("the file is "))).toBe(true);
    expect(problems.join(" ")).toContain("the limit is 4 MB");
  });

  it("should report a texture", () => {
    expect(
      verifyGlb(buildGlb({ extra: { textures: [{}], images: [{}] } }), GOOD_LICENCE),
    ).toContain("the file has textures (1), the contract allows none");
  });

  it("should report a camera, an animation and a skin", () => {
    const problems = verifyGlb(
      buildGlb({ extra: { cameras: [{}], animations: [{}], skins: [{}] } }),
      GOOD_LICENCE,
    );

    expect(problems).toContain("the file has cameras (1), the contract allows none");
    expect(problems).toContain("the file has animations (1), the contract allows none");
    expect(problems).toContain("the file has skins (1), the contract allows none");
  });

  it("should report a Draco extension", () => {
    const problems = verifyGlb(
      buildGlb({
        extra: {
          extensionsUsed: ["KHR_mesh_quantization", "KHR_draco_mesh_compression"],
          extensionsRequired: ["KHR_mesh_quantization", "KHR_draco_mesh_compression"],
        },
      }),
      GOOD_LICENCE,
    );

    expect(problems).toContain(
      "the file uses the extension `KHR_draco_mesh_compression`, only KHR_mesh_quantization is allowed",
    );
  });

  it("should report a light", () => {
    expect(
      verifyGlb(
        buildGlb({ extra: { extensionsUsed: ["KHR_mesh_quantization", "KHR_lights_punctual"] } }),
        GOOD_LICENCE,
      ),
    ).toContain(
      "the file uses the extension `KHR_lights_punctual`, only KHR_mesh_quantization is allowed",
    );
  });

  it("should report a mesh with two materials", () => {
    expect(verifyGlb(buildGlb({ twoMaterials: ["abs"] }), GOOD_LICENCE)).toContain(
      "`abs` has 2 primitives, the contract is one",
    );
  });

  it("should report a material that is not named after its mesh", () => {
    expect(verifyGlb(buildGlb({ materialName: { quads: "plastic" } }), GOOD_LICENCE)).toContain(
      "`quads` uses the material `plastic`, expected `mat_quads`",
    );
  });

  it("should report a mesh with no material", () => {
    expect(verifyGlb(buildGlb({ withoutMaterial: ["head"] }), GOOD_LICENCE)).toContain(
      "`head` has no material, expected `mat_head`",
    );
  });

  it("should report a body under 1.6 metres", () => {
    expect(verifyGlb(buildGlb({ height: 1.2 }), GOOD_LICENCE)).toContain(
      "the body is 1.200 m tall, it must be 1.6 to 2.0 m",
    );
  });

  it("should report a body over 2.0 metres", () => {
    expect(verifyGlb(buildGlb({ height: 2.4 }), GOOD_LICENCE)).toContain(
      "the body is 2.400 m tall, it must be 1.6 to 2.0 m",
    );
  });

  it("should report feet that are not on y = 0", () => {
    expect(verifyGlb(buildGlb({ feetY: 0.25 }), GOOD_LICENCE)).toContain(
      "the feet are at y = 0.250, they must be on y = 0",
    );
  });

  it("should report a body that is not centred on x", () => {
    expect(verifyGlb(buildGlb({ middleX: 0.3 }), GOOD_LICENCE)).toContain(
      "the skin is centred on x = 0.300, it must be on x = 0",
    );
  });

  it("should report a body that faces backwards", () => {
    expect(verifyGlb(buildGlb({ eyesZ: -0.1 }), GOOD_LICENCE)).toContain(
      "the eyes are not in front of the body, the model must face +z",
    );
  });

  it("should report a light in the extensions of the file", () => {
    expect(
      verifyGlb(
        buildGlb({ extra: { extensions: { KHR_lights_punctual: { lights: [{}] } } } }),
        GOOD_LICENCE,
      ),
    ).toContain(
      "the file uses the extension `KHR_lights_punctual`, only KHR_mesh_quantization is allowed",
    );
  });

  it("should report a light on a node", () => {
    expect(
      verifyGlb(
        buildGlb({ nodeExtensions: { head: { KHR_lights_punctual: { light: 0 } } } }),
        GOOD_LICENCE,
      ),
    ).toContain(
      "the file uses the extension `KHR_lights_punctual`, only KHR_mesh_quantization is allowed",
    );
  });

  it("should report a body that is not centred on z", () => {
    expect(verifyGlb(buildGlb({ middleZ: 0.2 }), GOOD_LICENCE)).toContain(
      "the skin is centred on z = 0.200, it must be on z = 0",
    );
  });

  it("should report a node with a rotation, because the bounds would be wrong", () => {
    expect(verifyGlb(buildGlb({ rotated: ["quads"] }), GOOD_LICENCE)).toContain(
      "`quads` has a rotation or a matrix, the contract has a translation and a scale only",
    );
  });

  it("should report a node with a matrix", () => {
    expect(verifyGlb(buildGlb({ matrixed: ["quads"] }), GOOD_LICENCE)).toContain(
      "`quads` has a rotation or a matrix, the contract has a translation and a scale only",
    );
  });

  it("should report a mesh that is not drawn as triangles", () => {
    expect(verifyGlb(buildGlb({ drawMode: { abs: 1 } }), GOOD_LICENCE)).toContain(
      "`abs` is not drawn as triangles",
    );
  });

  it("should accept a mesh whose mode is triangles", () => {
    expect(verifyGlb(buildGlb({ drawMode: { abs: 4 } }), GOOD_LICENCE)).toEqual([]);
  });

  it("should report a mesh that has no positions", () => {
    expect(verifyGlb(buildGlb({ withoutPositions: ["calves"] }), GOOD_LICENCE)).toContain(
      "`calves` has no positions",
    );
  });

  it("should report a node in the scene that has no mesh", () => {
    expect(verifyGlb(buildGlb({ emptyNodes: ["pivot"] }), GOOD_LICENCE)).toContain(
      "the node `pivot` has no mesh, the contract has mesh nodes only",
    );
  });

  it("should count a mesh that appears three times", () => {
    const names = [...BODY_MESH_NAMES, "biceps", "biceps"];

    expect(verifyGlb(buildGlb({ names }), GOOD_LICENCE)).toContain("`biceps` appears 3 times");
  });

  it("should report a missing copyright", () => {
    expect(verifyGlb(buildGlb({ copyright: undefined }), GOOD_LICENCE)).toContain(
      "asset.copyright is missing",
    );
  });

  it("should report a copyright that lacks an attribution line", () => {
    expect(
      verifyGlb(buildGlb({ copyright: "CC BY-SA 4.0\nZ-Anatomy only" }), GOOD_LICENCE),
    ).toContain(`asset.copyright lacks the line \`${ATTRIBUTION_LINES[0]}\``);
  });

  it("should report a missing LICENCE.md", () => {
    expect(verifyGlb(buildGlb(), undefined)).toContain("LICENCE.md is missing beside the glb");
  });

  it("should report a LICENCE.md that lacks an attribution line", () => {
    expect(verifyGlb(buildGlb(), "CC BY-SA 4.0 only")).toContain(
      `LICENCE.md lacks the line \`${ATTRIBUTION_LINES[1]}\``,
    );
  });

  it("should report a file that is not a glb, without throwing", () => {
    expect(verifyGlb(Buffer.from("not a glb file"), GOOD_LICENCE)).toEqual([
      "the file is not a glTF binary: Not a glTF binary file.",
    ]);
  });

  it("should never print vertex data", () => {
    const problems = verifyGlb(buildGlb({ triangles: { forearms: 640 } }), GOOD_LICENCE);

    expect(problems.join(" ")).not.toMatch(/32767/);
  });
});
