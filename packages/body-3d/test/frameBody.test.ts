import { Box3, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { BODY_FIELD_OF_VIEW_DEGREES, frameBody, pointsPerMetre } from "../src/frameBody";
import { cameraShift } from "../src/zoom";
import { loadMaleBody } from "./support/maleGlb";

// The widest and narrowest views the app uses: the 200 by 440 body map figure is 0.45, and a card that
// shows the body beside text is wider. 0.25 and 1.5 are further out than either.
const ASPECTS = [0.25, 200 / 440, 1, 1.5];

const cornersOf = (box: Box3) =>
  [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))),
  );

// The corners as the camera sees them, from -1 to 1 across the view.
function normalisedCorners(box: Box3, aspect: number) {
  const camera = new PerspectiveCamera(BODY_FIELD_OF_VIEW_DEGREES, aspect, 0.1, 100);
  camera.position.fromArray(frameBody(box, aspect));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return cornersOf(box).map((corner) => corner.project(camera));
}

describe("frameBody", () => {
  const body = new Box3(new Vector3(-0.33, 0, -0.14), new Vector3(0.33, 1.69, 0.14));

  it.each(ASPECTS)("should keep the whole box in view at aspect %s", (aspect) => {
    for (const corner of normalisedCorners(body, aspect)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
    }
  });

  it("should keep the committed male body whole at every aspect", async () => {
    const { meshes } = await loadMaleBody();
    const male = new Box3();
    for (const mesh of meshes.values()) {
      male.union(new Box3().setFromObject(mesh));
    }

    for (const aspect of ASPECTS) {
      for (const corner of normalisedCorners(male, aspect)) {
        expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("should leave a little air above the head and below the feet, and not fill the view", () => {
    const heights = normalisedCorners(body, 200 / 440).map((corner) => Math.abs(corner.y));

    expect(Math.max(...heights)).toBeGreaterThan(0.85);
    expect(Math.max(...heights)).toBeLessThan(1);
  });

  it("should look straight at the middle of the box, from the front", () => {
    const [x, y, z] = frameBody(body, 200 / 440);

    expect(x).toBe(0);
    expect(y).toBeCloseTo(0.845);
    expect(z).toBeGreaterThan(body.max.z);
  });

  it("should stand further back for a narrower view, because the width then decides", () => {
    const [, , wide] = frameBody(body, 1);
    const [, , narrow] = frameBody(body, 0.25);

    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("pointsPerMetre", () => {
  const body = new Box3(new Vector3(-0.33, 0, -0.14), new Vector3(0.33, 1.69, 0.14));
  const VIEW_HEIGHT_POINTS = 238;
  const ASPECT = 200 / 440;

  // Where a point on the front of the body, a metre above its middle, is drawn, in points above the view's middle.
  function pointsAboveMiddle(cameraPosition: [number, number, number], zoom: number) {
    const camera = new PerspectiveCamera(BODY_FIELD_OF_VIEW_DEGREES, ASPECT, 0.1, 100);
    camera.position.fromArray(cameraPosition);
    camera.zoom = zoom;
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const [, middleY] = frameBody(body, ASPECT);
    const point = new Vector3(0, middleY + 1, body.max.z).project(camera);
    return (point.y * VIEW_HEIGHT_POINTS) / 2;
  }

  it("should give the points that a metre of the body's front takes up", () => {
    const framed = frameBody(body, ASPECT);

    expect(pointsAboveMiddle(framed, 1)).toBeCloseTo(
      pointsPerMetre(body, ASPECT, VIEW_HEIGHT_POINTS),
    );
  });

  it("should match where the camera shift puts the body: moved up by the offset, at the zoom", () => {
    const [x, y, z] = frameBody(body, ASPECT);
    const scale = pointsPerMetre(body, ASPECT, VIEW_HEIGHT_POINTS);
    const shift = cameraShift({ zoom: 2, x: 0, y: 40 }, scale);

    // The body is moved down by 40 points, so a point a metre up is drawn 40 points lower than at 2x alone.
    const centred = pointsAboveMiddle([x, y, z], 2);
    const moved = pointsAboveMiddle([x + shift.x, y + shift.y, z], 2);

    expect(centred - moved).toBeCloseTo(40);
  });
});
