/* eslint-disable react/no-unknown-property -- react-three-fiber elements take three.js props, which the DOM rule does not know */
import {
  BODY_FIELD_OF_VIEW_DEGREES,
  BODY_LIGHTING,
  colourFixedMaterials,
  createLookFade,
  dressBody,
  frameBody,
} from "@keylow/body-3d";
import maleBody from "@keylow/body-model/male.glb";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { bundledModel } from "./bundledModel";

import type { Body3DCanvasProps } from "./types";
import type { Group } from "three";

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Turns the body by `yaw` about the vertical line through (`centreX`, `centreZ`), the middle of its box, so it
 * turns on the spot wherever the model has its origin. The group turns about its own origin, so it is moved by
 * what keeps that line where it was: the centre minus the centre turned.
 */
function turnAboutCentre(group: Group, yaw: number, centreX: number, centreZ: number) {
  const sine = Math.sin(yaw);
  const cosine = Math.cos(yaw);
  group.rotation.y = yaw;
  group.position.set(
    centreX - (centreX * cosine + centreZ * sine),
    0,
    centreZ - (centreZ * cosine - centreX * sine),
  );
}

type BodyMeshesProps = Pick<
  Body3DCanvasProps,
  "colours" | "looks" | "emphasis" | "fadeMilliseconds" | "yaw" | "onFirstFrame"
>;

function BodyMeshes({
  colours,
  looks,
  emphasis,
  fadeMilliseconds,
  yaw,
  onFirstFrame,
}: BodyMeshesProps) {
  const model = use(bundledModel(maleBody));
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const hasReportedFrame = useRef(false);
  const { muscle, otherMuscle, core, clay, skin } = colours;
  // The first colours and looks dress the body once. A change of theme or of values then moves the materials it
  // has, so the muscles can ease from where they are instead of starting again.
  const [first] = useState({ colours, looks, emphasis });
  // A copy of the meshes for each canvas, with its own geometry and materials. Two canvases on screen then do
  // not share a material, and no renderer is left listening on a geometry that outlives it.
  const dressed = useMemo(() => dressBody(model, first.colours), [model, first.colours]);
  // The middle of the body from front to back and side to side, which the turn is about.
  const { x: centreX, z: centreZ } = useMemo(
    () => ({
      x: (dressed.box.min.x + dressed.box.max.x) / 2,
      z: (dressed.box.min.z + dressed.box.max.z) / 2,
    }),
    [dressed],
  );
  const lookFade = useMemo(
    () => createLookFade(dressed.materials, first.looks, first.emphasis),
    [dressed, first.looks, first.emphasis],
  );
  useEffect(
    () => () => {
      dressed.dispose();
    },
    [dressed],
  );
  // The turn is a shared value that a drag and a settle move off the render loop. The loop draws only on demand,
  // so every change of it asks for the next frame, which reads it below. No React render is involved.
  useAnimatedReaction(
    () => yaw.get(),
    () => {
      scheduleOnRN(invalidate);
    },
    [yaw, invalidate],
  );
  // The parts that are not muscles change colour at once with the theme. The frame is drawn on demand.
  useLayoutEffect(() => {
    colourFixedMaterials(dressed.materials, { muscle, otherMuscle, core, clay, skin });
    invalidate();
  }, [dressed, muscle, otherMuscle, core, clay, skin, invalidate]);
  // The muscles ease to the new look, in the render loop below.
  useLayoutEffect(() => {
    lookFade.moveTo(looks, emphasis, fadeMilliseconds);
    invalidate();
  }, [lookFade, looks, emphasis, fadeMilliseconds, invalidate]);
  // The whole body, head to feet, whatever the shape of the view. It looks straight along the z axis, which is where R3F points the camera.
  useLayoutEffect(() => {
    camera.position.set(...frameBody(dressed.box, aspect));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, dressed, aspect, invalidate]);
  // The meshes are in the scene by now, so the first frame that runs is the first one that draws them.
  useFrame((_, deltaSeconds) => {
    if (!hasReportedFrame.current) {
      hasReportedFrame.current = true;
      onFirstFrame?.();
    }
    turnAboutCentre(dressed.group, yaw.get(), centreX, centreZ);
    // The loop draws only on demand, so a fade that is not over asks for the next frame itself.
    if (lookFade.step(deltaSeconds * MILLISECONDS_PER_SECOND)) {
      invalidate();
    }
  });

  return <primitive object={dressed.group} />;
}

/**
 * The GL view: a transparent canvas, a camera that frames the body, two lights and the male body, its muscles easing to their looks and
 * the body turning with `yaw`. It draws
 * with no tone mapping, so the colours are the tokens'. The native canvas always draws at the device's pixel ratio,
 * because expo-gl cannot render at any other, so it takes no `dpr` to cap at 2.
 */
export function Body3DCanvas({
  colours,
  scheme,
  looks,
  emphasis,
  fadeMilliseconds,
  yaw,
  onFirstFrame,
  onError,
}: Body3DCanvasProps) {
  const lighting = BODY_LIGHTING[scheme];
  return (
    <Canvas
      camera={{ fov: BODY_FIELD_OF_VIEW_DEGREES }}
      flat
      frameloop="demand"
      // The canvas lays a touch responder over the GL view that takes every touch at touch down, and that would
      // cancel the body's drag and tap. The body uses no pointer events of three.js, so the canvas takes none.
      pointerEvents="none"
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
        <BodyMeshes
          colours={colours}
          emphasis={emphasis}
          fadeMilliseconds={fadeMilliseconds}
          looks={looks}
          onFirstFrame={onFirstFrame}
          yaw={yaw}
        />
      </Suspense>
    </Canvas>
  );
}
