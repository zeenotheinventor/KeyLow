import { Box3, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { BODY_FIELD_OF_VIEW_DEGREES, frameBody } from "../src/frameBody";
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
