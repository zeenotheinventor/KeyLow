import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md bg-brand-500 text-neutral-50">
        <CardHeader>
          <h1 className="text-3xl font-semibold">KeyLow</h1>
        </CardHeader>
        <CardContent>
          <p>The web app is running.</p>
        </CardContent>
      </Card>
    </main>
  );
}
