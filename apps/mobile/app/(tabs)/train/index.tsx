import { useRouter } from "expo-router";

import { TrainScreen, useTrainSessionActions } from "../../../components/TrainScreen";
import { bodyMapPath } from "../../../lib/bodyMapRoutes";
import { sessionDetailPath } from "../../../lib/historyRoutes";
import { newRoutinePath, routinesPath } from "../../../lib/routineRoutes";
import { useOpenOnce } from "../../../lib/useOpenOnce";

export default function TrainRoute() {
  const router = useRouter();
  const { start, resume, isStarting } = useTrainSessionActions();
  // A second tap while the routines are sliding in would stack them twice.
  const openOnce = useOpenOnce();

  return (
    <TrainScreen
      isStarting={isStarting}
      onCreateRoutine={() => {
        // The routines list goes under the editor, so a saved routine returns to it and Cancel does too.
        openOnce(() => {
          router.push(routinesPath());
          router.push(newRoutinePath());
        });
      }}
      onLogSession={start}
      onOpenBodyMap={() => {
        openOnce(() => {
          router.push(bodyMapPath("train"));
        });
      }}
      onOpenHistory={() => {
        router.push("/train/history");
      }}
      onOpenRoutines={() => {
        openOnce(() => {
          router.push(routinesPath());
        });
      }}
      onResume={resume}
      onStart={start}
      onViewSession={(sessionId) => {
        router.push(sessionDetailPath(sessionId, "train"));
      }}
    />
  );
}
