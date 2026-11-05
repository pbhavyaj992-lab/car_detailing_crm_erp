import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route kept only so existing links do not 404; content removed.
export const Route = createFileRoute("/blog/ceramic-coating-vs-ppf")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
