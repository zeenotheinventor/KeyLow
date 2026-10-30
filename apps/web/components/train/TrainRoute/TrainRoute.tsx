"use client";

import { useStartSessionAction } from "@keylow/api-client";
import { TRAIN_START_FAILED } from "@keylow/core/copy";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { TrainScreen } from "../TrainScreen";

import { useToast } from "@/components/ui/Toast";
import { trainSessionPath } from "@/lib/trainRoutes";

/**
 * The Train page with its buttons wired: Start and Log a session start a session at the moment of the press
 * and open its page, and Resume opens it. One session is open at a time, so a start with one in progress
 * opens that one. A start that fails shows a danger toast that states the rule, opens nothing and can be
 * pressed again.
 */
export function TrainRoute() {
  const router = useRouter();
  const toast = useToast();
  const openSession = () => {
    router.push(trainSessionPath());
  };
  const { start, isStarting } = useStartSessionAction({
    onStarted: openSession,
    onFailure: () => {
      toast.show({ message: TRAIN_START_FAILED, tone: "danger", icon: CircleAlert });
    },
  });

  return (
    <TrainScreen
      isStarting={isStarting}
      onStart={start}
      onLogSession={start}
      onResume={openSession}
    />
  );
}
