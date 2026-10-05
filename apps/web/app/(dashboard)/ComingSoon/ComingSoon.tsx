import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Coming soon</p>
      </CardContent>
    </Card>
  );
}
