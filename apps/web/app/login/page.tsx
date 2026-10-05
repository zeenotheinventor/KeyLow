import { LoginForm } from "./LoginForm";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

const LINK_ERROR_MESSAGE = "We could not verify that link. Please try again.";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Sign in to KeyLow</h1>
        </CardHeader>
        <CardContent>
          <LoginForm linkError={error === undefined ? undefined : LINK_ERROR_MESSAGE} />
        </CardContent>
      </Card>
    </main>
  );
}
