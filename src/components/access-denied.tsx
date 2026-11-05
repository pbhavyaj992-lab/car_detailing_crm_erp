import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Explicit permission state — never show an empty list to a user who simply lacks access. */
export function AccessDenied({
  title = "Access denied",
  message = "Your role doesn't have permission to view this section. Ask an owner or manager if you need access.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}
