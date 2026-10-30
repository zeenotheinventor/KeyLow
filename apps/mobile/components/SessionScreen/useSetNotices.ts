import { useToast } from "../ui";

import type { SetNotices } from "@keylow/api-client";

/** How the phone tells the person about a set: a danger toast for a failure, and a toast with Undo for a removal. */
export function useSetNotices(): SetNotices {
  const toast = useToast();

  return {
    onFailure: (message) => {
      toast.show({ message, tone: "danger", icon: "CircleAlert" });
    },
    onRemoved: ({ message, actionLabel, undo }) => {
      toast.show({ message, actionLabel, onAction: undo });
    },
  };
}
