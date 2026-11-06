import { SetupRoute } from "@/components/setup";
import { readSetupMode } from "@/lib/setupRoutes";

// A later step's address ends in the step's name, such as birth-date. The mode is carried on every address.
export default async function SetupStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { step } = await params;
  const { mode } = await searchParams;

  return <SetupRoute segment={step} mode={readSetupMode(mode)} />;
}
