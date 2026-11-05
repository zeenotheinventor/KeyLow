/* eslint-disable react/no-unknown-property -- react-three-fiber elements take three.js props, which the DOM rule does not know */
"use client";

import {
  BODY_FIELD_OF_VIEW_DEGREES,
  BODY_LIGHTING,
  colourFixedMaterials,
  createLookFade,
  dressBody,
  frameBody,
  looksOf,
} from "@keylow/body-3d";
import { BODY_SIDE_YAW, turnAboutCentre, yawToReachSide } from "@keylow/body-3d/rotation";
import { bodyMapPalette, themes } from "@keylow/tokens";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { maleBodyModel } from "./bodyModel";

import type { Body3DCanvasProps } from "./types";
import type { BodySide } from "@keylow/body-3d/rotation";

const MILLISECONDS_PER_SECOND = 1000;

// The stage is dark in both themes, so the body is always drawn with the dark scheme's colours and lights.
const SCHEME = "dark";
const palette = bodyMapPalette(SCHEME);
const selectedColour = themes[SCHEME]["text-primary"];

/** An ease in and out, so a turn starts and stops softly. It is 0.5 half way through. */
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);

type Turn = { from: number; to: number; elapsedMilliseconds: number };

type BodyMeshesProps = Omit<Body3DCanvasProps, "onError">;

function BodyMeshes({
  scale,
  values,
  selected,
  dim,
  unselectedOpacity,
  side,
  motionMilliseconds,
  frameAspect,
  onFirstFrame,
}: BodyMeshesProps) {
  const model = use(maleBodyModel());
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const hasReportedFrame = useRef(false);
  const looks = useMemo(() => looksOf(scale, values, palette), [scale, values]);
  const emphasis = useMemo(
    () => ({
      selected,
      selectedColor: selectedColour,
      restingColor: palette.silhouette,
      dim,
      unselectedOpacity,
    }),
    [selected, dim, unselectedOpacity],
  );
  // The first looks dress the body once. A change of values then moves the materials it has, so the muscles ease
  // from where they are instead of starting again.
  const [first] = useState({ looks, emphasis });
  // A copy of the meshes for this canvas, with its own geometry and materials, so two canvases never share a material.
  const dressed = useMemo(
    () =>
      dressBody(model, {
        muscle: palette.silhouette,
        otherMuscle: palette.otherMuscle,
        core: palette.core,
        clay: palette.clay,
        skin: palette.skin,
      }),
    [model],
  );
  const lookFade = useMemo(
    () => createLookFade(dressed.materials, first.looks, first.emphasis),
    [dressed, first],
  );
  // The middle of the body from front to back and side to side, which the turn is about.
  const { x: centreX, z: centreZ } = useMemo(
    () => ({
      x: (dressed.box.min.x + dressed.box.max.x) / 2,
      z: (dressed.box.min.z + dressed.box.max.z) / 2,
    }),
    [dressed],
  );
  const framed = useMemo(() => frameBody(dressed.box, frameAspect), [dressed, frameAspect]);
  // Where the body faces now and the turn under way, which the render loop reads. No React render is involved.
  const yaw = useRef(BODY_SIDE_YAW[side]);
  const turn = useRef<Turn | null>(null);
  const previousSide = useRef<BodySide>(side);

  useEffect(
    () => () => {
      dressed.dispose();
    },
    [dressed],
  );
  useLayoutEffect(() => {
    colourFixedMaterials(dressed.materials, {
      muscle: palette.silhouette,
      otherMuscle: palette.otherMuscle,
      core: palette.core,
      clay: palette.clay,
      skin: palette.skin,
    });
    invalidate();
  }, [dressed, invalidate]);
  // The muscles ease to the new look, in the render loop below.
  useLayoutEffect(() => {
    lookFade.moveTo(looks, emphasis, motionMilliseconds);
    invalidate();
  }, [lookFade, looks, emphasis, motionMilliseconds, invalidate]);
  // The whole body, head to feet, looking straight along the z axis, which is where R3F points the camera.
  useLayoutEffect(() => {
    camera.position.set(...framed);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, framed, invalidate]);
  // A new side turns the body there by the shorter arc, or at once with no motion.
  useLayoutEffect(() => {
    if (previousSide.current === side) {
      return;
    }
    previousSide.current = side;
    const to = yawToReachSide(yaw.current, side);
    if (motionMilliseconds === 0) {
      yaw.current = to;
      turn.current = null;
    } else {
      turn.current = { from: yaw.current, to, elapsedMilliseconds: 0 };
    }
    invalidate();
  }, [side, motionMilliseconds, invalidate]);

  // The meshes are in the scene by now, so the first frame that runs is the first one that draws them.
  useFrame((_, deltaSeconds) => {
    const deltaMilliseconds = deltaSeconds * MILLISECONDS_PER_SECOND;
    if (!hasReportedFrame.current) {
      hasReportedFrame.current = true;
      onFirstFrame?.();
    }
    const current = turn.current;
    if (current !== null) {
      current.elapsedMilliseconds += deltaMilliseconds;
      const progress = Math.min(1, current.elapsedMilliseconds / motionMilliseconds);
      yaw.current = current.from + (current.to - current.from) * smooth(progress);
      if (progress === 1) {
        turn.current = null;
      } else {
        invalidate();
      }
    }
    turnAboutCentre(dressed.group, yaw.current, centreX, centreZ);
    // The loop draws only on demand, so a fade that is not over asks for the next frame itself.
    if (lookFade.step(deltaMilliseconds)) {
      invalidate();
    }
  });

  return <primitive object={dressed.group} />;
}

/**
 * The GL view: a transparent canvas, a camera that frames the body, two lights and the male body, its muscles
 * easing to their looks and turning to the side asked for. It draws on demand with no tone mapping, so the colours
 * are the tokens'. This module is the only one that reaches three.js, and `Body3D` loads it lazily.
 */
export function Body3DCanvas({ onError, ...bodyProps }: Body3DCanvasProps) {
  const lighting = BODY_LIGHTING[SCHEME];
  return (
    <Canvas
      camera={{ fov: BODY_FIELD_OF_VIEW_DEGREES }}
      flat
      frameloop="demand"
      onCreated={({ gl }) => {
        // A shader that cannot be linked is only logged by three.js, which then draws nothing. This sends it to
        // the caller, so the 2D figure is drawn instead. A lost context draws nothing too.
        gl.debug.onShaderError = () => {
          onError?.();
        };
        gl.domElement.addEventListener("webglcontextlost", () => {
          onError?.();
        });
      }}
    >
      <ambientLight intensity={lighting.ambientIntensity} />
      <directionalLight intensity={lighting.keyIntensity} position={lighting.keyPosition} />
      <Suspense fallback={null}>
        <BodyMeshes {...bodyProps} />
      </Suspense>
    </Canvas>
  );
}
