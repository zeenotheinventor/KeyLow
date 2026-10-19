import { useRouter } from "expo-router";

import { TrainScreen, useTrainSessionActions } from "../../../components/TrainScreen";

export default function TrainRoute() {
  const router = useRouter();
  const { start, resume, isStarting } = useTrainSessionActions();

  return (
    <TrainScreen
      isStarting={isStarting}
      onLogSession={start}
      onOpenHistory={() => {
        router.push("/train/history");
      }}
      onResume={resume}
      onStart={start}
    />
  );
}
