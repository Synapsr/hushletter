import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { InlineReaderPane } from "@/components/newsletters/InlineReaderPane";
import { useOptimisticNewsletterFavorite } from "@/hooks/useOptimisticNewsletterFavorite";

export const Route = createFileRoute("/_authed/newsletters/$id")({
  component: NewsletterDetailPage,
});

function NewsletterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const userNewsletterId = id as Id<"userNewsletters">;

  const { data } = useQuery(
    convexQuery(api.newsletters.getUserNewsletter, { userNewsletterId }),
  );
  const newsletter = data as
    | { _id: string; isFavorited?: boolean }
    | null
    | undefined;

  const favoriteController = useOptimisticNewsletterFavorite(
    newsletter
      ? [{ _id: newsletter._id, isFavorited: newsletter.isFavorited }]
      : [],
  );

  return (
    <div className="h-screen flex flex-col">
      <InlineReaderPane
        key={userNewsletterId}
        newsletterId={userNewsletterId}
        getIsFavorited={favoriteController.getIsFavorited}
        isFavoritePending={favoriteController.isFavoritePending}
        onToggleFavorite={favoriteController.toggleFavorite}
        onClose={() => navigate({ to: "/newsletters" })}
      />
    </div>
  );
}
