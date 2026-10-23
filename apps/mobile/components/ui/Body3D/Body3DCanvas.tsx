/* eslint-disable react/no-unknown-property -- react-three-fiber elements take three.js props, which the DOM rule does not know */
import testShape from "@keylow/body-3d/fixtures/quantised-cube.glb";
import { Canvas } from "@react-three/fiber/native";
import { Suspense, use, useMemo } from "react";

import { bundledModel } from "./bundledModel";

// The camera looks down the z axis at the middle of the 3 by 1.5 test shape. The vertical field of view
// is wide because the canvas is tall and narrow, and the shape has to fit its width.
const CAMERA = { position: [0, 0, 7] as const, fov: 65 };

// Turned a little off the front, so the boxes show their sides and the draw is plainly 3D.
const SHAPE_ROTATION = [0.35, -0.5, 0] as const;
const SHAPE_POSITION = [0, -0.75, 0] as const;

function BodyMeshes({ color }: { color: string }) {
  const { meshes } = use(bundledModel(testShape));
  // A copy for each canvas, so two on screen do not take the meshes from one another or share a material.
  const copies = useMemo(
    () => [...meshes].map(([name, mesh]) => [name, mesh.clone()] as const),
    [meshes],
  );

  return (
    <group position={SHAPE_POSITION} rotation={SHAPE_ROTATION}>
      {copies.map(([name, mesh]) => (
        <primitive key={name} object={mesh}>
          <meshStandardMaterial attach="material" color={color} />
        </primitive>
      ))}
    </group>
  );
}

/**
 * The GL view: a transparent canvas, a fixed camera, a soft light and the meshes in one colour. The
 * native canvas always draws at the device's pixel ratio, because expo-gl cannot render at any other,
 * so it takes no `dpr` to cap at 2.
 */
export function Body3DCanvas({ color }: { color: string }) {
  return (
    <Canvas camera={CAMERA} frameloop="demand">
      <ambientLight intensity={1.2} />
      <directionalLight intensity={1.4} position={[2, 4, 5]} />
      <Suspense fallback={null}>
        <BodyMeshes color={color} />
      </Suspense>
    </Canvas>
  );
}
