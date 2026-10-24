/* eslint-disable react/no-unknown-property -- react-three-fiber elements take three.js props, which the DOM rule does not know */
import { BODY_FIELD_OF_VIEW_DEGREES, BODY_LIGHTING, dressBody, frameBody } from "@keylow/body-3d";
import maleBody from "@keylow/body-model/male.glb";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { bundledModel } from "./bundledModel";

import type { Body3DCanvasProps } from "./types";
import type { BodyColours } from "@keylow/body-3d";

function BodyMeshes({
  colours,
  onFirstFrame,
}: {
  colours: BodyColours;
  onFirstFrame?: (() => void) | undefined;
}) {
  const model = use(bundledModel(maleBody));
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const hasReportedFrame = useRef(false);
  const { muscle, otherMuscle, core, clay, skin } = colours;
  // A copy of the meshes for each canvas, with its own geometry and materials. Two canvases on screen then do
  // not share a material, and no renderer is left listening on a geometry that outlives it.
  const dressed = useMemo(
    () => dressBody(model, { muscle, otherMuscle, core, clay, skin }),
    [model, muscle, otherMuscle, core, clay, skin],
  );
  useEffect(
    () => () => {
      dressed.dispose();
    },
    [dressed],
  );
  // The whole body, head to feet, whatever the shape of the view. It looks straight along the z axis, which is where R3F points the camera.
  useLayoutEffect(() => {
    camera.position.set(...frameBody(dressed.box, aspect));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, dressed, aspect, invalidate]);
  // The meshes are in the scene by now, so the first frame that runs is the first one that draws them.
  useFrame(() => {
    if (!hasReportedFrame.current) {
      hasReportedFrame.current = true;
      onFirstFrame?.();
    }
  });

  return <primitive object={dressed.group} />;
}

/**
 * The GL view: a transparent canvas, a camera that frames the body, two lights and the male body at rest. It draws
 * with no tone mapping, so the colours are the tokens'. The native canvas always draws at the device's pixel ratio,
 * because expo-gl cannot render at any other, so it takes no `dpr` to cap at 2.
 */
export function Body3DCanvas({ colours, scheme, onFirstFrame, onError }: Body3DCanvasProps) {
  const lighting = BODY_LIGHTING[scheme];
  return (
    <Canvas
      camera={{ fov: BODY_FIELD_OF_VIEW_DEGREES }}
      flat
      frameloop="demand"
      onCreated={({ gl }) => {
        // A shader that cannot be linked is only logged by three.js, which then draws nothing. This sends it to
        // the caller, so the 2D figure stays. It replaces three's own log, and the log would carry no health data.
        gl.debug.onShaderError = () => {
          onError?.();
        };
      }}
    >
      <ambientLight intensity={lighting.ambientIntensity} />
      <directionalLight intensity={lighting.keyIntensity} position={lighting.keyPosition} />
      <Suspense fallback={null}>
        <BodyMeshes colours={colours} onFirstFrame={onFirstFrame} />
      </Suspense>
    </Canvas>
  );
}
