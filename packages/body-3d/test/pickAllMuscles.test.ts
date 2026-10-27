import { MUSCLE_IDS } from "@keylow/body-model/meshNames";
import { BODY_ARTWORK_SIDE_OF } from "@keylow/core/training";
import { Box3, Matrix3, Mesh, PerspectiveCamera, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { dressBody } from "../src/dressBody";
import { BODY_FIELD_OF_VIEW_DEGREES, frameBody } from "../src/frameBody";
import { pickMuscle } from "../src/pickMuscle";
import { BODY_SIDE_YAW, turnAboutCentre } from "../src/rotation";
import { loadMaleBody } from "./support/maleGlb";

import type { DressedBody } from "../src/dressBody";
import type { MuscleId } from "@keylow/body-model/meshNames";
import type { Object3D } from "three";

// The class check narrows to a mesh with any geometry and material, which this states in the type once.
const isMesh = (object: Object3D | undefined): object is Mesh => object instanceof Mesh;

// The framing of the body map's stage: the body drawn for the 200 by 440 figure, on a canvas as wide as a phone's stage.
const FRAME_ASPECT = 200 / 440;
const CANVAS = { width: 360, height: 238 };
// The body is turned a quarter of a half turn either side of the straight views for the three-quarter ones.
const THREE_QUARTER_TURN = Math.PI / 4;
// How many points of a muscle are cast at in one view, spread evenly over the part of it that faces the camera.
const POINTS_PER_VIEW = 60;
// Casting a ray through the whole body is slow on a loaded machine, and a view that cannot see a muscle casts all of them.
const SLOW_RAYCAST_TIMEOUT_MILLISECONDS = 120_000;

const VIEWS = {
  "straight front": BODY_SIDE_YAW.front,
  "straight back": BODY_SIDE_YAW.back,
  "three-quarter front": THREE_QUARTER_TURN,
  "three-quarter back": BODY_SIDE_YAW.back - THREE_QUARTER_TURN,
} as const;
type ViewName = keyof typeof VIEWS;
const VIEW_NAMES = Object.keys(VIEWS).filter((name): name is ViewName => name in VIEWS);

const colours = { muscle: "red", otherMuscle: "gold", core: "navy", clay: "peru", skin: "skyblue" };

/** The centre of each triangle of the mesh that faces the camera, in the world as the body is turned. */
function facingCentres(mesh: Mesh, eye: Vector3): Vector3[] {
  const positions = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.getIndex();
  const triangleCount = (index === null ? positions.count : index.count) / 3;
  const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
  const vertexAt = (corner: number) =>
    new Vector3()
      .fromBufferAttribute(positions, index === null ? corner : index.getX(corner))
      .applyMatrix4(mesh.matrixWorld);
  const centres: Vector3[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const [a, b, c] = [
      vertexAt(triangle * 3),
      vertexAt(triangle * 3 + 1),
      vertexAt(triangle * 3 + 2),
    ];
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).applyMatrix3(normalMatrix);
    const centre = a.clone().add(b).add(c).divideScalar(3);
    if (normal.dot(eye.clone().sub(centre)) > 0) {
      centres.push(centre);
    }
  }
  return centres;
}

describe("pickMuscle on the committed male body", () => {
  let body: DressedBody;
  let camera: PerspectiveCamera;

  beforeAll(async () => {
    body = dressBody(await loadMaleBody(), colours);
    camera = new PerspectiveCamera(
      BODY_FIELD_OF_VIEW_DEGREES,
      CANVAS.width / CANVAS.height,
      0.1,
      1000,
    );
    camera.position.set(...frameBody(body.box, FRAME_ASPECT));
    camera.updateProjectionMatrix();
  });

  const cache = new Map<string, boolean>();

  /** Whether a finger on a point of the muscle, as the camera sees it in this view, picks that muscle. */
  function isPickedFrom(id: MuscleId, view: ViewName): boolean {
    const key = `${id}|${view}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const middle = new Box3().copy(body.box).getCenter(new Vector3());
    turnAboutCentre(body.group, VIEWS[view], middle.x, middle.z);
    body.group.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const mesh = body.group.getObjectByName(id);
    if (!isMesh(mesh)) {
      throw new Error(`The body has no mesh named ${id}.`);
    }
    const facing = facingCentres(mesh, camera.position);
    const stride = Math.max(1, Math.floor(facing.length / POINTS_PER_VIEW));
    const isPicked = facing
      .filter((_, position) => position % stride === 0)
      .some((centre) => {
        const onCanvas = centre.clone().project(camera);
        if (Math.abs(onCanvas.x) > 1 || Math.abs(onCanvas.y) > 1) {
          return false;
        }
        const point = {
          x: ((onCanvas.x + 1) / 2) * CANVAS.width,
          y: ((1 - onCanvas.y) / 2) * CANVAS.height,
        };
        return pickMuscle(point, CANVAS, camera, body.group) === id;
      });
    cache.set(key, isPicked);
    return isPicked;
  }

  it.each(MUSCLE_IDS)(
    "should pick %s from at least one of the four views",
    (id) => {
      const viewsThatPick = VIEW_NAMES.filter((view) => isPickedFrom(id, view));

      expect(viewsThatPick, `${id} is picked from no view`).not.toHaveLength(0);
    },
    SLOW_RAYCAST_TIMEOUT_MILLISECONDS,
  );

  it.each(MUSCLE_IDS)(
    "should pick %s from the straight view of the side the artwork draws it on",
    (id) => {
      const side = BODY_ARTWORK_SIDE_OF[id];

      expect(isPickedFrom(id, side === "front" ? "straight front" : "straight back")).toBe(true);
    },
    SLOW_RAYCAST_TIMEOUT_MILLISECONDS,
  );
});
