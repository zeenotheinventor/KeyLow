import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";

import { pickMuscle } from "../src/pickMuscle";

const SIZE = { width: 200, height: 400 };
const CENTRE = { x: 100, y: 200 };

// A camera 5 metres in front of the origin, looking down the negative z axis, as the app's camera does.
function cameraAt(x = 0, zoom = 1) {
  const camera = new PerspectiveCamera(30, SIZE.width / SIZE.height, 0.1, 100);
  camera.position.set(x, 0, 5);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

// A box named like a mesh of the body, `depth` metres thick and centred at (x, 0, z).
function boxNamed(name: string, { x = 0, z = 0, width = 0.5, depth = 0.2 } = {}) {
  const mesh = new Mesh(new BoxGeometry(width, 0.5, depth), new MeshStandardMaterial());
  mesh.name = name;
  mesh.position.set(x, 0, z);
  return mesh;
}

function bodyOf(...meshes: Mesh[]) {
  const group = new Group();
  group.add(...meshes);
  return group;
}

describe("pickMuscle", () => {
  it("should name the muscle under the point", () => {
    const body = bodyOf(boxNamed("chest_upper"));

    expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBe("chest_upper");
  });

  it("should pick nothing where there is no mesh", () => {
    const body = bodyOf(boxNamed("chest_upper"));

    expect(pickMuscle({ x: 5, y: 5 }, SIZE, cameraAt(), body)).toBeNull();
  });

  it("should pick the muscle in front where two are along the ray", () => {
    const body = bodyOf(boxNamed("lats", { z: -1 }), boxNamed("biceps", { z: 0 }));

    expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBe("biceps");
  });

  it.each(["skin", "core", "head", "eyes"])(
    "should see through the %s, which is not tested at all",
    (name) => {
      const body = bodyOf(boxNamed("quads", { z: -1 }), boxNamed(name, { z: 0, width: 2 }));

      expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBe("quads");
    },
  );

  it("should pick nothing where a muscle with no id is in front, because it is what is drawn there", () => {
    const body = bodyOf(boxNamed("quads", { z: -1 }), boxNamed("other", { z: 0 }));

    expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBeNull();
  });

  it("should pick a muscle in front of a muscle with no id", () => {
    const body = bodyOf(boxNamed("other", { z: -1 }), boxNamed("quads", { z: 0 }));

    expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBe("quads");
  });

  it("should measure the point across the size it is given, from the top left", () => {
    // Left of the middle of the view and above it.
    const body = bodyOf(boxNamed("calves", { x: -0.3, width: 0.1 }));
    const camera = cameraAt();
    const left = pickMuscle({ x: 100 - 49, y: 200 }, SIZE, camera, body);
    const right = pickMuscle({ x: 100 + 49, y: 200 }, SIZE, camera, body);

    expect(left).toBe("calves");
    expect(right).toBeNull();
  });

  it("should pick through the body as it is turned", () => {
    const front = boxNamed("abs", { z: 0.5 });
    const back = boxNamed("lower_back", { z: -0.5 });
    const body = bodyOf(front, back);
    body.rotation.y = Math.PI;

    expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBe("lower_back");
  });

  it("should pick through the camera as it is moved and zoomed", () => {
    const body = bodyOf(boxNamed("neck", { width: 0.1 }));
    const aside = cameraAt(0.2, 2);

    expect(pickMuscle(CENTRE, SIZE, aside, body)).toBeNull();
    // The box is 0.2 metres to the left of the camera's axis, which twice the zoom draws about 60 points left of the middle.
    expect(pickMuscle({ x: 40, y: 200 }, SIZE, aside, body)).toBe("neck");
    expect(pickMuscle({ x: 70, y: 200 }, SIZE, aside, body)).toBeNull();
  });

  it("should use the transforms as they are now, though nothing has drawn since they changed", () => {
    const body = bodyOf(boxNamed("traps_mid", { width: 0.1 }));
    const camera = cameraAt();
    expect(pickMuscle(CENTRE, SIZE, camera, body)).toBe("traps_mid");

    body.position.x = 3;
    expect(pickMuscle(CENTRE, SIZE, camera, body)).toBeNull();

    camera.position.x = 3;
    expect(pickMuscle(CENTRE, SIZE, camera, body)).toBe("traps_mid");
  });

  it("should pick nothing from a view with no size", () => {
    const body = bodyOf(boxNamed("chest_upper"));

    expect(pickMuscle(CENTRE, { width: 0, height: 0 }, cameraAt(), body)).toBeNull();
  });

  it("should not pick a mesh with a name that is not in the contract", () => {
    const body = bodyOf(boxNamed("not_a_muscle"));

    expect(pickMuscle(CENTRE, SIZE, cameraAt(), body)).toBeNull();
  });
});
