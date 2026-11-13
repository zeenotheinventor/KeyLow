import { ASSISTANT_SHEET } from "@keylow/core/copy";

import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";

// The conversation as its opening board draws it: your message as a bubble bone on the right, then the reply
// as lines, twice. The classes are written out so Tailwind sees them.
const messages = [
  { key: "first-you", kind: "you", widths: ["w-[62%]"] },
  { key: "first-reply", kind: "reply", widths: ["w-[92%]", "w-[84%]", "w-[58%]"] },
  { key: "second-you", kind: "you", widths: ["w-[44%]"] },
  { key: "second-reply", kind: "reply", widths: ["w-[88%]", "w-[46%]"] },
] as const;

/**
 * The rows that stand in for the conversation (`assistant · opening`), while it is read for the first time.
 * A bubble bone is 46 px tall with the chat bubble's corners, small at the bottom right, and the reply's
 * lines are 14 px tall, 8 apart, and stop 16 px short of the right edge. The messages are 12 apart.
 */
export function AssistantOpening() {
  return (
    <Skeleton className="flex flex-col gap-3" label={ASSISTANT_SHEET.openingLabel}>
      {messages.map(({ key, kind, widths }) =>
        kind === "you" ? (
          <SkeletonBone
            key={key}
            className={`h-[46px] self-end rounded-medium rounded-br-small ${widths[0]}`}
          />
        ) : (
          <div key={key} className="flex flex-col gap-2 pr-4">
            {widths.map((width) => (
              <SkeletonBone key={width} className={`h-[14px] ${width}`} />
            ))}
          </div>
        ),
      )}
    </Skeleton>
  );
}
