import { SIGN_IN_LINK_NOT_VERIFIED } from "@keylow/core/copy";

import { LoginForm } from "./LoginForm";

import { Card } from "@/components/ui/Card";
import { KiLoMark } from "@/components/ui/KiLoMark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6">
      <Card padding="none" className="flex w-full max-w-md flex-col gap-4 p-6 sm:p-8">
        <div className="mb-1 flex flex-col items-start gap-3">
          <KiLoMark className="size-12" />
          <h1 className="text-h1">Sign in to Ki-Lo</h1>
        </div>
        <LoginForm linkError={error === undefined ? undefined : SIGN_IN_LINK_NOT_VERIFIED} />
      </Card>
    </main>
  );
}
