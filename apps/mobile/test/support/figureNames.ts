import { BODY_MAP } from "@keylow/core/copy";

/** The name of the body map screen's front figure when the muscle list is offered: the name, then where the values are. */
export const withMuscleListHint = (frontName: string): string =>
  `${frontName}. ${BODY_MAP.figureHints.muscleList}`;

/** Any front figure of the body map, with or without the muscle list's hint. */
export const anyFrontFigureName = /, front(\. .*)?$/;
