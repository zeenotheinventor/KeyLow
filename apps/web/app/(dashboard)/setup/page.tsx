import { SetupRoute } from "@/components/setup";
import { readSetupMode } from "@/lib/setupRoutes";

// The wizard's own address is its first step, so `/setup?mode=first-run` stays the address the first run gate
// sends to. Nothing links here until the estimate ticket.
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { mode } = await searchParams;

  return <SetupRoute segment={undefined} mode={readSetupMode(mode)} />;
}
