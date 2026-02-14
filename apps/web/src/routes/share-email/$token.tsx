import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";

export const Route = createFileRoute("/share-email/$token")({
  head: () => ({
    title: "Hushletter",
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ShareDedicatedEmailRoutePage,
});

function ShareDedicatedEmailRoutePage() {
  const { token } = Route.useParams();
  return <ShareDedicatedEmailPage token={token} />;
}

export function ShareDedicatedEmailPage({ token }: { token: string }) {
  const cleanedToken = typeof token === "string" ? token.trim() : "";

  const { data, isPending } = useQuery(
    convexQuery(api.share.getDedicatedEmailByShareToken, {
      token: cleanedToken,
    }),
  );

  const result = data as { dedicatedEmail: string } | null | undefined;

  if (isPending) {
    return <main className="min-h-screen flex items-center justify-center" />;
  }

  if (!result?.dedicatedEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Not found</p>
      </main>
    );
  }

  const email = result.dedicatedEmail;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <button
        type="button"
        className="font-mono text-3xl sm:text-4xl font-medium select-all text-center text-foreground"
        onClick={() => {
          const promise = navigator.clipboard?.writeText(email);
          if (promise) void promise.catch(() => {});
        }}
      >
        {email}
      </button>
    </main>
  );
}

