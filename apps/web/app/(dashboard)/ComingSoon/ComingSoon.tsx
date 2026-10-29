import { COMING_SOON_TITLE } from "@keylow/core/copy";
import { Hourglass } from "lucide-react";

import type { ComingSoonProps } from "./types";

import { EmptyState } from "@/components/ui/EmptyState";

export function ComingSoon({ title, icon = Hourglass, body }: ComingSoonProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-h1">{title}</h1>
      <EmptyState icon={icon} title={COMING_SOON_TITLE} body={body} size="placeholder" />
    </div>
  );
}
