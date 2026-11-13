import { EXERCISE_FORM, describeFormPhoto } from "@keylow/core/copy";
import { useEffect, useState } from "react";

import { Badge } from "../../Badge";
import { Card } from "../../Card";
import { FormImage } from "../FormImage";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

import type { FormPhotosProps } from "./types";

import { cn } from "@/lib/utils";

// Each photo has its turn for about a second and a half, the crossfade included.
const photoTurnMilliseconds = 1500;

function PhotoBadge({ label }: { label: string }) {
  return (
    <Badge outlined className="absolute bottom-2 left-2 bg-surface font-semibold text-text-primary">
      {label}
    </Badge>
  );
}

// One photo at a time in a 2:1 stage: the start photo, and the end photo fading in over it and out again, in a loop.
function AlternatingPhotos({ exerciseName, startUrl, endUrl }: FormPhotosProps) {
  const [isEndShown, setIsEndShown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsEndShown((wasShown) => !wasShown);
    }, photoTurnMilliseconds);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative">
      <FormImage
        label={describeFormPhoto(exerciseName, "start")}
        sizeClassName="aspect-[2/1] w-full"
        url={startUrl}
      />
      <PhotoBadge label={EXERCISE_FORM.startLabel} />
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-standard",
          isEndShown ? "opacity-100" : "opacity-0",
        )}
      >
        <FormImage
          label={describeFormPhoto(exerciseName, "end")}
          sizeClassName="aspect-[2/1] w-full"
          url={endUrl}
        />
        <PhotoBadge label={EXERCISE_FORM.endLabel} />
      </div>
    </div>
  );
}

// Reduced motion: both photos side by side, 3:2 each, 2 px apart, and nothing moves.
function SideBySidePhotos({ exerciseName, startUrl, endUrl }: FormPhotosProps) {
  return (
    <div className="flex gap-0.5 bg-border">
      <div className="relative flex-1">
        <FormImage
          label={describeFormPhoto(exerciseName, "start")}
          sizeClassName="aspect-[3/2] w-full"
          url={startUrl}
        />
        <PhotoBadge label={EXERCISE_FORM.startLabel} />
      </div>
      <div className="relative flex-1">
        <FormImage
          label={describeFormPhoto(exerciseName, "end")}
          sizeClassName="aspect-[3/2] w-full"
          url={endUrl}
        />
        <PhotoBadge label={EXERCISE_FORM.endLabel} />
      </div>
    </div>
  );
}

/**
 * The exercise's start and end photos, for an exercise with no curated video. They take turns with a
 * crossfade, or sit side by side and still when the system asks to reduce motion.
 */
export function FormPhotos(props: FormPhotosProps) {
  const isReducedMotion = usePrefersReducedMotion();

  return (
    <Card padding="none">
      {isReducedMotion ? <SideBySidePhotos {...props} /> : <AlternatingPhotos {...props} />}
    </Card>
  );
}
