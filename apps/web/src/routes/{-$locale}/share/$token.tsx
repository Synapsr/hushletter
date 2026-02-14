import { createFileRoute } from "@tanstack/react-router";
import { ShareNewsletterPage } from "@/routes/share/$token";

export const Route = createFileRoute("/{-$locale}/share/$token")({
  component: LocalizedShareNewsletterRoutePage,
});

function LocalizedShareNewsletterRoutePage() {
  const { token } = Route.useParams();
  return <ShareNewsletterPage token={token} />;
}

