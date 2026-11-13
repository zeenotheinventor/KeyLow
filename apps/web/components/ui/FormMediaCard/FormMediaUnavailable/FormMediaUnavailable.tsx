import { EXERCISE_FORM } from "@keylow/core/copy";

import { Card } from "../../Card";

/** One quiet line for offline or a failed read. It is not an error, so it has no error styling. */
export function FormMediaUnavailable() {
  return (
    <Card padding="none" role="status">
      <p className="flex min-h-11 items-center px-4 py-3 text-body text-text-secondary">
        {EXERCISE_FORM.unavailable}
      </p>
    </Card>
  );
}
