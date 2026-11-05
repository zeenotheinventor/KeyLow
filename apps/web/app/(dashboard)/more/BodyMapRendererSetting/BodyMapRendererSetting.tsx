"use client";

import { MORE_SCREEN } from "@keylow/core/copy";
import { figureHas3dBody } from "@keylow/core/training";
import { useId } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useBodyFigure } from "@/lib/bodyFigure";
import { useBodyMapRenderer } from "@/lib/bodyMapRenderer";

const { bodyMap } = MORE_SCREEN.settings;

const rendererOptions = [
  { value: "2d", label: bodyMap.options.twoD },
  { value: "3d", label: bodyMap.options.threeD },
] as const;

/**
 * A row of the Settings group, drawn as the Appearance row is, as the `web-more · body-map-setting` boards draw it:
 * the label, and the choice of 2D or 3D for the body map page. The choice applies at once and is kept in this
 * browser, and the control always shows what was chosen. A figure with no 3D body keeps the 2D map whatever is
 * chosen, and the row says so under the control once the figure has been read.
 */
export function BodyMapRendererSetting() {
  const labelId = useId();
  const { renderer, setRenderer } = useBodyMapRenderer();
  const { figure, isReady } = useBodyFigure();
  const hasNoBodyIn3d = isReady && !figureHas3dBody(figure);

  return (
    <li className="flex flex-col gap-2 p-3">
      <span id={labelId} className="text-body-strong">
        {bodyMap.title}
      </span>
      <SegmentedControl
        labelledBy={labelId}
        options={rendererOptions}
        value={renderer}
        onChange={setRenderer}
      />
      {hasNoBodyIn3d ? (
        <p className="px-1 text-caption text-text-secondary">{bodyMap.femaleNote}</p>
      ) : null}
    </li>
  );
}
