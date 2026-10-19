import { TrainScreen, useTrainSessionActions } from "../../../components/TrainScreen";

export default function TrainRoute() {
  const { start, resume, isStarting } = useTrainSessionActions();

  return (
    <TrainScreen isStarting={isStarting} onLogSession={start} onResume={resume} onStart={start} />
  );
}
